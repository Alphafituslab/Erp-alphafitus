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
} from "@workspace/db";
import type { Request, Response } from "express";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

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

    const [goalRow] = await db
      .select()
      .from(dashboardGoalsTable)
      .where(
        and(
          eq(dashboardGoalsTable.year, y),
          eq(dashboardGoalsTable.month, m)
        )
      )
      .limit(1);

    if (goalRow) {
      goals = {
        id: goalRow.id,
        year: goalRow.year,
        month: goalRow.month,
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

// ─── Goals: GET ────────────────────────────────────────────────────────────

router.get("/relatorios/goals/:year/:month", async (req: Request, res: Response): Promise<void> => {
  if (!await requireManagerAsync(req, res)) return;

  const year = parseInt(req.params.year as string, 10);
  const month = parseInt(req.params.month as string, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: "Ano ou mês inválido" });
    return;
  }

  const [row] = await db
    .select()
    .from(dashboardGoalsTable)
    .where(
      and(
        eq(dashboardGoalsTable.year, year),
        eq(dashboardGoalsTable.month, month)
      )
    )
    .limit(1);

  if (!row) {
    res.json({
      id: null,
      year,
      month,
      revenueGoal: "0",
      expenseGoal: "0",
      salesOrdersGoal: 0,
    });
    return;
  }

  res.json({
    id: row.id,
    year: row.year,
    month: row.month,
    revenueGoal: row.revenueGoal,
    expenseGoal: row.expenseGoal,
    salesOrdersGoal: row.salesOrdersGoal,
  });
});

// ─── Goals: PUT (admin only) ──────────────────────────────────────────────

router.put("/relatorios/goals/:year/:month", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdminAsync(req, res)) return;

  const year = parseInt(req.params.year as string, 10);
  const month = parseInt(req.params.month as string, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: "Ano ou mês inválido" });
    return;
  }

  const { revenueGoal, expenseGoal, salesOrdersGoal } = req.body as {
    revenueGoal?: string;
    expenseGoal?: string;
    salesOrdersGoal?: number;
  };

  if (revenueGoal === undefined || expenseGoal === undefined || salesOrdersGoal === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: revenueGoal, expenseGoal, salesOrdersGoal" });
    return;
  }

  const [upserted] = await db
    .insert(dashboardGoalsTable)
    .values({
      year,
      month,
      revenueGoal: String(revenueGoal),
      expenseGoal: String(expenseGoal),
      salesOrdersGoal: Number(salesOrdersGoal),
    })
    .onConflictDoUpdate({
      target: [dashboardGoalsTable.year, dashboardGoalsTable.month],
      set: {
        revenueGoal: String(revenueGoal),
        expenseGoal: String(expenseGoal),
        salesOrdersGoal: Number(salesOrdersGoal),
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json({
    id: upserted.id,
    year: upserted.year,
    month: upserted.month,
    revenueGoal: upserted.revenueGoal,
    expenseGoal: upserted.expenseGoal,
    salesOrdersGoal: upserted.salesOrdersGoal,
  });
});

// ─── Helper: generate executive report PDF on the server ──────────────────────

function fmtBRL(v: string | number | null | undefined): string {
  return parseFloat(String(v ?? "0")).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

async function buildReportPdf(period: Period): Promise<Buffer> {
  const range = getDateRange(period);
  const prevRange = getPreviousPeriodRange(period, range);
  const now = new Date();

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
    db.select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(and(eq(financialEntriesTable.type, "income"), eq(financialEntriesTable.status, "paid"), gte(financialEntriesTable.paidAt, range.start), lte(financialEntriesTable.paidAt, range.end))),
    db.select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(and(eq(financialEntriesTable.type, "expense"), eq(financialEntriesTable.status, "paid"), gte(financialEntriesTable.paidAt, range.start), lte(financialEntriesTable.paidAt, range.end))),
    db.select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(and(eq(financialEntriesTable.type, "income"), eq(financialEntriesTable.status, "paid"), gte(financialEntriesTable.paidAt, prevRange.start), lte(financialEntriesTable.paidAt, prevRange.end))),
    db.select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(and(eq(financialEntriesTable.type, "expense"), eq(financialEntriesTable.status, "paid"), gte(financialEntriesTable.paidAt, prevRange.start), lte(financialEntriesTable.paidAt, prevRange.end))),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(salesOrdersTable).where(sql`${salesOrdersTable.status} IN ('draft', 'confirmed')`),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(salesOrdersTable).where(and(sql`${salesOrdersTable.status} NOT IN ('cancelled')`, gte(salesOrdersTable.createdAt, range.start), lte(salesOrdersTable.createdAt, range.end))),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(productsTable).where(and(eq(productsTable.active, "true"), sql`${productsTable.currentStock} <= ${productsTable.minStock}`)),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(purchaseOrdersTable).where(sql`${purchaseOrdersTable.status} IN ('draft', 'sent')`),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(employeesTable).where(eq(employeesTable.status, "active")),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(projectsTable).where(eq(projectsTable.status, "active")),
  ]);

  const revenueTotal = revenueRow[0]?.total ?? "0";
  const expenseTotal = expenseRow[0]?.total ?? "0";
  const netBalance = (parseFloat(revenueTotal) - parseFloat(expenseTotal)).toFixed(2);

  const topClientRows = await db
    .select({
      clientName: clientsTable.name,
      totalRevenue: sql<string>`COALESCE(SUM(${salesOrdersTable.totalAmount}), 0)::text`,
      orderCount: sql<number>`COUNT(${salesOrdersTable.id})::int`,
    })
    .from(salesOrdersTable)
    .innerJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
    .where(and(sql`${salesOrdersTable.status} IN ('confirmed', 'delivered')`, gte(salesOrdersTable.createdAt, range.start), lte(salesOrdersTable.createdAt, range.end)))
    .groupBy(clientsTable.id, clientsTable.name)
    .orderBy(desc(sql`SUM(${salesOrdersTable.totalAmount})`))
    .limit(5);

  const topProductRows = await db
    .select({
      productName: productsTable.name,
      movementCount: sql<number>`COUNT(${stockMovementsTable.id})::int`,
    })
    .from(stockMovementsTable)
    .innerJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .where(and(gte(stockMovementsTable.createdAt, range.start), lte(stockMovementsTable.createdAt, range.end)))
    .groupBy(productsTable.id, productsTable.name)
    .orderBy(desc(sql`COUNT(${stockMovementsTable.id})`))
    .limit(5);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const blue = "#2563eb";
    const gray = "#6b7280";
    const lightGray = "#f3f4f6";
    const green = "#059669";
    const red = "#dc2626";

    // Header
    doc.rect(0, 0, doc.page.width, 70).fill(blue);
    doc.fillColor("white").fontSize(20).font("Helvetica-Bold")
      .text("NEXUS ERP — Relatório Executivo", 50, 22);
    doc.fontSize(10).font("Helvetica")
      .text(`Período: ${range.label}  |  Gerado em: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, 50, 48);

    doc.fillColor("#1f2937");
    let y = 90;

    // Section title helper
    function sectionTitle(title: string) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor(blue).text(title, 50, y);
      y += 18;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e5e7eb").lineWidth(1).stroke();
      y += 8;
    }

    // KPI row helper
    function kpiRow(label: string, value: string, sub?: string) {
      doc.fontSize(9).font("Helvetica").fillColor(gray).text(label, 50, y, { width: 200 });
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1f2937").text(value, 260, y, { width: 200 });
      if (sub) {
        doc.fontSize(9).font("Helvetica").fillColor(gray).text(sub, 460, y, { width: 85 });
      }
      y += 18;
    }

    // Financial KPIs
    sectionTitle("Indicadores Financeiros");
    const revPrev = parseFloat(revenuePrevRow[0]?.total ?? "0");
    const expPrev = parseFloat(expensePrevRow[0]?.total ?? "0");
    const revCur = parseFloat(revenueTotal);
    const expCur = parseFloat(expenseTotal);

    const revChg = revPrev > 0 ? ((revCur - revPrev) / revPrev * 100).toFixed(1) + "%" : "—";
    const expChg = expPrev > 0 ? ((expCur - expPrev) / expPrev * 100).toFixed(1) + "%" : "—";
    const net = parseFloat(netBalance);

    kpiRow("Receita (período)", fmtBRL(revenueTotal), `vs ant.: ${revChg}`);
    kpiRow("Despesas (período)", fmtBRL(expenseTotal), `vs ant.: ${expChg}`);
    kpiRow("Saldo Líquido", fmtBRL(netBalance));
    doc.fontSize(9).font("Helvetica").fillColor(net >= 0 ? green : red)
      .text(net >= 0 ? "▲ Positivo" : "▼ Negativo", 360, y - 18);

    y += 10;

    // Operational KPIs
    sectionTitle("Indicadores Operacionais");
    kpiRow("Pedidos Abertos (backlog)", String(openSalesRow[0]?.count ?? 0));
    kpiRow("Novos Pedidos no Período", String(newSalesRow[0]?.count ?? 0));
    kpiRow("Produtos com Estoque Baixo", String(lowStockRow[0]?.count ?? 0));
    kpiRow("Compras Pendentes", String(pendingPurchaseRow[0]?.count ?? 0));
    kpiRow("Funcionários Ativos", String(activeEmployeesRow[0]?.count ?? 0));
    kpiRow("Projetos Ativos", String(activeProjectsRow[0]?.count ?? 0));

    y += 10;

    // Top 5 Clients
    if (topClientRows.length > 0) {
      sectionTitle("Top 5 Clientes por Receita");
      // Table header
      doc.rect(50, y, doc.page.width - 100, 16).fill(lightGray);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(gray);
      doc.text("#", 55, y + 4);
      doc.text("Cliente", 75, y + 4, { width: 220 });
      doc.text("Pedidos", 300, y + 4, { width: 80 });
      doc.text("Receita", 390, y + 4, { width: 110 });
      y += 16;

      topClientRows.forEach((c, i) => {
        if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 16).fill("#fafafa");
        doc.fontSize(9).font("Helvetica").fillColor("#1f2937");
        doc.text(String(i + 1), 55, y + 4);
        doc.text(c.clientName, 75, y + 4, { width: 220 });
        doc.text(String(c.orderCount), 300, y + 4, { width: 80 });
        doc.text(fmtBRL(c.totalRevenue), 390, y + 4, { width: 110 });
        y += 16;
      });
      y += 8;
    }

    // Top 5 Products
    if (topProductRows.length > 0) {
      if (y > 650) { doc.addPage(); y = 50; }
      sectionTitle("Top 5 Produtos por Movimentação");
      doc.rect(50, y, doc.page.width - 100, 16).fill(lightGray);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(gray);
      doc.text("#", 55, y + 4);
      doc.text("Produto", 75, y + 4, { width: 350 });
      doc.text("Movimentações", 430, y + 4, { width: 100 });
      y += 16;

      topProductRows.forEach((p, i) => {
        if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 16).fill("#fafafa");
        doc.fontSize(9).font("Helvetica").fillColor("#1f2937");
        doc.text(String(i + 1), 55, y + 4);
        doc.text(p.productName, 75, y + 4, { width: 350 });
        doc.text(String(p.movementCount), 430, y + 4, { width: 100 });
        y += 16;
      });
    }

    // Footer
    doc.fontSize(8).font("Helvetica").fillColor(gray)
      .text("Gerado automaticamente pelo NEXUS ERP — uso interno", 50, doc.page.height - 40, { align: "center", width: doc.page.width - 100 });

    doc.end();
  });
}

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

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) {
    res.status(400).json({
      error: "Serviço de e-mail não configurado. Configure as variáveis SMTP_HOST, SMTP_USER e SMTP_PASS.",
    });
    return;
  }

  try {
    const pdfBuffer = await buildReportPdf(safePeriod);
    const range = getDateRange(safePeriod);
    const filename = `relatorio-executivo-${range.label.toLowerCase().replace(/\//g, "-")}.pdf`;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: recipients.join(", "),
      subject: subject.trim(),
      text: message?.trim() || "Segue em anexo o relatório executivo gerado pelo NEXUS ERP.",
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    res.json({ sent: true, recipients });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Failed to send report email");
    res.status(500).json({ error: `Falha ao enviar e-mail: ${errMsg}` });
  }
});

export default router;
