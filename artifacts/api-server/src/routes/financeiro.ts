import { Router, type IRouter } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
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

  const rows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM due_date)::int`,
      year: sql<number>`EXTRACT(YEAR FROM due_date)::int`,
      type: financialEntriesTable.type,
      total: sql<number>`COALESCE(SUM(amount::numeric), 0)`,
    })
    .from(financialEntriesTable)
    .where(
      and(
        sql`EXTRACT(YEAR FROM due_date) = ${year}`,
        eq(financialEntriesTable.status, "paid"),
      ),
    )
    .groupBy(
      sql`EXTRACT(MONTH FROM due_date)`,
      sql`EXTRACT(YEAR FROM due_date)`,
      financialEntriesTable.type,
    )
    .orderBy(sql`EXTRACT(MONTH FROM due_date)`);

  const monthMap: Record<number, { month: number; year: number; income: number; expense: number }> = {};
  for (let m = 1; m <= 12; m++) {
    monthMap[m] = { month: m, year, income: 0, expense: 0 };
  }

  for (const row of rows) {
    const m = monthMap[row.month];
    if (!m) continue;
    if (row.type === "income") m.income = Number(row.total);
    else m.expense = Number(row.total);
  }

  const result = Object.values(monthMap).map((m) => ({
    ...m,
    balance: m.income - m.expense,
  }));

  res.json(result);
});

export default router;
