import {
  db,
  goalAlertSettingsTable,
  dashboardGoalsTable,
  financialEntriesTable,
  salesOrdersTable,
  usersTable,
} from "@workspace/db";
import { and, eq, sql, gte, lte, inArray } from "drizzle-orm";
import nodemailer from "nodemailer";
import { logger } from "./logger";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

async function getOrInitSettings(): Promise<typeof goalAlertSettingsTable.$inferSelect> {
  const [existing] = await db.select().from(goalAlertSettingsTable).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(goalAlertSettingsTable)
    .values({})
    .returning();
  return created;
}

async function sendGoalAlertEmail(
  recipients: string[],
  monthLabel: string,
  alerts: { kpi: string; label: string; progress: number; daysRemaining: number; actual: string; goal: string }[],
): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) {
    logger.warn("Goal alert email skipped: SMTP not configured");
    return;
  }

  const alertLines = alerts
    .map(
      (a) =>
        `• ${a.label}: ${a.progress.toFixed(1)}% da meta atingida (${a.actual} de ${a.goal}) — ${a.daysRemaining} dias restantes`,
    )
    .join("\n");

  const subject = `⚠️ Alerta de Metas em Risco — ${monthLabel}`;
  const text = [
    `NEXUS ERP — Alerta de Metas em Risco`,
    ``,
    `Mês de referência: ${monthLabel}`,
    ``,
    `As seguintes metas estão abaixo do limiar de progresso esperado:`,
    ``,
    alertLines,
    ``,
    `Acesse o dashboard executivo para mais detalhes.`,
  ].join("\n");

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: recipients.join(", "),
    subject,
    text,
  });

  logger.info({ recipients, monthLabel, alertCount: alerts.length }, "Goal alert email sent");
}

async function checkGoalAlerts(): Promise<void> {
  const settings = await getOrInitSettings();

  if (!settings.enabled) return;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  if (now.getHours() !== settings.notifyHour || now.getMinutes() !== settings.notifyMinute) return;
  if (settings.lastSentDate === todayStr) return;

  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  const daysInMonth = new Date(y, m, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate();

  if (daysRemaining > settings.daysRemainingThreshold) return;

  const [goalRow] = await db
    .select()
    .from(dashboardGoalsTable)
    .where(and(eq(dashboardGoalsTable.year, y), eq(dashboardGoalsTable.month, m)))
    .limit(1);

  if (!goalRow) return;

  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = now;

  const [revenueRow, expenseRow, salesRow] = await Promise.all([
    db
      .select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(
        and(
          eq(financialEntriesTable.type, "income"),
          eq(financialEntriesTable.status, "paid"),
          gte(financialEntriesTable.paidAt, monthStart),
          lte(financialEntriesTable.paidAt, monthEnd),
        ),
      ),
    db
      .select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(
        and(
          eq(financialEntriesTable.type, "expense"),
          eq(financialEntriesTable.status, "paid"),
          gte(financialEntriesTable.paidAt, monthStart),
          lte(financialEntriesTable.paidAt, monthEnd),
        ),
      ),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(salesOrdersTable)
      .where(
        and(
          sql`${salesOrdersTable.status} NOT IN ('cancelled')`,
          gte(salesOrdersTable.createdAt, monthStart),
          lte(salesOrdersTable.createdAt, monthEnd),
        ),
      ),
  ]);

  const revenueActual = parseFloat(revenueRow[0]?.total ?? "0");
  const expenseActual = parseFloat(expenseRow[0]?.total ?? "0");
  const salesActual = salesRow[0]?.count ?? 0;

  const threshold = settings.progressThreshold;
  const alerts: { kpi: string; label: string; progress: number; daysRemaining: number; actual: string; goal: string }[] = [];

  const revGoal = parseFloat(goalRow.revenueGoal);
  if (revGoal > 0) {
    const progress = (revenueActual / revGoal) * 100;
    if (progress < threshold) {
      alerts.push({
        kpi: "revenue",
        label: "Receita",
        progress: Math.round(progress * 10) / 10,
        daysRemaining,
        actual: revenueActual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        goal: revGoal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      });
    }
  }

  const expGoal = parseFloat(goalRow.expenseGoal);
  if (expGoal > 0) {
    const progress = (expenseActual / expGoal) * 100;
    if (progress < threshold) {
      alerts.push({
        kpi: "expense",
        label: "Despesas",
        progress: Math.round(progress * 10) / 10,
        daysRemaining,
        actual: expenseActual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        goal: expGoal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      });
    }
  }

  const soGoal = goalRow.salesOrdersGoal;
  if (soGoal > 0) {
    const progress = (salesActual / soGoal) * 100;
    if (progress < threshold) {
      alerts.push({
        kpi: "salesOrders",
        label: "Novos Pedidos no Mês",
        progress: Math.round(progress * 10) / 10,
        daysRemaining,
        actual: String(salesActual),
        goal: String(soGoal),
      });
    }
  }

  if (alerts.length === 0) return;

  const adminManagerUsers = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(inArray(usersTable.role, ["admin", "manager"]));

  const recipients = adminManagerUsers.map((u) => u.email).filter(Boolean);
  if (recipients.length === 0) return;

  const monthLabel = `${MONTH_LABELS[m - 1]}/${y}`;

  await sendGoalAlertEmail(recipients, monthLabel, alerts);

  await db
    .update(goalAlertSettingsTable)
    .set({ lastSentDate: todayStr, updatedAt: new Date() })
    .where(eq(goalAlertSettingsTable.id, settings.id));
}

let alertInterval: ReturnType<typeof setInterval> | null = null;

export function startGoalAlertScheduler(): void {
  if (alertInterval) return;
  alertInterval = setInterval(() => {
    void checkGoalAlerts().catch((err) => {
      logger.error({ err }, "Error in goal alert scheduler");
    });
  }, 60_000);
  logger.info("Goal alert scheduler started");
}

export function stopGoalAlertScheduler(): void {
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
  }
}
