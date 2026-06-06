import {
  db,
  goalAlertSettingsTable,
  goalAlertLogsTable,
  dashboardGoalsTable,
  financialEntriesTable,
  salesOrdersTable,
  usersTable,
} from "@workspace/db";
import { and, eq, sql, gte, lte, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { sendEmail } from "./mailer";
import { getEffectiveSmtpConfig } from "./smtp-config";

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
  const cfg = await getEffectiveSmtpConfig();
  if (!cfg) {
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

  await sendEmail({
    to: recipients.join(", "),
    subject,
    text,
  }, cfg);

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

  let recipients: string[];

  if (settings.customRecipients && settings.customRecipients.trim() !== "") {
    recipients = settings.customRecipients
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  } else {
    const adminManagerUsers = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(inArray(usersTable.role, ["admin", "manager"]));
    recipients = adminManagerUsers.map((u) => u.email).filter(Boolean);
  }

  if (recipients.length === 0) return;

  const monthLabel = `${MONTH_LABELS[m - 1]}/${y}`;
  const recipientsStr = recipients.join(", ");

  let sendError: string | null = null;
  try {
    await sendGoalAlertEmail(recipients, monthLabel, alerts);
  } catch (err: unknown) {
    sendError = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Goal alert email failed");
  }

  await db.insert(goalAlertLogsTable).values({
    monthLabel,
    recipients: recipientsStr,
    alertCount: alerts.length,
    alerts,
    status: sendError ? "error" : "success",
    errorMessage: sendError,
  });

  if (!sendError) {
    await db
      .update(goalAlertSettingsTable)
      .set({ lastSentDate: todayStr, updatedAt: new Date() })
      .where(eq(goalAlertSettingsTable.id, settings.id));
  }
}

export async function sendGoalAlertNow(): Promise<{ recipients: string[]; alertCount: number }> {
  const settings = await getOrInitSettings();

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  const daysInMonth = new Date(y, m, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate();

  const [goalRow] = await db
    .select()
    .from(dashboardGoalsTable)
    .where(and(eq(dashboardGoalsTable.year, y), eq(dashboardGoalsTable.month, m)))
    .limit(1);

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

  const alerts: { kpi: string; label: string; progress: number; daysRemaining: number; actual: string; goal: string }[] = [];

  if (goalRow) {
    const revGoal = parseFloat(goalRow.revenueGoal);
    if (revGoal > 0) {
      const progress = (revenueActual / revGoal) * 100;
      alerts.push({
        kpi: "revenue",
        label: "Receita",
        progress: Math.round(progress * 10) / 10,
        daysRemaining,
        actual: revenueActual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        goal: revGoal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      });
    }

    const expGoal = parseFloat(goalRow.expenseGoal);
    if (expGoal > 0) {
      const progress = (expenseActual / expGoal) * 100;
      alerts.push({
        kpi: "expense",
        label: "Despesas",
        progress: Math.round(progress * 10) / 10,
        daysRemaining,
        actual: expenseActual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        goal: expGoal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      });
    }

    const soGoal = goalRow.salesOrdersGoal;
    if (soGoal > 0) {
      const progress = (salesActual / soGoal) * 100;
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

  let recipients: string[];
  if (settings.customRecipients && settings.customRecipients.trim() !== "") {
    recipients = settings.customRecipients
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  } else {
    const adminManagerUsers = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(inArray(usersTable.role, ["admin", "manager"]));
    recipients = adminManagerUsers.map((u) => u.email).filter(Boolean);
  }

  const monthLabel = `${MONTH_LABELS[m - 1]}/${y}`;
  const recipientsStr = recipients.length > 0 ? recipients.join(", ") : "(nenhum)";

  const testAlerts = alerts.length > 0
    ? alerts
    : [{ kpi: "test", label: "Teste de configuração", progress: 100, daysRemaining, actual: "–", goal: "–" }];

  let sendError: string | null = null;
  try {
    await sendGoalAlertTestEmail(recipients, monthLabel, testAlerts);
  } catch (err: unknown) {
    sendError = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Goal alert test email failed");
  }

  await db.insert(goalAlertLogsTable).values({
    monthLabel,
    recipients: recipientsStr,
    alertCount: testAlerts.length,
    alerts: testAlerts,
    status: sendError ? "error" : "success",
    errorMessage: sendError,
  });

  if (sendError) {
    throw new Error(sendError);
  }

  return { recipients, alertCount: testAlerts.length };
}

async function sendGoalAlertTestEmail(
  recipients: string[],
  monthLabel: string,
  alerts: { kpi: string; label: string; progress: number; daysRemaining: number; actual: string; goal: string }[],
): Promise<void> {
  const cfg = await getEffectiveSmtpConfig();
  if (!cfg) {
    throw new Error("SMTP não configurado. Configure as credenciais em Usuários → Configuração SMTP.");
  }

  if (recipients.length === 0) {
    throw new Error("Nenhum destinatário encontrado. Cadastre administradores ou configure destinatários personalizados.");
  }

  const alertLines = alerts
    .map(
      (a) =>
        `• ${a.label}: ${a.progress.toFixed(1)}% da meta atingida (${a.actual} de ${a.goal}) — ${a.daysRemaining} dias restantes`,
    )
    .join("\n");

  const subject = `[TESTE] Alerta de Metas — ${monthLabel}`;
  const text = [
    `NEXUS ERP — Alerta de Metas (ENVIO DE TESTE)`,
    ``,
    `Este é um envio de teste para verificar a configuração de e-mail.`,
    ``,
    `Mês de referência: ${monthLabel}`,
    ``,
    `Indicadores do mês atual:`,
    ``,
    alertLines,
    ``,
    `Acesse o dashboard executivo para mais detalhes.`,
  ].join("\n");

  await sendEmail({ to: recipients.join(", "), subject, text }, cfg);

  logger.info({ recipients, monthLabel }, "Goal alert test email sent");
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
