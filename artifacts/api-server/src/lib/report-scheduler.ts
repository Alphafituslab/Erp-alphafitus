import {
  db,
  reportSchedulesTable,
  reportSendLogsTable,
  companySettingsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { sendEmail } from "./mailer";
import { isSmtpConfiguredAsync, getEffectiveSmtpConfig } from "./smtp-config";
import { buildReportPdf } from "../routes/relatorios-pdf";

type Period = "this_month" | "last_month" | "this_quarter" | "this_year";

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function getDateRange(period: Period): { start: Date; end: Date; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "this_month":
      return { start: new Date(y, m, 1), end: now, label: `${MONTH_LABELS[m]}/${y}` };
    case "last_month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return { start: new Date(ly, lm, 1), end: new Date(y, m, 0, 23, 59, 59, 999), label: `${MONTH_LABELS[lm]}/${ly}` };
    }
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return { start: new Date(y, q * 3, 1), end: now, label: `T${q + 1}/${y}` };
    }
    case "this_year":
      return { start: new Date(y, 0, 1), end: now, label: String(y) };
  }
}

async function runScheduledSend(
  scheduleId: number,
  period: Period,
  recipients: string[],
  subject: string,
  message: string | null | undefined,
  modules: string[] | null | undefined,
): Promise<void> {
  const range = getDateRange(period);
  const periodLabel = range.label;
  const recipientsStr = recipients.join(", ");

  const smtpCfg = await getEffectiveSmtpConfig();
  if (!smtpCfg) {
    await db.insert(reportSendLogsTable).values({
      scheduleId,
      triggerType: "scheduled",
      period,
      periodLabel,
      recipients: recipientsStr,
      status: "error",
      errorMessage: "SMTP não configurado. Configure as credenciais em Usuários → Configurações SMTP.",
    });
    return;
  }

  try {
    const [companyCfg] = await db.select().from(companySettingsTable).limit(1);
    const pdfBuffer = await buildReportPdf(period, {
      modules: modules ?? null,
      companyName: companyCfg?.companyName ?? undefined,
      logoBase64: companyCfg?.logoBase64 ?? null,
      includeHeader: true,
    });
    const filename = `relatorio-executivo-${periodLabel.toLowerCase().replace(/\//g, "-")}.pdf`;

    await sendEmail({
      to: recipientsStr,
      subject,
      text: message?.trim() || "Segue em anexo o relatório executivo gerado automaticamente pelo NEXUS ERP.",
      attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
    }, smtpCfg);

    await db.insert(reportSendLogsTable).values({
      scheduleId,
      triggerType: "scheduled",
      period,
      periodLabel,
      recipients: recipientsStr,
      status: "success",
    });

    logger.info({ scheduleId, recipients: recipientsStr }, "Scheduled report sent successfully");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err, scheduleId }, "Failed to send scheduled report");
    await db.insert(reportSendLogsTable).values({
      scheduleId,
      triggerType: "scheduled",
      period,
      periodLabel,
      recipients: recipientsStr,
      status: "error",
      errorMessage,
    });
  }
}

function shouldFireSchedule(
  schedule: {
    frequency: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    hour: number;
    minute: number;
  },
  now: Date,
): boolean {
  if (now.getHours() !== schedule.hour || now.getMinutes() !== schedule.minute) {
    return false;
  }
  if (schedule.frequency === "weekly") {
    return now.getDay() === (schedule.dayOfWeek ?? 1);
  }
  if (schedule.frequency === "monthly") {
    return now.getDate() === (schedule.dayOfMonth ?? 1);
  }
  return false;
}

const firedThisMinute = new Set<string>();

async function checkAndFireSchedules(): Promise<void> {
  const now = new Date();
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;

  try {
    const schedules = await db
      .select()
      .from(reportSchedulesTable)
      .where(eq(reportSchedulesTable.active, true));

    for (const schedule of schedules) {
      const fireKey = `${schedule.id}-${minuteKey}`;
      if (firedThisMinute.has(fireKey)) continue;
      if (!shouldFireSchedule(schedule, now)) continue;

      firedThisMinute.add(fireKey);

      if (firedThisMinute.size > 10000) {
        for (const key of [...firedThisMinute].slice(0, 5000)) {
          firedThisMinute.delete(key);
        }
      }

      const recipients = schedule.recipients
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);

      void runScheduledSend(
        schedule.id,
        schedule.period as Period,
        recipients,
        schedule.subject,
        schedule.message,
        schedule.modules as string[] | null,
      );
    }
  } catch (err) {
    logger.error({ err }, "Error checking report schedules");
  }
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startReportScheduler(): void {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(() => {
    void checkAndFireSchedules();
  }, 60_000);
  logger.info("Report scheduler started");
}

export function stopReportScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
