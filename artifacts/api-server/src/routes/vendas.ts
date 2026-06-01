import { Router, type IRouter } from "express";
import { and, eq, gte, lte, like, sql, desc } from "drizzle-orm";
import { db, clientsTable, salesOrdersTable, salesOrderItemsTable, productsTable } from "@workspace/db";
import type { Request, Response } from "express";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  return true;
}

function parseId(param: string | string[], res: Response): number | null {
  const id = parseInt(Array.isArray(param) ? param[0]! : param);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return null;
  }
  return id;
}

// ─── Clients ──────────────────────────────────────────────────────────────────

router.get("/vendas/clients", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { search, active } = req.query as Record<string, string>;

  const filters = [];
  if (active !== undefined) filters.push(eq(clientsTable.active, active));
  else filters.push(eq(clientsTable.active, "true"));

  if (search) {
    filters.push(
      sql`(${clientsTable.name} ILIKE ${"%" + search + "%"} OR ${clientsTable.document} ILIKE ${"%" + search + "%"} OR ${clientsTable.email} ILIKE ${"%" + search + "%"})`
    );
  }

  const clients = await db
    .select()
    .from(clientsTable)
    .where(and(...filters))
    .orderBy(clientsTable.name);

  res.json(clients);
});

router.post("/vendas/clients", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, document, email, phone, address, city, state, notes } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [client] = await db
    .insert(clientsTable)
    .values({ name, document, email, phone, address, city, state, notes, active: "true" })
    .returning();

  res.status(201).json(client);
});

router.put("/vendas/clients/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const { name, document, email, phone, address, city, state, notes, active } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [client] = await db
    .update(clientsTable)
    .set({ name, document, email, phone, address, city, state, notes, ...(active !== undefined ? { active } : {}) })
    .where(eq(clientsTable.id, id))
    .returning();

  if (!client) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }

  res.json(client);
});

router.delete("/vendas/clients/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const [client] = await db
    .update(clientsTable)
    .set({ active: "false" })
    .where(eq(clientsTable.id, id))
    .returning();

  if (!client) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }

  res.json({ ok: true });
});

// ─── Sales Orders ──────────────────────────────────────────────────────────────

async function buildOrderResponse(order: typeof salesOrdersTable.$inferSelect) {
  const items = await db
    .select()
    .from(salesOrderItemsTable)
    .where(eq(salesOrderItemsTable.salesOrderId, order.id));

  let clientName: string | null = null;
  if (order.clientId) {
    const [c] = await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, order.clientId));
    clientName = c?.name ?? null;
  }

  return { ...order, clientName, items };
}

router.get("/vendas/orders", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { type, status, clientId, startDate, endDate } = req.query as Record<string, string>;

  const filters = [];
  if (type) filters.push(eq(salesOrdersTable.type, type));
  if (status) filters.push(eq(salesOrdersTable.status, status));
  if (clientId) filters.push(eq(salesOrdersTable.clientId, parseInt(clientId)));
  if (startDate) filters.push(gte(salesOrdersTable.createdAt, new Date(startDate)));
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filters.push(lte(salesOrdersTable.createdAt, end));
  }

  const orders = await db
    .select({
      id: salesOrdersTable.id,
      clientId: salesOrdersTable.clientId,
      clientName: clientsTable.name,
      type: salesOrdersTable.type,
      status: salesOrdersTable.status,
      totalAmount: salesOrdersTable.totalAmount,
      validUntil: salesOrdersTable.validUntil,
      notes: salesOrdersTable.notes,
      createdAt: salesOrdersTable.createdAt,
      updatedAt: salesOrdersTable.updatedAt,
    })
    .from(salesOrdersTable)
    .leftJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(salesOrdersTable.createdAt));

  res.json(orders);
});

router.post("/vendas/orders", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { clientId, type, status, validUntil, notes, items } = req.body;

  if (!type || !["quote", "order"].includes(type)) {
    res.status(400).json({ error: "Tipo inválido (quote ou order)" });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Pelo menos um item é obrigatório" });
    return;
  }

  const totalAmount = items.reduce((sum: number, item: any) => {
    return sum + Number(item.quantity) * Number(item.unitPrice);
  }, 0);

  const [order] = await db
    .insert(salesOrdersTable)
    .values({
      clientId: clientId ? parseInt(clientId) : null,
      type,
      status: status ?? "draft",
      totalAmount: totalAmount.toFixed(2),
      validUntil: validUntil ? new Date(validUntil) : null,
      notes,
    })
    .returning();

  await db.insert(salesOrderItemsTable).values(
    items.map((item: any) => ({
      salesOrderId: order.id,
      productId: item.productId ? parseInt(item.productId) : null,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      totalPrice: (Number(item.quantity) * Number(item.unitPrice)).toFixed(2),
    }))
  );

  const clientName = clientId
    ? (await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, parseInt(clientId))))[0]?.name ?? null
    : null;

  res.status(201).json({ ...order, clientName });
});

router.get("/vendas/orders/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const [order] = await db.select().from(salesOrdersTable).where(eq(salesOrdersTable.id, id));
  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  res.json(await buildOrderResponse(order));
});

router.put("/vendas/orders/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const { clientId, type, status, validUntil, notes, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Pelo menos um item é obrigatório" });
    return;
  }

  const totalAmount = items.reduce((sum: number, item: any) => {
    return sum + Number(item.quantity) * Number(item.unitPrice);
  }, 0);

  const [order] = await db
    .update(salesOrdersTable)
    .set({
      clientId: clientId ? parseInt(clientId) : null,
      type,
      status: status ?? "draft",
      totalAmount: totalAmount.toFixed(2),
      validUntil: validUntil ? new Date(validUntil) : null,
      notes,
    })
    .where(eq(salesOrdersTable.id, id))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  // Replace items
  await db.delete(salesOrderItemsTable).where(eq(salesOrderItemsTable.salesOrderId, id));
  await db.insert(salesOrderItemsTable).values(
    items.map((item: any) => ({
      salesOrderId: id,
      productId: item.productId ? parseInt(item.productId) : null,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      totalPrice: (Number(item.quantity) * Number(item.unitPrice)).toFixed(2),
    }))
  );

  const clientName = clientId
    ? (await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, parseInt(clientId))))[0]?.name ?? null
    : null;

  res.json({ ...order, clientName });
});

router.delete("/vendas/orders/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  await db.delete(salesOrderItemsTable).where(eq(salesOrderItemsTable.salesOrderId, id));
  const [deleted] = await db.delete(salesOrdersTable).where(eq(salesOrdersTable.id, id)).returning();

  if (!deleted) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  res.json({ ok: true });
});

router.post("/vendas/orders/:id/convert", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const [order] = await db.select().from(salesOrdersTable).where(eq(salesOrdersTable.id, id));
  if (!order) {
    res.status(404).json({ error: "Orçamento não encontrado" });
    return;
  }
  if (order.type !== "quote") {
    res.status(400).json({ error: "Apenas orçamentos podem ser convertidos em pedidos" });
    return;
  }

  const [updated] = await db
    .update(salesOrdersTable)
    .set({ type: "order", status: "confirmed" })
    .where(eq(salesOrdersTable.id, id))
    .returning();

  const clientName = updated.clientId
    ? (await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, updated.clientId)))[0]?.name ?? null
    : null;

  res.json({ ...updated, clientName });
});

router.post("/vendas/orders/:id/status", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const { status } = req.body;
  if (!status || !["draft", "confirmed", "delivered", "cancelled"].includes(status)) {
    res.status(400).json({ error: "Status inválido" });
    return;
  }

  const [updated] = await db
    .update(salesOrdersTable)
    .set({ status })
    .where(eq(salesOrdersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const clientName = updated.clientId
    ? (await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, updated.clientId)))[0]?.name ?? null
    : null;

  res.json({ ...updated, clientName });
});

// ─── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/vendas/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Total this month (orders only, not cancelled)
  const [monthlyStats] = await db
    .select({
      total: sql<number>`COALESCE(SUM(total_amount::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(salesOrdersTable)
    .where(
      and(
        eq(salesOrdersTable.type, "order"),
        sql`status != 'cancelled'`,
        gte(salesOrdersTable.createdAt, monthStart),
        lte(salesOrdersTable.createdAt, monthEnd),
      )
    );

  // Conversion rate
  const [quoteStats] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(salesOrdersTable)
    .where(eq(salesOrdersTable.type, "quote"));

  const totalQuotes = Number(quoteStats?.total ?? 0);
  const ordersThisMonth = Number(monthlyStats?.count ?? 0);

  // All orders this year for conversion rate
  const [orderStats] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(salesOrdersTable)
    .where(and(eq(salesOrdersTable.type, "order"), sql`EXTRACT(YEAR FROM created_at) = ${year}`));

  const totalOrders = Number(orderStats?.total ?? 0);
  const conversionRate = totalQuotes > 0 ? Math.round((totalOrders / totalQuotes) * 100) : 0;

  // Monthly chart
  const monthlyRows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM created_at)::int`,
      year: sql<number>`EXTRACT(YEAR FROM created_at)::int`,
      total: sql<number>`COALESCE(SUM(total_amount::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(salesOrdersTable)
    .where(
      and(
        eq(salesOrdersTable.type, "order"),
        sql`status != 'cancelled'`,
        sql`EXTRACT(YEAR FROM created_at) = ${year}`,
      )
    )
    .groupBy(sql`EXTRACT(MONTH FROM created_at)`, sql`EXTRACT(YEAR FROM created_at)`)
    .orderBy(sql`EXTRACT(MONTH FROM created_at)`);

  const monthlyChart: { month: number; year: number; total: number; count: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const row = monthlyRows.find((r) => r.month === m);
    monthlyChart.push({ month: m, year, total: Number(row?.total ?? 0), count: Number(row?.count ?? 0) });
  }

  // Top clients
  const topClientsRows = await db
    .select({
      clientId: clientsTable.id,
      clientName: clientsTable.name,
      total: sql<number>`COALESCE(SUM(${salesOrdersTable.totalAmount}::numeric), 0)`,
      orderCount: sql<number>`COUNT(*)::int`,
    })
    .from(salesOrdersTable)
    .innerJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
    .where(and(eq(salesOrdersTable.type, "order"), sql`${salesOrdersTable.status} != 'cancelled'`))
    .groupBy(clientsTable.id, clientsTable.name)
    .orderBy(desc(sql`SUM(${salesOrdersTable.totalAmount}::numeric)`))
    .limit(5);

  res.json({
    totalThisMonth: Number(monthlyStats?.total ?? 0),
    ordersThisMonth,
    totalQuotes,
    conversionRate,
    monthlyChart,
    topClients: topClientsRows.map((r) => ({
      clientId: r.clientId,
      clientName: r.clientName,
      total: Number(r.total),
      orderCount: Number(r.orderCount),
    })),
  });
});

export default router;
