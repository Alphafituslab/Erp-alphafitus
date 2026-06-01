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
} from "@workspace/db";
import type { Request, Response } from "express";

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
  // role may be absent in pre-existing sessions — backfill from DB
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
    req.session.role = role; // cache for next request
  }
  if (role !== "admin" && role !== "manager") {
    res.status(403).json({ error: "Acesso restrito a gestores e administradores" });
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
      // last day of previous month at 23:59:59.999 (fully inclusive)
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

  // ── KPIs — run all counts/sums in parallel ─────────────────────────────────

  const [
    revenueRow,
    expenseRow,
    revenuePrevRow,
    expensePrevRow,
    openSalesRow,
    lowStockRow,
    pendingPurchaseRow,
    activeEmployeesRow,
    activeProjectsRow,
  ] = await Promise.all([
    // Revenue (paid income in period)
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

    // Expense (paid expense in period)
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

    // Revenue previous period
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

    // Expense previous period
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

    // Open sales orders (draft + confirmed)
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(salesOrdersTable)
      .where(sql`${salesOrdersTable.status} IN ('draft', 'confirmed')`),

    // Low stock products (currentStock <= minStock)
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.active, "true"),
          sql`${productsTable.currentStock} <= ${productsTable.minStock}`
        )
      ),

    // Pending purchase orders (draft + sent)
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(purchaseOrdersTable)
      .where(sql`${purchaseOrdersTable.status} IN ('draft', 'sent')`),

    // Active employees
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(employeesTable)
      .where(eq(employeesTable.status, "active")),

    // Active projects
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

  // Build map for fast lookup
  const revMap = new Map(revTrend.map((r) => [`${r.year}-${r.month}`, r.total]));
  const expMap = new Map(expTrend.map((r) => [`${r.year}-${r.month}`, r.total]));

  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1; // 1-indexed
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

  // ── Top 5 clients by sales revenue within selected period ────────────────

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

  // ── Top 5 products by stock movement count within selected period ─────────

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

  res.json({
    period,
    periodLabel: range.label,
    kpis,
    monthlyTrend,
    topClients: topClientRows,
    topProducts: topProductRows,
  });
});

export default router;
