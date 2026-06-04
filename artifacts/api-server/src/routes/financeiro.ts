import { Router, type IRouter } from "express";
import { and, eq, gte, lte, lt, sql } from "drizzle-orm";
import { db, financialEntriesTable } from "@workspace/db";
import {
  CreateFinancialEntryBody,
  UpdateFinancialEntryBody,
  MarkFinancialEntryPaidBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any): boolean {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  return true;
}

router.get("/financeiro/entries", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  // #10 — lazily mark pending entries whose due date has passed as "overdue"
  await db
    .update(financialEntriesTable)
    .set({ status: "overdue" })
    .where(and(eq(financialEntriesTable.status, "pending"), lt(financialEntriesTable.dueDate, new Date())));

  const { type, status, category, startDate, endDate } = req.query as Record<string, string>;

  const filters = [];
  if (type) filters.push(eq(financialEntriesTable.type, type));
  if (status) filters.push(eq(financialEntriesTable.status, status));
  if (category) filters.push(eq(financialEntriesTable.category, category));
  if (startDate) filters.push(gte(financialEntriesTable.dueDate, new Date(startDate)));
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filters.push(lte(financialEntriesTable.dueDate, end));
  }

  const entries = await db
    .select()
    .from(financialEntriesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(financialEntriesTable.dueDate);

  res.json(entries);
});

router.post("/financeiro/entries", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const parsed = CreateFinancialEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { dueDate, ...rest } = parsed.data;
  const [entry] = await db
    .insert(financialEntriesTable)
    .values({ ...rest, dueDate: new Date(dueDate) })
    .returning();

  res.status(201).json(entry);
});

router.put("/financeiro/entries/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const parsed = UpdateFinancialEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { dueDate, ...rest } = parsed.data;
  const [entry] = await db
    .update(financialEntriesTable)
    .set({ ...rest, dueDate: new Date(dueDate) })
    .where(eq(financialEntriesTable.id, id))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Lançamento não encontrado" });
    return;
  }

  res.json(entry);
});

router.delete("/financeiro/entries/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [deleted] = await db
    .delete(financialEntriesTable)
    .where(eq(financialEntriesTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Lançamento não encontrado" });
    return;
  }

  res.json({ ok: true });
});

router.post("/financeiro/entries/:id/pay", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const parsed = MarkFinancialEntryPaidBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();

  const [entry] = await db
    .update(financialEntriesTable)
    .set({ status: "paid", paidAt })
    .where(eq(financialEntriesTable.id, id))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Lançamento não encontrado" });
    return;
  }

  res.json(entry);
});

router.get("/financeiro/cashflow", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()));
  const initialBalance = parseFloat((req.query.initialBalance as string) ?? "0") || 0;

  // Realized: paid entries
  const realizedRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM due_date)::int`,
      type: financialEntriesTable.type,
      total: sql<number>`COALESCE(SUM(amount::numeric), 0)`,
    })
    .from(financialEntriesTable)
    .where(and(sql`EXTRACT(YEAR FROM due_date) = ${year}`, eq(financialEntriesTable.status, "paid")))
    .groupBy(sql`EXTRACT(MONTH FROM due_date)`, financialEntriesTable.type)
    .orderBy(sql`EXTRACT(MONTH FROM due_date)`);

  // Projected: pending + overdue entries
  const projectedRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM due_date)::int`,
      type: financialEntriesTable.type,
      total: sql<number>`COALESCE(SUM(amount::numeric), 0)`,
    })
    .from(financialEntriesTable)
    .where(
      and(
        sql`EXTRACT(YEAR FROM due_date) = ${year}`,
        sql`status IN ('pending', 'overdue')`,
      ),
    )
    .groupBy(sql`EXTRACT(MONTH FROM due_date)`, financialEntriesTable.type)
    .orderBy(sql`EXTRACT(MONTH FROM due_date)`);

  type MonthData = {
    month: number; year: number;
    incomeRealized: number; expenseRealized: number;
    incomeProjected: number; expenseProjected: number;
  };
  const monthMap: Record<number, MonthData> = {};
  for (let m = 1; m <= 12; m++) {
    monthMap[m] = { month: m, year, incomeRealized: 0, expenseRealized: 0, incomeProjected: 0, expenseProjected: 0 };
  }
  for (const row of realizedRows) {
    const m = monthMap[row.month];
    if (!m) continue;
    if (row.type === "income") m.incomeRealized = Number(row.total);
    else m.expenseRealized = Number(row.total);
  }
  for (const row of projectedRows) {
    const m = monthMap[row.month];
    if (!m) continue;
    if (row.type === "income") m.incomeProjected = Number(row.total);
    else m.expenseProjected = Number(row.total);
  }

  let cumRealized = initialBalance;
  let cumProjected = initialBalance;
  const result = Object.values(monthMap).map((m) => {
    const balance = m.incomeRealized - m.expenseRealized;
    cumRealized += balance;
    cumProjected += balance + m.incomeProjected - m.expenseProjected;
    return {
      month: m.month, year: m.year,
      income: m.incomeRealized,     // backward compat
      expense: m.expenseRealized,   // backward compat
      balance,
      incomeRealized: m.incomeRealized,
      expenseRealized: m.expenseRealized,
      incomeProjected: m.incomeProjected,
      expenseProjected: m.expenseProjected,
      cumulativeBalance: parseFloat(cumRealized.toFixed(2)),
      cumulativeProjected: parseFloat(cumProjected.toFixed(2)),
    };
  });

  res.json(result);
});

export default router;
