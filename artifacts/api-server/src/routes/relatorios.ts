import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  financialEntriesTable,
  salesOrdersTable,
  clientsTable,
  productsTable,
  stockMovementsTable,
  purchaseOrdersTable,
  employeesTable,
  projectsTable,
  dashboardGoalsTable,
  reportSchedulesTable,
  reportSendLogsTable,
  goalAlertSettingsTable,
  goalAlertLogsTable,
} from "@workspace/db";
import type { Request, Response } from "express";
import { sendEmail, isSmtpConfigured } from "../lib/mailer";
import { buildReportPdf } from "./relatorios-pdf";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  return true;
}

async function requireManagerAsync(req: Request, res: Response): Promise<boolean> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  let role = req.session.role;
  if (!role) {
    const [user] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId))
      .limit(1);
    if (!user) {
      res.status(401).json({ error: "Não autenticado" });
      return false;
    }
    role = user.role;
    req.session.role = role;
  }
  if (role !== "admin" && role !== "manager") {
    res.status(403).json({ error: "Acesso restrito a gestores e administradores" });
    return false;
  }
  return true;
}

async function requireAdminAsync(req: Request, res: Response): Promise<boolean> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  let role = req.session.role;
  if (!role) {
    const [user] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId))
      .limit(1);
    if (!user) {
      res.status(401).json({ error: "Não autenticado" });
      return false;
    }
    role = user.role;
    req.session.role = role;
  }
  if (role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores" });
    return false;
  }
  return true;
}

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

type Period = "this_month" | "last_month" | "this_quarter" | "this_year";

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

function getDateRange(period: Period): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  switch (period) {
    case "this_month":
      return {
        start: new Date(y, m, 1),
        end: now,
        label: `${MONTH_LABELS[m]}/${y}`,
      };
    case "last_month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const lastDay = new Date(y, m, 0, 23, 59, 59, 999);
      return {
        start: new Date(ly, lm, 1),
        end: lastDay,
        label: `${MONTH_LABELS[lm]}/${ly}`,
      };
    }
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return {
        start: new Date(y, q * 3, 1),
        end: now,
        label: `T${q + 1}/${y}`,
      };
    }
    case "this_year":
      return {
        start: new Date(y, 0, 1),
        end: now,
        label: String(y),
      };
  }
}

function getPreviousPeriodRange(period: Period, current: DateRange): DateRange {
  const diff = current.end.getTime() - current.start.getTime();
  const prevEnd = new Date(current.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  return { start: prevStart, end: prevEnd, label: "" };
}

// ─── Executive Dashboard ──────────────────────────────────────────────────────

router.get("/relatorios/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const period = (req.query.period as Period) ?? "this_month";
  const validPeriods: Period[] = ["this_month", "last_month", "this_quarter", "this_year"];
  if (!validPeriods.includes(period)) {
    res.status(400).json({ error: "Período inválido" });
    return;
  }

  const range = getDateRange(period);
  const prevRange = getPreviousPeriodRange(period, range);

  const [
    revenueRow,
    expenseRow,
    revenuePrevRow,
    expensePrevRow,
    openSalesRow,
    newSalesRow,
    lowStockRow,
    pendingPurchaseRow,
    activeEmployeesRow,
    activeProjectsRow,
  ] = await Promise.all([
    db
      .select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(
        and(
          eq(financialEntriesTable.type, "income"),
          eq(financialEntriesTable.status, "paid"),
          gte(financialEntriesTable.paidAt, range.start),
          lte(financialEntriesTable.paidAt, range.end)
        )
      ),

    db
      .select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(
        and(
          eq(financialEntriesTable.type, "expense"),
          eq(financialEntriesTable.status, "paid"),
          gte(financialEntriesTable.paidAt, range.start),
          lte(financialEntriesTable.paidAt, range.end)
        )
      ),

    db
      .select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(
        and(
          eq(financialEntriesTable.type, "income"),
          eq(financialEntriesTable.status, "paid"),
          gte(financialEntriesTable.paidAt, prevRange.start),
          lte(financialEntriesTable.paidAt, prevRange.end)
        )
      ),

    db
      .select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(
        and(
          eq(financialEntriesTable.type, "expense"),
          eq(financialEntriesTable.status, "paid"),
          gte(financialEntriesTable.paidAt, prevRange.start),
          lte(financialEntriesTable.paidAt, prevRange.end)
        )
      ),

    // Open sales orders backlog (all-time, status-based snapshot)
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(salesOrdersTable)
      .where(sql`${salesOrdersTable.status} IN ('draft', 'confirmed')`),

    // New sales orders created within the selected period (period-bounded, for goal comparison)
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(salesOrdersTable)
      .where(
        and(
          sql`${salesOrdersTable.status} NOT IN ('cancelled')`,
          gte(salesOrdersTable.createdAt, range.start),
          lte(salesOrdersTable.createdAt, range.end)
        )
      ),

    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.active, "true"),
          sql`${productsTable.currentStock} <= ${productsTable.minStock}`
        )
      ),

    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(purchaseOrdersTable)
      .where(sql`${purchaseOrdersTable.status} IN ('draft', 'sent')`),

    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(employeesTable)
      .where(eq(employeesTable.status, "active")),

    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(projectsTable)
      .where(eq(projectsTable.status, "active")),
  ]);

  const revenueTotal = revenueRow[0]?.total ?? "0";
  const expenseTotal = expenseRow[0]?.total ?? "0";
  const netBalance = (parseFloat(revenueTotal) - parseFloat(expenseTotal)).toFixed(2);

  const kpis = {
    revenueTotal,
    expenseTotal,
    netBalance,
    revenueLastPeriod: revenuePrevRow[0]?.total ?? "0",
    expenseLastPeriod: expensePrevRow[0]?.total ?? "0",
    openSalesOrders: openSalesRow[0]?.count ?? 0,
    newSalesOrders: newSalesRow[0]?.count ?? 0,
    lowStockProducts: lowStockRow[0]?.count ?? 0,
    pendingPurchaseOrders: pendingPurchaseRow[0]?.count ?? 0,
    activeEmployees: activeEmployeesRow[0]?.count ?? 0,
    activeProjects: activeProjectsRow[0]?.count ?? 0,
  };

  // ── Monthly trend — last 12 months ─────────────────────────────────────────

  const now = new Date();
  const trend12Start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [revTrend, expTrend] = await Promise.all([
    db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})::int`,
        month: sql<number>`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})::int`,
        total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text`,
      })
      .from(financialEntriesTable)
      .where(
        and(
          eq(financialEntriesTable.type, "income"),
          eq(financialEntriesTable.status, "paid"),
          gte(financialEntriesTable.paidAt, trend12Start)
        )
      )
      .groupBy(
        sql`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})`,
        sql`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})`
      ),

    db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})::int`,
        month: sql<number>`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})::int`,
        total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text`,
      })
      .from(financialEntriesTable)
      .where(
        and(
          eq(financialEntriesTable.type, "expense"),
          eq(financialEntriesTable.status, "paid"),
          gte(financialEntriesTable.paidAt, trend12Start)
        )
      )
      .groupBy(
        sql`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})`,
        sql`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})`
      ),
  ]);

  const revMap = new Map(revTrend.map((r) => [`${r.year}-${r.month}`, r.total]));
  const expMap = new Map(expTrend.map((r) => [`${r.year}-${r.month}`, r.total]));

  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${m}`;
    const rev = parseFloat(revMap.get(key) ?? "0");
    const exp = parseFloat(expMap.get(key) ?? "0");
    return {
      year: y,
      month: m,
      monthLabel: `${MONTH_LABELS[m - 1]}/${y}`,
      revenue: rev.toFixed(2),
      expense: exp.toFixed(2),
      net: (rev - exp).toFixed(2),
    };
  });

  // ── Top 5 clients ─────────────────────────────────────────────────────────

  const topClientRows = await db
    .select({
      clientId: clientsTable.id,
      clientName: clientsTable.name,
      totalRevenue: sql<string>`COALESCE(SUM(${salesOrdersTable.totalAmount}), 0)::text`,
      orderCount: sql<number>`COUNT(${salesOrdersTable.id})::int`,
    })
    .from(salesOrdersTable)
    .innerJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
    .where(
      and(
        sql`${salesOrdersTable.status} IN ('confirmed', 'delivered')`,
        gte(salesOrdersTable.createdAt, range.start),
        lte(salesOrdersTable.createdAt, range.end)
      )
    )
    .groupBy(clientsTable.id, clientsTable.name)
    .orderBy(desc(sql`SUM(${salesOrdersTable.totalAmount})`))
    .limit(5);

  // ── Top 5 products ────────────────────────────────────────────────────────

  const topProductRows = await db
    .select({
      productId: productsTable.id,
      productName: productsTable.name,
      movementCount: sql<number>`COUNT(${stockMovementsTable.id})::int`,
      netQuantity: sql<number>`COALESCE(
        SUM(CASE WHEN ${stockMovementsTable.type} = 'input' THEN ${stockMovementsTable.quantity} ELSE -${stockMovementsTable.quantity} END)
      , 0)::int`,
    })
    .from(stockMovementsTable)
    .innerJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .where(
      and(
        gte(stockMovementsTable.createdAt, range.start),
        lte(stockMovementsTable.createdAt, range.end)
      )
    )
    .groupBy(productsTable.id, productsTable.name)
    .orderBy(desc(sql`COUNT(${stockMovementsTable.id})`))
    .limit(5);

  // ── Goals & Alerts (only for this_month) ─────────────────────────────────

  let goals: {
    id: number | null;
    year: number;
    month: number;
    segment: string;
    revenueGoal: string;
    expenseGoal: string;
    salesOrdersGoal: number;
  } | null = null;

  let alerts: {
    kpi: string;
    label: string;
    progress: number;
    daysRemaining: number;
  }[] = [];

  if (period === "this_month") {
    const y = now.getFullYear();
    const m = now.getMonth() + 1; // 1-indexed
    const segmentFilter = String(req.query.segment ?? "");

    const [goalRow] = await db
      .select()
      .from(dashboardGoalsTable)
      .where(
        and(
          eq(dashboardGoalsTable.year, y),
          eq(dashboardGoalsTable.month, m),
          eq(dashboardGoalsTable.segment, segmentFilter)
        )
      )
      .limit(1);

    if (goalRow) {
      goals = {
        id: goalRow.id,
        year: goalRow.year,
        month: goalRow.month,
        segment: goalRow.segment,
        revenueGoal: goalRow.revenueGoal,
        expenseGoal: goalRow.expenseGoal,
        salesOrdersGoal: goalRow.salesOrdersGoal,
      };

      // Compute alerts: < 70% progress and <= 15 days remaining in month
      const daysInMonth = new Date(y, m, 0).getDate();
      const daysRemaining = daysInMonth - now.getDate();

      if (daysRemaining <= 15) {
        const revGoal = parseFloat(goalRow.revenueGoal);
        const expGoal = parseFloat(goalRow.expenseGoal);
        const soGoal = goalRow.salesOrdersGoal;

        if (revGoal > 0) {
          const revProgress = (parseFloat(revenueTotal) / revGoal) * 100;
          if (revProgress < 70) {
            alerts.push({
              kpi: "revenue",
              label: "Receita",
              progress: Math.round(revProgress * 10) / 10,
              daysRemaining,
            });
          }
        }

        if (expGoal > 0) {
          const expProgress = (parseFloat(expenseTotal) / expGoal) * 100;
          if (expProgress < 70) {
            alerts.push({
              kpi: "expense",
              label: "Despesas",
              progress: Math.round(expProgress * 10) / 10,
              daysRemaining,
            });
          }
        }

        if (soGoal > 0) {
          // Use newSalesOrders (period-bounded new orders) for goal comparison — not the open backlog
          const soProgress = ((newSalesRow[0]?.count ?? 0) / soGoal) * 100;
          if (soProgress < 70) {
            alerts.push({
              kpi: "salesOrders",
              label: "Novos Pedidos no Mês",
              progress: Math.round(soProgress * 10) / 10,
              daysRemaining,
            });
          }
        }
      }
    }
  }

  res.json({
    period,
    periodLabel: range.label,
    kpis,
    monthlyTrend,
    topClients: topClientRows,
    topProducts: topProductRows,
    goals,
    alerts,
  });
});

// ─── Goals History ────────────────────────────────────────────────────────────

router.get("/relatorios/goals/history", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const monthsParam = parseInt(String(req.query.months ?? "12"), 10);
  const months = Math.min(Math.max(isNaN(monthsParam) ? 12 : monthsParam, 1), 24);
  const segment = String(req.query.segment ?? "");

  const now = new Date();
  const historyStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  // Fetch all goals rows for the window, joined with user names
  const goalRows = await db
    .select({
      id: dashboardGoalsTable.id,
      year: dashboardGoalsTable.year,
      month: dashboardGoalsTable.month,
      segment: dashboardGoalsTable.segment,
      revenueGoal: dashboardGoalsTable.revenueGoal,
      expenseGoal: dashboardGoalsTable.expenseGoal,
      salesOrdersGoal: dashboardGoalsTable.salesOrdersGoal,
      updatedBy: dashboardGoalsTable.updatedBy,
      updatedAt: dashboardGoalsTable.updatedAt,
      updatedByName: usersTable.name,
    })
    .from(dashboardGoalsTable)
    .leftJoin(usersTable, eq(dashboardGoalsTable.updatedBy, usersTable.id))
    .where(
      and(
        eq(dashboardGoalsTable.segment, segment),
        sql`(${dashboardGoalsTable.year} * 100 + ${dashboardGoalsTable.month}) >= ${historyStart.getFullYear() * 100 + (historyStart.getMonth() + 1)} AND (${dashboardGoalsTable.year} * 100 + ${dashboardGoalsTable.month}) <= ${now.getFullYear() * 100 + (now.getMonth() + 1)}`
      )
    );

  const goalsMap = new Map(goalRows.map((r) => [`${r.year}-${r.month}`, r]));

  // Fetch actual revenue per month
  const [revActual, expActual, soActual] = await Promise.all([
    db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})::int`,
        month: sql<number>`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})::int`,
        total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text`,
      })
      .from(financialEntriesTable)
      .where(
        and(
          eq(financialEntriesTable.type, "income"),
          eq(financialEntriesTable.status, "paid"),
          gte(financialEntriesTable.paidAt, historyStart)
        )
      )
      .groupBy(
        sql`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})`,
        sql`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})`
      ),

    db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})::int`,
        month: sql<number>`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})::int`,
        total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text`,
      })
      .from(financialEntriesTable)
      .where(
        and(
          eq(financialEntriesTable.type, "expense"),
          eq(financialEntriesTable.status, "paid"),
          gte(financialEntriesTable.paidAt, historyStart)
        )
      )
      .groupBy(
        sql`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})`,
        sql`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})`
      ),

    db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${salesOrdersTable.createdAt})::int`,
        month: sql<number>`EXTRACT(MONTH FROM ${salesOrdersTable.createdAt})::int`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(salesOrdersTable)
      .where(
        and(
          sql`${salesOrdersTable.status} NOT IN ('cancelled')`,
          gte(salesOrdersTable.createdAt, historyStart)
        )
      )
      .groupBy(
        sql`EXTRACT(YEAR FROM ${salesOrdersTable.createdAt})`,
        sql`EXTRACT(MONTH FROM ${salesOrdersTable.createdAt})`
      ),
  ]);

  const revMap = new Map(revActual.map((r) => [`${r.year}-${r.month}`, r.total]));
  const expMap = new Map(expActual.map((r) => [`${r.year}-${r.month}`, r.total]));
  const soMap = new Map(soActual.map((r) => [`${r.year}-${r.month}`, r.count]));

  const history = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${m}`;
    const goal = goalsMap.get(key);

    return {
      year: y,
      month: m,
      segment,
      monthLabel: `${MONTH_LABELS[m - 1]}/${y}`,
      revenueGoal: goal?.revenueGoal ?? "0",
      revenueActual: revMap.get(key) ?? "0",
      expenseGoal: goal?.expenseGoal ?? "0",
      expenseActual: expMap.get(key) ?? "0",
      salesOrdersGoal: goal?.salesOrdersGoal ?? 0,
      salesOrdersActual: soMap.get(key) ?? 0,
      hasGoal: goal != null,
      updatedBy: goal?.updatedBy ?? null,
      updatedByName: goal?.updatedByName ?? null,
      updatedAt: goal?.updatedAt?.toISOString() ?? null,
    };
  });

  res.json(history);
});

// ─── Goals: GET all months for a year ────────────────────────────────────────

router.get("/relatorios/goals/year/:year", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const year = parseInt(req.params.year as string, 10);
  if (isNaN(year) || year < 2000 || year > 2100) {
    res.status(400).json({ error: "Ano inválido" });
    return;
  }

  const segment = String(req.query.segment ?? "");

  const rows = await db
    .select()
    .from(dashboardGoalsTable)
    .where(
      and(
        eq(dashboardGoalsTable.year, year),
        eq(dashboardGoalsTable.segment, segment)
      )
    );

  // Return one entry per month (1–12); months without a row return null
  const goalsByMonth: (typeof rows[number] | null)[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return rows.find((r) => r.month === m) ?? null;
  });

  const result = goalsByMonth.map((row, i) => ({
    month: i + 1,
    segment,
    hasGoal: row != null,
    revenueGoal: row?.revenueGoal ?? "0",
    expenseGoal: row?.expenseGoal ?? "0",
    salesOrdersGoal: row?.salesOrdersGoal ?? 0,
  }));

  res.json({ year, months: result });
});

// ─── Goals: Bulk upsert (annual planning) ─────────────────────────────────────

router.put("/relatorios/goals/bulk/:year", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const year = parseInt(req.params.year as string, 10);
  if (isNaN(year) || year < 2000 || year > 2100) {
    res.status(400).json({ error: "Ano inválido" });
    return;
  }

  const { months, segment: bodySegment } = req.body as {
    months?: { month: number; revenueGoal: string; expenseGoal: string; salesOrdersGoal: number; segment?: string }[];
    segment?: string;
  };

  if (!Array.isArray(months) || months.length === 0) {
    res.status(400).json({ error: "Campo obrigatório: months (array)" });
    return;
  }

  const bulkSegment = String(bodySegment ?? "");

  for (const entry of months) {
    const m = Number(entry.month);
    if (isNaN(m) || m < 1 || m > 12) {
      res.status(400).json({ error: `Mês inválido: ${entry.month}` });
      return;
    }
    if (entry.revenueGoal === undefined || entry.expenseGoal === undefined || entry.salesOrdersGoal === undefined) {
      res.status(400).json({ error: `Campos obrigatórios por mês: revenueGoal, expenseGoal, salesOrdersGoal (mês ${m})` });
      return;
    }
  }

  const userId = req.session.userId ?? null;

  const [updater] = userId
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1)
    : [];

  const saved = await Promise.all(
    months.map(async (entry) => {
      const entrySegment = String(entry.segment ?? bulkSegment);
      const [upserted] = await db
        .insert(dashboardGoalsTable)
        .values({
          year,
          month: entry.month,
          segment: entrySegment,
          revenueGoal: String(entry.revenueGoal),
          expenseGoal: String(entry.expenseGoal),
          salesOrdersGoal: Number(entry.salesOrdersGoal),
          updatedBy: userId,
        })
        .onConflictDoUpdate({
          target: [dashboardGoalsTable.year, dashboardGoalsTable.month, dashboardGoalsTable.segment],
          set: {
            revenueGoal: String(entry.revenueGoal),
            expenseGoal: String(entry.expenseGoal),
            salesOrdersGoal: Number(entry.salesOrdersGoal),
            updatedBy: userId,
            updatedAt: new Date(),
          },
        })
        .returning();
      return {
        id: upserted.id,
        year: upserted.year,
        month: upserted.month,
        segment: upserted.segment,
        revenueGoal: upserted.revenueGoal,
        expenseGoal: upserted.expenseGoal,
        salesOrdersGoal: upserted.salesOrdersGoal,
        updatedBy: upserted.updatedBy ?? null,
        updatedByName: updater?.name ?? null,
        updatedAt: upserted.updatedAt?.toISOString() ?? null,
      };
    })
  );

  res.json({ year, saved });
});

// ─── Goals: GET ────────────────────────────────────────────────────────────

router.get("/relatorios/goals/:year/:month", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const year = parseInt(req.params.year as string, 10);
  const month = parseInt(req.params.month as string, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: "Ano ou mês inválido" });
    return;
  }

  const segment = String(req.query.segment ?? "");

  const rows = await db
    .select({
      id: dashboardGoalsTable.id,
      year: dashboardGoalsTable.year,
      month: dashboardGoalsTable.month,
      segment: dashboardGoalsTable.segment,
      revenueGoal: dashboardGoalsTable.revenueGoal,
      expenseGoal: dashboardGoalsTable.expenseGoal,
      salesOrdersGoal: dashboardGoalsTable.salesOrdersGoal,
      updatedBy: dashboardGoalsTable.updatedBy,
      updatedAt: dashboardGoalsTable.updatedAt,
      updatedByName: usersTable.name,
    })
    .from(dashboardGoalsTable)
    .leftJoin(usersTable, eq(dashboardGoalsTable.updatedBy, usersTable.id))
    .where(
      and(
        eq(dashboardGoalsTable.year, year),
        eq(dashboardGoalsTable.month, month),
        eq(dashboardGoalsTable.segment, segment)
      )
    )
    .limit(1);

  const row = rows[0];

  if (!row) {
    res.json({
      id: null,
      year,
      month,
      segment,
      revenueGoal: "0",
      expenseGoal: "0",
      salesOrdersGoal: 0,
      updatedBy: null,
      updatedByName: null,
      updatedAt: null,
    });
    return;
  }

  res.json({
    id: row.id,
    year: row.year,
    month: row.month,
    segment: row.segment,
    revenueGoal: row.revenueGoal,
    expenseGoal: row.expenseGoal,
    salesOrdersGoal: row.salesOrdersGoal,
    updatedBy: row.updatedBy ?? null,
    updatedByName: row.updatedByName ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  });
});

// ─── Goals: PUT (admin and manager) ──────────────────────────────────────────

router.put("/relatorios/goals/:year/:month", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const year = parseInt(req.params.year as string, 10);
  const month = parseInt(req.params.month as string, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: "Ano ou mês inválido" });
    return;
  }

  const { revenueGoal, expenseGoal, salesOrdersGoal, segment: bodySegment } = req.body as {
    revenueGoal?: string;
    expenseGoal?: string;
    salesOrdersGoal?: number;
    segment?: string;
  };

  if (revenueGoal === undefined || expenseGoal === undefined || salesOrdersGoal === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: revenueGoal, expenseGoal, salesOrdersGoal" });
    return;
  }

  const segment = String(bodySegment ?? "");
  const userId = req.session.userId ?? null;

  const [upserted] = await db
    .insert(dashboardGoalsTable)
    .values({
      year,
      month,
      segment,
      revenueGoal: String(revenueGoal),
      expenseGoal: String(expenseGoal),
      salesOrdersGoal: Number(salesOrdersGoal),
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: [dashboardGoalsTable.year, dashboardGoalsTable.month, dashboardGoalsTable.segment],
      set: {
        revenueGoal: String(revenueGoal),
        expenseGoal: String(expenseGoal),
        salesOrdersGoal: Number(salesOrdersGoal),
        updatedBy: userId,
        updatedAt: new Date(),
      },
    })
    .returning();

  const [updater] = userId
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1)
    : [];

  res.json({
    id: upserted.id,
    year: upserted.year,
    month: upserted.month,
    segment: upserted.segment,
    revenueGoal: upserted.revenueGoal,
    expenseGoal: upserted.expenseGoal,
    salesOrdersGoal: upserted.salesOrdersGoal,
    updatedBy: upserted.updatedBy ?? null,
    updatedByName: updater?.name ?? null,
    updatedAt: upserted.updatedAt?.toISOString() ?? null,
  });
});

// ─── Send report by email ─────────────────────────────────────────────────────

router.post("/relatorios/send-email", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const { recipients, subject, message, period } = req.body as {
    recipients?: string[];
    subject?: string;
    message?: string;
    period?: Period;
  };

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    res.status(400).json({ error: "Informe ao menos um destinatário" });
    return;
  }
  if (!subject || typeof subject !== "string" || subject.trim() === "") {
    res.status(400).json({ error: "Assunto é obrigatório" });
    return;
  }

  const validPeriods: Period[] = ["this_month", "last_month", "this_quarter", "this_year"];
  const safePeriod: Period = validPeriods.includes(period as Period) ? (period as Period) : "this_month";

  if (!isSmtpConfigured()) {
    res.status(400).json({
      error: "Serviço de e-mail não configurado. Configure as variáveis SMTP_HOST, SMTP_USER e SMTP_PASS.",
    });
    return;
  }

  const range = getDateRange(safePeriod);
  const periodLabel = range.label;
  const recipientsStr = recipients.join(", ");

  try {
    const pdfBuffer = await buildReportPdf(safePeriod);
    const filename = `relatorio-executivo-${periodLabel.toLowerCase().replace(/\//g, "-")}.pdf`;

    await sendEmail({
      to: recipientsStr,
      subject: subject.trim(),
      text: message?.trim() || "Segue em anexo o relatório executivo gerado pelo NEXUS ERP.",
      attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
    });

    await db.insert(reportSendLogsTable).values({
      triggerType: "manual",
      period: safePeriod,
      periodLabel,
      recipients: recipientsStr,
      status: "success",
    });

    res.json({ sent: true, recipients });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Failed to send report email");

    await db.insert(reportSendLogsTable).values({
      triggerType: "manual",
      period: safePeriod,
      periodLabel,
      recipients: recipientsStr,
      status: "error",
      errorMessage: errMsg,
    }).catch(() => {});

    res.status(500).json({ error: `Falha ao enviar e-mail: ${errMsg}` });
  }
});

// ─── Report Schedules: CRUD ───────────────────────────────────────────────────

router.get("/relatorios/schedules", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const schedules = await db
    .select()
    .from(reportSchedulesTable)
    .orderBy(reportSchedulesTable.id);

  res.json(schedules);
});

router.post("/relatorios/schedules", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdminAsync(req, res)) return;

  const body = req.body as {
    frequency?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    hour?: number;
    minute?: number;
    period?: string;
    recipients?: string;
    subject?: string;
    message?: string;
    active?: boolean;
    modules?: string[];
  };

  const { frequency, hour, minute, period, recipients, subject } = body;

  if (!frequency || !["weekly", "monthly"].includes(frequency)) {
    res.status(400).json({ error: "frequency deve ser weekly ou monthly" });
    return;
  }
  if (hour === undefined || hour < 0 || hour > 23) {
    res.status(400).json({ error: "hour deve ser entre 0 e 23" });
    return;
  }
  if (minute === undefined || minute < 0 || minute > 59) {
    res.status(400).json({ error: "minute deve ser entre 0 e 59" });
    return;
  }
  if (!period || !["this_month", "last_month", "this_quarter", "this_year"].includes(period)) {
    res.status(400).json({ error: "period inválido" });
    return;
  }
  if (!recipients || typeof recipients !== "string" || recipients.trim() === "") {
    res.status(400).json({ error: "recipients é obrigatório" });
    return;
  }
  if (!subject || typeof subject !== "string" || subject.trim() === "") {
    res.status(400).json({ error: "subject é obrigatório" });
    return;
  }
  if (frequency === "weekly" && (body.dayOfWeek === undefined || body.dayOfWeek < 0 || body.dayOfWeek > 6)) {
    res.status(400).json({ error: "dayOfWeek deve ser entre 0 (Dom) e 6 (Sáb) para frequência semanal" });
    return;
  }
  if (frequency === "monthly" && (body.dayOfMonth === undefined || body.dayOfMonth < 1 || body.dayOfMonth > 28)) {
    res.status(400).json({ error: "dayOfMonth deve ser entre 1 e 28 para frequência mensal" });
    return;
  }
  const VALID_MODULES = ["financeiro", "vendas", "estoque", "compras", "rh", "projetos"] as const;
  if (Array.isArray(body.modules) && body.modules.length > 0) {
    const invalid = body.modules.filter((m: string) => !(VALID_MODULES as readonly string[]).includes(m));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Módulos inválidos: ${invalid.join(", ")}` });
      return;
    }
  }

  const [created] = await db.insert(reportSchedulesTable).values({
    frequency: frequency as "weekly" | "monthly",
    dayOfWeek: frequency === "weekly" ? body.dayOfWeek : null,
    dayOfMonth: frequency === "monthly" ? body.dayOfMonth : null,
    hour,
    minute,
    period: period as "this_month" | "last_month" | "this_quarter" | "this_year",
    recipients: recipients.trim(),
    subject: subject.trim(),
    message: body.message?.trim() || null,
    active: body.active !== false,
    modules: Array.isArray(body.modules) && body.modules.length > 0 ? body.modules as import("@workspace/db").InsertReportSchedule["modules"] : null,
  }).returning();

  res.status(201).json(created);
});

router.put("/relatorios/schedules/:id", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdminAsync(req, res)) return;

  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "id inválido" }); return; }

  const body = req.body as {
    frequency?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    hour?: number;
    minute?: number;
    period?: string;
    recipients?: string;
    subject?: string;
    message?: string;
    active?: boolean;
    modules?: string[];
  };

  const { frequency, hour, minute, period, recipients, subject } = body;

  if (!frequency || !["weekly", "monthly"].includes(frequency)) {
    res.status(400).json({ error: "frequency deve ser weekly ou monthly" }); return;
  }
  if (hour === undefined || hour < 0 || hour > 23) {
    res.status(400).json({ error: "hour deve ser entre 0 e 23" }); return;
  }
  if (minute === undefined || minute < 0 || minute > 59) {
    res.status(400).json({ error: "minute deve ser entre 0 e 59" }); return;
  }
  if (!period || !["this_month", "last_month", "this_quarter", "this_year"].includes(period)) {
    res.status(400).json({ error: "period inválido" }); return;
  }
  if (!recipients || typeof recipients !== "string" || recipients.trim() === "") {
    res.status(400).json({ error: "recipients é obrigatório" }); return;
  }
  if (!subject || typeof subject !== "string" || subject.trim() === "") {
    res.status(400).json({ error: "subject é obrigatório" }); return;
  }
  const VALID_MODULES_PUT = ["financeiro", "vendas", "estoque", "compras", "rh", "projetos"] as const;
  if (Array.isArray(body.modules) && body.modules.length > 0) {
    const invalid = body.modules.filter((m: string) => !(VALID_MODULES_PUT as readonly string[]).includes(m));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Módulos inválidos: ${invalid.join(", ")}` }); return;
    }
  }

  const [updated] = await db
    .update(reportSchedulesTable)
    .set({
      frequency: frequency as "weekly" | "monthly",
      dayOfWeek: frequency === "weekly" ? body.dayOfWeek ?? null : null,
      dayOfMonth: frequency === "monthly" ? body.dayOfMonth ?? null : null,
      hour,
      minute,
      period: period as "this_month" | "last_month" | "this_quarter" | "this_year",
      recipients: recipients.trim(),
      subject: subject.trim(),
      message: body.message?.trim() || null,
      active: body.active !== false,
      modules: Array.isArray(body.modules) && body.modules.length > 0 ? body.modules as import("@workspace/db").InsertReportSchedule["modules"] : null,
      updatedAt: new Date(),
    })
    .where(eq(reportSchedulesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }

  res.json(updated);
});

router.delete("/relatorios/schedules/:id", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdminAsync(req, res)) return;

  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "id inválido" }); return; }

  const [deleted] = await db
    .delete(reportSchedulesTable)
    .where(eq(reportSchedulesTable.id, id))
    .returning({ id: reportSchedulesTable.id });

  if (!deleted) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }

  res.json({ success: true });
});

// ─── Goal Alert Settings ───────────────────────────────────────────────────────

async function getOrInitGoalAlertSettings() {
  const [existing] = await db.select().from(goalAlertSettingsTable).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(goalAlertSettingsTable).values({}).returning();
  return created;
}

router.get("/relatorios/goal-alerts/settings", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;
  const settings = await getOrInitGoalAlertSettings();
  res.json({
    id: settings.id,
    enabled: settings.enabled,
    notifyHour: settings.notifyHour,
    notifyMinute: settings.notifyMinute,
    progressThreshold: settings.progressThreshold,
    daysRemainingThreshold: settings.daysRemainingThreshold,
    customRecipients: settings.customRecipients,
    lastSentDate: settings.lastSentDate,
    updatedAt: settings.updatedAt,
  });
});

router.put("/relatorios/goal-alerts/settings", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdminAsync(req, res)) return;

  const body = req.body as {
    enabled?: boolean;
    notifyHour?: number;
    notifyMinute?: number;
    progressThreshold?: number;
    daysRemainingThreshold?: number;
    customRecipients?: string | null;
  };

  const { enabled, notifyHour, notifyMinute, progressThreshold, daysRemainingThreshold, customRecipients } = body;

  if (notifyHour !== undefined && (notifyHour < 0 || notifyHour > 23)) {
    res.status(400).json({ error: "notifyHour deve ser entre 0 e 23" }); return;
  }
  if (notifyMinute !== undefined && (notifyMinute < 0 || notifyMinute > 59)) {
    res.status(400).json({ error: "notifyMinute deve ser entre 0 e 59" }); return;
  }
  if (progressThreshold !== undefined && (progressThreshold < 1 || progressThreshold > 99)) {
    res.status(400).json({ error: "progressThreshold deve ser entre 1 e 99" }); return;
  }
  if (daysRemainingThreshold !== undefined && (daysRemainingThreshold < 1 || daysRemainingThreshold > 28)) {
    res.status(400).json({ error: "daysRemainingThreshold deve ser entre 1 e 28" }); return;
  }

  if (customRecipients != null && customRecipients.trim() !== "") {
    const emails = customRecipients.split(",").map((e) => e.trim()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emails.filter((e) => !emailRegex.test(e));
    if (invalid.length > 0) {
      res.status(400).json({ error: `E-mails inválidos: ${invalid.join(", ")}` }); return;
    }
  }

  const settings = await getOrInitGoalAlertSettings();

  const [updated] = await db
    .update(goalAlertSettingsTable)
    .set({
      ...(enabled !== undefined && { enabled }),
      ...(notifyHour !== undefined && { notifyHour }),
      ...(notifyMinute !== undefined && { notifyMinute }),
      ...(progressThreshold !== undefined && { progressThreshold }),
      ...(daysRemainingThreshold !== undefined && { daysRemainingThreshold }),
      ...("customRecipients" in body && {
        customRecipients: customRecipients?.trim() || null,
      }),
      updatedAt: new Date(),
    })
    .where(eq(goalAlertSettingsTable.id, settings.id))
    .returning();

  res.json({
    id: updated.id,
    enabled: updated.enabled,
    notifyHour: updated.notifyHour,
    notifyMinute: updated.notifyMinute,
    progressThreshold: updated.progressThreshold,
    daysRemainingThreshold: updated.daysRemainingThreshold,
    customRecipients: updated.customRecipients,
    lastSentDate: updated.lastSentDate,
    updatedAt: updated.updatedAt,
  });
});

// ─── Goal Alert Logs ──────────────────────────────────────────────────────────

router.get("/relatorios/goal-alerts/logs", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);

  const logs = await db
    .select()
    .from(goalAlertLogsTable)
    .orderBy(desc(goalAlertLogsTable.sentAt))
    .limit(limit);

  res.json(logs);
});

// ─── Preview PDF (GET, inline) ────────────────────────────────────────────────

router.get("/relatorios/preview", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const validPeriods: Period[] = ["this_month", "last_month", "this_quarter", "this_year"];
  const period = req.query.period as Period;
  const safePeriod: Period = validPeriods.includes(period) ? period : "this_month";

  const companyName = typeof req.query.companyName === "string" ? req.query.companyName : undefined;
  const includeHeader = req.query.includeHeader !== "false";

  try {
    const pdfBuffer = await buildReportPdf(safePeriod, {
      companyName,
      logoBase64: null,
      includeHeader,
    });

    const range = getDateRange(safePeriod);
    const slug = range.label.toLowerCase().replace(/\//g, "-").replace(/\s+/g, "-");
    const filename = `relatorio-executivo-${slug}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.send(pdfBuffer);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to generate preview PDF");
    res.status(500).json({ error: "Falha ao gerar pré-visualização do PDF" });
  }
});

// ─── Export PDF ───────────────────────────────────────────────────────────────

router.post("/relatorios/export-pdf", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const { period, companyName, logoBase64, includeHeader } = req.body as {
    period?: Period;
    companyName?: string;
    logoBase64?: string | null;
    includeHeader?: boolean;
  };

  const validPeriods: Period[] = ["this_month", "last_month", "this_quarter", "this_year"];
  const safePeriod: Period = validPeriods.includes(period as Period) ? (period as Period) : "this_month";

  try {
    const pdfBuffer = await buildReportPdf(safePeriod, {
      companyName: companyName ?? undefined,
      logoBase64: logoBase64 ?? null,
      includeHeader: includeHeader !== false,
    });

    const range = getDateRange(safePeriod);
    const slug = range.label.toLowerCase().replace(/\//g, "-").replace(/\s+/g, "-");
    const filename = `relatorio-executivo-${slug}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.send(pdfBuffer);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to generate PDF");
    res.status(500).json({ error: "Falha ao gerar PDF" });
  }
});

// ─── Report Send Logs ─────────────────────────────────────────────────────────

router.get("/relatorios/send-logs", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);

  const logs = await db
    .select()
    .from(reportSendLogsTable)
    .orderBy(desc(reportSendLogsTable.sentAt))
    .limit(limit);

  res.json(logs);
});

export default router;
