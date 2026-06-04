import { Router, type IRouter } from "express";
import { and, eq, gte, lte, sql, desc, isNotNull } from "drizzle-orm";
import { db, clientsTable, salesOrdersTable, salesOrderItemsTable, salesOrderLogsTable, usersTable } from "@workspace/db";
import type { Request, Response } from "express";

const router: IRouter = Router();

const ALL_STATUSES = [
  "draft", "awaiting_docs", "sent",
  "client_approved", "client_rejected",
  "credit_check", "credit_rejected",
  "financial_review", "financial_rejected",
  "technical_review", "technical_rejected",
  "regulatory_check", "pcp_released", "raw_material_check",
  "production_planned", "in_production",
  "quality_check", "quality_rejected", "quality_approved",
  "billing", "invoice_issued", "awaiting_pickup",
  "shipped", "delivered", "cancelled",
] as const;

type OrderStatus = typeof ALL_STATUSES[number];

const TERMINAL_STATUSES: OrderStatus[] = [
  "delivered", "cancelled",
  "client_rejected", "credit_rejected",
  "financial_rejected", "technical_rejected", "quality_rejected",
];

const OPEN_STATUSES = ALL_STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s as OrderStatus));

// Server-side state machine: defines allowed next statuses from each status
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft:              ["awaiting_docs", "sent", "cancelled"],
  awaiting_docs:      ["sent", "cancelled"],
  sent:               ["client_approved", "client_rejected", "cancelled"],
  client_approved:    ["credit_check", "cancelled"],
  client_rejected:    ["sent", "cancelled"],
  credit_check:       ["financial_review", "credit_rejected", "cancelled"],
  credit_rejected:    ["cancelled"],
  financial_review:   ["technical_review", "financial_rejected", "cancelled"],
  financial_rejected: ["cancelled"],
  technical_review:   ["regulatory_check", "technical_rejected", "cancelled"],
  technical_rejected: ["cancelled"],
  regulatory_check:   ["pcp_released", "cancelled"],
  pcp_released:       ["raw_material_check", "cancelled"],
  raw_material_check: ["production_planned", "cancelled"],
  production_planned: ["in_production", "cancelled"],
  in_production:      ["quality_check", "cancelled"],
  quality_check:      ["quality_approved", "quality_rejected", "cancelled"],
  quality_rejected:   ["in_production", "cancelled"],
  quality_approved:   ["billing", "cancelled"],
  billing:            ["invoice_issued", "cancelled"],
  invoice_issued:     ["awaiting_pickup", "cancelled"],
  awaiting_pickup:    ["shipped", "cancelled"],
  shipped:            ["delivered"],
  delivered:          [],
  cancelled:          [],
};

// Critical transitions that require a non-empty justification note
const REQUIRE_NOTES_FOR: Set<OrderStatus> = new Set([
  "client_rejected", "credit_rejected", "financial_rejected",
  "technical_rejected", "quality_rejected", "cancelled",
]);

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

  const {
    name, tradeName, document, stateRegistration, email, phone,
    billingZipCode, billingStreet, billingNumber, billingComplement, billingNeighborhood, billingCity, billingState,
    shippingZipCode, shippingStreet, shippingNumber, shippingComplement, shippingNeighborhood, shippingCity, shippingState,
    contactName, contactPhone, creditLimit, defaultDiscountPct, taxRegime,
    address, city, state, notes,
  } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [client] = await db
    .insert(clientsTable)
    .values({
      name, tradeName: tradeName || null, document: document || null,
      stateRegistration: stateRegistration || null,
      email: email || null, phone: phone || null,
      billingZipCode: billingZipCode || null, billingStreet: billingStreet || null,
      billingNumber: billingNumber || null, billingComplement: billingComplement || null,
      billingNeighborhood: billingNeighborhood || null, billingCity: billingCity || null,
      billingState: billingState || null,
      shippingZipCode: shippingZipCode || null, shippingStreet: shippingStreet || null,
      shippingNumber: shippingNumber || null, shippingComplement: shippingComplement || null,
      shippingNeighborhood: shippingNeighborhood || null, shippingCity: shippingCity || null,
      shippingState: shippingState || null,
      contactName: contactName || null, contactPhone: contactPhone || null,
      creditLimit: creditLimit ? String(creditLimit) : null,
      defaultDiscountPct: defaultDiscountPct ? String(defaultDiscountPct) : null,
      taxRegime: taxRegime || null,
      address: address || null, city: city || null, state: state || null,
      notes: notes || null, active: "true",
    })
    .returning();

  res.status(201).json(client);
});

router.put("/vendas/clients/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const {
    name, tradeName, document, stateRegistration, email, phone,
    billingZipCode, billingStreet, billingNumber, billingComplement, billingNeighborhood, billingCity, billingState,
    shippingZipCode, shippingStreet, shippingNumber, shippingComplement, shippingNeighborhood, shippingCity, shippingState,
    contactName, contactPhone, creditLimit, defaultDiscountPct, taxRegime,
    address, city, state, notes, active,
  } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [client] = await db
    .update(clientsTable)
    .set({
      name, tradeName: tradeName || null, document: document || null,
      stateRegistration: stateRegistration || null,
      email: email || null, phone: phone || null,
      billingZipCode: billingZipCode || null, billingStreet: billingStreet || null,
      billingNumber: billingNumber || null, billingComplement: billingComplement || null,
      billingNeighborhood: billingNeighborhood || null, billingCity: billingCity || null,
      billingState: billingState || null,
      shippingZipCode: shippingZipCode || null, shippingStreet: shippingStreet || null,
      shippingNumber: shippingNumber || null, shippingComplement: shippingComplement || null,
      shippingNeighborhood: shippingNeighborhood || null, shippingCity: shippingCity || null,
      shippingState: shippingState || null,
      contactName: contactName || null, contactPhone: contactPhone || null,
      creditLimit: creditLimit ? String(creditLimit) : null,
      defaultDiscountPct: defaultDiscountPct ? String(defaultDiscountPct) : null,
      taxRegime: taxRegime || null,
      address: address || null, city: city || null, state: state || null,
      notes: notes || null,
      ...(active !== undefined ? { active } : {}),
    })
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
      deliveryDate: salesOrdersTable.deliveryDate,
      notes: salesOrdersTable.notes,
      paymentTerms: salesOrdersTable.paymentTerms,
      commission: salesOrdersTable.commission,
      freightValue: salesOrdersTable.freightValue,
      carrier: salesOrdersTable.carrier,
      formula: salesOrdersTable.formula,
      formulaVersion: salesOrdersTable.formulaVersion,
      packagingType: salesOrdersTable.packagingType,
      labelRef: salesOrdersTable.labelRef,
      technicalNotes: salesOrdersTable.technicalNotes,
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

  const {
    clientId, type, status, validUntil, deliveryDate, notes,
    paymentTerms, commission, freightValue, carrier,
    formula, formulaVersion, packagingType, labelRef, technicalNotes,
    items,
  } = req.body;

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

  const initialStatus = status ?? "draft";

  const [order] = await db
    .insert(salesOrdersTable)
    .values({
      clientId: clientId ? parseInt(clientId) : null,
      type,
      status: initialStatus,
      totalAmount: totalAmount.toFixed(2),
      validUntil: validUntil ? new Date(validUntil) : null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      notes: notes ?? null,
      paymentTerms: paymentTerms ?? null,
      commission: commission != null ? String(commission) : null,
      freightValue: freightValue != null ? String(freightValue) : null,
      carrier: carrier ?? null,
      formula: formula ?? null,
      formulaVersion: formulaVersion ?? null,
      packagingType: packagingType ?? null,
      labelRef: labelRef ?? null,
      technicalNotes: technicalNotes ?? null,
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

  await db.insert(salesOrderLogsTable).values({
    salesOrderId: order.id,
    fromStatus: null,
    toStatus: initialStatus,
    userId: req.session.userId ?? null,
    notes: "Pedido criado",
  });

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

  const {
    clientId, type, validUntil, deliveryDate, notes,
    paymentTerms, commission, freightValue, carrier,
    formula, formulaVersion, packagingType, labelRef, technicalNotes,
    items,
  } = req.body;

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
      totalAmount: totalAmount.toFixed(2),
      validUntil: validUntil ? new Date(validUntil) : null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      notes: notes ?? null,
      paymentTerms: paymentTerms ?? null,
      commission: commission != null ? String(commission) : null,
      freightValue: freightValue != null ? String(freightValue) : null,
      carrier: carrier ?? null,
      formula: formula ?? null,
      formulaVersion: formulaVersion ?? null,
      packagingType: packagingType ?? null,
      labelRef: labelRef ?? null,
      technicalNotes: technicalNotes ?? null,
    })
    .where(eq(salesOrdersTable.id, id))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

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

  await db.delete(salesOrderLogsTable).where(eq(salesOrderLogsTable.salesOrderId, id));
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
    .set({ type: "order", status: "sent" })
    .where(eq(salesOrdersTable.id, id))
    .returning();

  await db.insert(salesOrderLogsTable).values({
    salesOrderId: id,
    fromStatus: order.status,
    toStatus: "sent",
    userId: req.session.userId ?? null,
    notes: "Orçamento convertido em pedido",
  });

  const clientName = updated.clientId
    ? (await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, updated.clientId)))[0]?.name ?? null
    : null;

  res.json({ ...updated, clientName });
});

router.post("/vendas/orders/:id/status", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const { status, notes } = req.body;
  const toStatus = status as OrderStatus;

  if (!status || !ALL_STATUSES.includes(toStatus)) {
    res.status(400).json({ error: `Status inválido.` });
    return;
  }

  const [current] = await db.select({ status: salesOrdersTable.status }).from(salesOrdersTable).where(eq(salesOrdersTable.id, id));
  if (!current) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const fromStatus = current.status as OrderStatus;

  // Enforce state machine: validate the transition is allowed
  const allowedNext = ALLOWED_TRANSITIONS[fromStatus] ?? [];
  if (!allowedNext.includes(toStatus)) {
    res.status(422).json({ error: `Transição não permitida: ${fromStatus} → ${toStatus}. Próximos válidos: ${allowedNext.join(", ") || "nenhum"}` });
    return;
  }

  // Enforce mandatory justification for critical transitions
  if (REQUIRE_NOTES_FOR.has(toStatus) && !notes?.trim()) {
    res.status(422).json({ error: "Justificativa obrigatória para esta transição." });
    return;
  }

  const [updated] = await db
    .update(salesOrdersTable)
    .set({ status: toStatus })
    .where(eq(salesOrdersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  await db.insert(salesOrderLogsTable).values({
    salesOrderId: id,
    fromStatus,
    toStatus,
    userId: req.session.userId ?? null,
    notes: notes?.trim() || null,
  });

  const clientName = updated.clientId
    ? (await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, updated.clientId)))[0]?.name ?? null
    : null;

  res.json({ ...updated, clientName });
});

router.get("/vendas/orders/:id/logs", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const [order] = await db.select({ id: salesOrdersTable.id }).from(salesOrdersTable).where(eq(salesOrdersTable.id, id));
  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const logs = await db
    .select({
      id: salesOrderLogsTable.id,
      salesOrderId: salesOrderLogsTable.salesOrderId,
      fromStatus: salesOrderLogsTable.fromStatus,
      toStatus: salesOrderLogsTable.toStatus,
      userId: salesOrderLogsTable.userId,
      userName: usersTable.name,
      notes: salesOrderLogsTable.notes,
      createdAt: salesOrderLogsTable.createdAt,
    })
    .from(salesOrderLogsTable)
    .leftJoin(usersTable, eq(salesOrderLogsTable.userId, usersTable.id))
    .where(eq(salesOrderLogsTable.salesOrderId, id))
    .orderBy(desc(salesOrderLogsTable.createdAt));

  res.json(logs);
});

// ─── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/vendas/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const CANCELLED_SQL = `status NOT IN ('cancelled', 'client_rejected', 'credit_rejected', 'financial_rejected', 'technical_rejected', 'quality_rejected')`;

  const [monthlyStats] = await db
    .select({
      total: sql<number>`COALESCE(SUM(total_amount::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(salesOrdersTable)
    .where(
      and(
        eq(salesOrdersTable.type, "order"),
        sql`${sql.raw(CANCELLED_SQL)}`,
        gte(salesOrdersTable.createdAt, monthStart),
        lte(salesOrdersTable.createdAt, monthEnd),
      )
    );

  const ordersThisMonth = Number(monthlyStats?.count ?? 0);

  const [quoteStats] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(salesOrdersTable)
    .where(and(eq(salesOrdersTable.type, "quote"), sql`EXTRACT(YEAR FROM created_at) = ${year}`));

  const [orderStats] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(salesOrdersTable)
    .where(and(eq(salesOrdersTable.type, "order"), sql`EXTRACT(YEAR FROM created_at) = ${year}`));

  const totalQuotes = Number(quoteStats?.total ?? 0);
  const totalOrdersYear = Number(orderStats?.total ?? 0);
  const conversionRate = (totalQuotes + totalOrdersYear) > 0
    ? Math.round((totalOrdersYear / (totalQuotes + totalOrdersYear)) * 100)
    : 0;

  const NOT_TERMINAL_SQL = `status NOT IN ('delivered', 'cancelled', 'client_rejected', 'credit_rejected', 'financial_rejected', 'technical_rejected', 'quality_rejected')`;

  const [openStats] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(salesOrdersTable)
    .where(and(eq(salesOrdersTable.type, "order"), sql`${sql.raw(NOT_TERMINAL_SQL)}`));
  const openOrders = Number(openStats?.count ?? 0);

  const [overdueStats] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(salesOrdersTable)
    .where(
      and(
        eq(salesOrdersTable.type, "order"),
        sql`${sql.raw(NOT_TERMINAL_SQL)}`,
        isNotNull(salesOrdersTable.deliveryDate),
        lte(salesOrdersTable.deliveryDate, now),
      )
    );
  const overdueOrders = Number(overdueStats?.count ?? 0);

  const [avgStats] = await db
    .select({ avg: sql<number>`COALESCE(AVG(total_amount::numeric), 0)` })
    .from(salesOrdersTable)
    .where(
      and(
        eq(salesOrdersTable.type, "order"),
        sql`${sql.raw(CANCELLED_SQL)}`,
        sql`EXTRACT(YEAR FROM created_at) = ${year}`,
      )
    );
  const avgTicket = Number(avgStats?.avg ?? 0);

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
        sql`${sql.raw(CANCELLED_SQL)}`,
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

  const topClientsRows = await db
    .select({
      clientId: clientsTable.id,
      clientName: clientsTable.name,
      total: sql<number>`COALESCE(SUM(${salesOrdersTable.totalAmount}::numeric), 0)`,
      orderCount: sql<number>`COUNT(*)::int`,
    })
    .from(salesOrdersTable)
    .innerJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
    .where(and(
      eq(salesOrdersTable.type, "order"),
      sql`${salesOrdersTable.status} NOT IN ('cancelled', 'client_rejected', 'credit_rejected', 'financial_rejected', 'technical_rejected', 'quality_rejected')`
    ))
    .groupBy(clientsTable.id, clientsTable.name)
    .orderBy(desc(sql`SUM(${salesOrdersTable.totalAmount}::numeric)`))
    .limit(5);

  const pipelineRows = await db
    .select({
      status: salesOrdersTable.status,
      count: sql<number>`COUNT(*)::int`,
      total: sql<number>`COALESCE(SUM(total_amount::numeric), 0)`,
    })
    .from(salesOrdersTable)
    .where(eq(salesOrdersTable.type, "order"))
    .groupBy(salesOrdersTable.status);

  const pipelineByStatus = OPEN_STATUSES.map((s) => {
    const row = pipelineRows.find((r) => r.status === s);
    return { status: s, count: Number(row?.count ?? 0), total: Number(row?.total ?? 0) };
  });

  res.json({
    totalThisMonth: Number(monthlyStats?.total ?? 0),
    ordersThisMonth,
    totalQuotes,
    conversionRate,
    openOrders,
    overdueOrders,
    avgTicket,
    monthlyChart,
    topClients: topClientsRows.map((r) => ({
      clientId: r.clientId,
      clientName: r.clientName,
      total: Number(r.total),
      orderCount: Number(r.orderCount),
    })),
    pipelineByStatus,
  });
});

export default router;
