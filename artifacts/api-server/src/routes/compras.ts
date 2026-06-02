import { Router, type IRouter } from "express";
import { and, desc, eq, gte, ilike, inArray, lte, lt, sql } from "drizzle-orm";
import {
  db,
  suppliersTable,
  purchaseOrdersTable,
  purchaseOrderItemsTable,
  productsTable,
  stockMovementsTable,
  purchaseRequestsTable,
  quotationsTable,
  quotationItemsTable,
  productLotsTable,
  lotMovementsTable,
  warehousesTable,
  usersTable,
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

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  if (req.session.role !== "admin" && req.session.role !== "manager") {
    res.status(403).json({ error: "Permissão insuficiente" });
    return false;
  }
  return true;
}

function parseId(param: string | string[], res: Response): number | null {
  const id = parseInt(Array.isArray(param) ? param[0]! : param);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido" });
    return null;
  }
  return id;
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

router.get("/compras/suppliers", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { search, active, category } = req.query as Record<string, string>;
  const filters = [];

  if (active !== undefined) {
    filters.push(eq(suppliersTable.active, active));
  } else {
    filters.push(eq(suppliersTable.active, "true"));
  }

  if (search) {
    filters.push(
      sql`(${suppliersTable.name} ILIKE ${"%" + search + "%"} OR ${suppliersTable.document} ILIKE ${"%" + search + "%"} OR ${suppliersTable.email} ILIKE ${"%" + search + "%"})`
    );
  }

  if (category) {
    filters.push(eq(suppliersTable.category, category));
  }

  const suppliers = await db
    .select()
    .from(suppliersTable)
    .where(and(...filters))
    .orderBy(suppliersTable.name);

  res.json(suppliers);
});

router.post("/compras/suppliers", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, document, email, phone, address, city, state, category, paymentTerms, notes } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [supplier] = await db
    .insert(suppliersTable)
    .values({
      name: name.trim(),
      document: document || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      state: state || null,
      category: category || null,
      paymentTerms: paymentTerms || null,
      notes: notes || null,
      active: "true",
      approvalStatus: "approved",
    })
    .returning();

  res.status(201).json(supplier);
});

router.put("/compras/suppliers/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { name, document, email, phone, address, city, state, category, paymentTerms, notes } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [supplier] = await db
    .update(suppliersTable)
    .set({
      name: name.trim(),
      document: document || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      state: state || null,
      category: category || null,
      paymentTerms: paymentTerms || null,
      notes: notes || null,
    })
    .where(eq(suppliersTable.id, id))
    .returning();

  if (!supplier) {
    res.status(404).json({ error: "Fornecedor não encontrado" });
    return;
  }

  res.json(supplier);
});

router.delete("/compras/suppliers/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [supplier] = await db
    .update(suppliersTable)
    .set({ active: "false" })
    .where(eq(suppliersTable.id, id))
    .returning();

  if (!supplier) {
    res.status(404).json({ error: "Fornecedor não encontrado" });
    return;
  }

  res.json({ ok: true });
});

// ─── Supplier Approval ────────────────────────────────────────────────────────

router.post("/compras/suppliers/:id/approval", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { approvalStatus } = req.body as { approvalStatus: string };
  const validStatuses = ["approved", "pending", "blocked"];
  if (!validStatuses.includes(approvalStatus)) {
    res.status(400).json({ error: `Status inválido. Use: ${validStatuses.join(", ")}` });
    return;
  }

  const [supplier] = await db
    .update(suppliersTable)
    .set({ approvalStatus })
    .where(eq(suppliersTable.id, id))
    .returning();

  if (!supplier) {
    res.status(404).json({ error: "Fornecedor não encontrado" });
    return;
  }

  res.json(supplier);
});

// ─── Supplier Analysis ────────────────────────────────────────────────────────

router.get("/compras/suppliers/:id/analysis", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [supplier] = await db
    .select({ id: suppliersTable.id, name: suppliersTable.name })
    .from(suppliersTable)
    .where(eq(suppliersTable.id, id));

  if (!supplier) { res.status(404).json({ error: "Fornecedor não encontrado" }); return; }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);

  const orders = await db
    .select({
      id: purchaseOrdersTable.id,
      status: purchaseOrdersTable.status,
      expectedDeliveryDate: purchaseOrdersTable.expectedDeliveryDate,
      receivedAt: purchaseOrdersTable.receivedAt,
    })
    .from(purchaseOrdersTable)
    .where(
      and(
        eq(purchaseOrdersTable.supplierId, id),
        gte(purchaseOrdersTable.createdAt, cutoff)
      )
    );

  const totalOrders = orders.length;
  const received = orders.filter((o) => o.status === "received");
  const receivedOrders = received.length;

  let onTimeOrders = 0;
  let lateOrders = 0;
  let totalDelayDays = 0;

  for (const o of received) {
    if (!o.expectedDeliveryDate || !o.receivedAt) { onTimeOrders++; continue; }
    const expected = new Date(o.expectedDeliveryDate).getTime();
    const actual = new Date(o.receivedAt).getTime();
    const delayDays = Math.max(0, Math.ceil((actual - expected) / 86400000));
    if (delayDays === 0) {
      onTimeOrders++;
    } else {
      lateOrders++;
      totalDelayDays += delayDays;
    }
  }

  const onTimeRate = receivedOrders > 0 ? onTimeOrders / receivedOrders : 0;
  const avgDelayDays = lateOrders > 0 ? totalDelayDays / lateOrders : 0;
  const evaluationScore = Math.round(onTimeRate * 100 * 10) / 10;

  const priceHistoryRows = await db
    .select({
      orderId: purchaseOrderItemsTable.purchaseOrderId,
      productId: purchaseOrderItemsTable.productId,
      productName: productsTable.name,
      description: purchaseOrderItemsTable.description,
      date: purchaseOrdersTable.receivedAt,
      unitPrice: purchaseOrderItemsTable.unitPrice,
      quantity: purchaseOrderItemsTable.quantity,
    })
    .from(purchaseOrderItemsTable)
    .innerJoin(purchaseOrdersTable, eq(purchaseOrderItemsTable.purchaseOrderId, purchaseOrdersTable.id))
    .leftJoin(productsTable, eq(purchaseOrderItemsTable.productId, productsTable.id))
    .where(
      and(
        eq(purchaseOrdersTable.supplierId, id),
        eq(purchaseOrdersTable.status, "received"),
        gte(purchaseOrdersTable.receivedAt, cutoff)
      )
    )
    .orderBy(desc(purchaseOrdersTable.receivedAt))
    .limit(100);

  const priceHistory = priceHistoryRows.map((r) => ({
    orderId: r.orderId,
    productId: r.productId ?? null,
    productName: r.productName ?? null,
    description: r.description ?? null,
    date: r.date ? r.date.toISOString().slice(0, 10) : null,
    unitPrice: String(r.unitPrice),
    quantity: String(r.quantity),
  }));

  res.json({
    supplierId: supplier.id,
    supplierName: supplier.name,
    totalOrders,
    receivedOrders,
    onTimeOrders,
    lateOrders,
    onTimeRate,
    avgDelayDays,
    evaluationScore,
    priceHistory,
  });
});

// ─── Purchase Orders ──────────────────────────────────────────────────────────

async function getPOWithItems(id: number) {
  const [order] = await db
    .select({
      id: purchaseOrdersTable.id,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      status: purchaseOrdersTable.status,
      totalAmount: purchaseOrdersTable.totalAmount,
      freightCost: purchaseOrdersTable.freightCost,
      carrier: purchaseOrdersTable.carrier,
      nfNumber: purchaseOrdersTable.nfNumber,
      purchaseRequestId: purchaseOrdersTable.purchaseRequestId,
      expectedDeliveryDate: purchaseOrdersTable.expectedDeliveryDate,
      receivedAt: purchaseOrdersTable.receivedAt,
      notes: purchaseOrdersTable.notes,
      createdAt: purchaseOrdersTable.createdAt,
      updatedAt: purchaseOrdersTable.updatedAt,
    })
    .from(purchaseOrdersTable)
    .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
    .where(eq(purchaseOrdersTable.id, id));

  if (!order) return null;

  const items = await db
    .select()
    .from(purchaseOrderItemsTable)
    .where(eq(purchaseOrderItemsTable.purchaseOrderId, id))
    .orderBy(purchaseOrderItemsTable.id);

  return { ...order, items };
}

router.get("/compras/orders", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { status, supplierId, startDate, endDate } = req.query as Record<string, string>;
  const filters = [];

  if (status) filters.push(eq(purchaseOrdersTable.status, status));
  if (supplierId) {
    const sid = parseInt(supplierId);
    if (!isNaN(sid)) filters.push(eq(purchaseOrdersTable.supplierId, sid));
  }
  if (startDate) filters.push(gte(purchaseOrdersTable.createdAt, new Date(startDate)));
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filters.push(lte(purchaseOrdersTable.createdAt, end));
  }

  const orders = await db
    .select({
      id: purchaseOrdersTable.id,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      status: purchaseOrdersTable.status,
      totalAmount: purchaseOrdersTable.totalAmount,
      freightCost: purchaseOrdersTable.freightCost,
      carrier: purchaseOrdersTable.carrier,
      nfNumber: purchaseOrdersTable.nfNumber,
      purchaseRequestId: purchaseOrdersTable.purchaseRequestId,
      expectedDeliveryDate: purchaseOrdersTable.expectedDeliveryDate,
      receivedAt: purchaseOrdersTable.receivedAt,
      notes: purchaseOrdersTable.notes,
      createdAt: purchaseOrdersTable.createdAt,
      updatedAt: purchaseOrdersTable.updatedAt,
    })
    .from(purchaseOrdersTable)
    .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(purchaseOrdersTable.createdAt));

  res.json(orders);
});

router.post("/compras/orders", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { supplierId, expectedDeliveryDate, notes, items, freightCost, carrier, purchaseRequestId } = req.body;

  if (!supplierId || isNaN(parseInt(supplierId))) {
    res.status(400).json({ error: "Fornecedor é obrigatório" });
    return;
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Pedido deve ter pelo menos um item" });
    return;
  }

  const sid = parseInt(supplierId);

  // Check supplier approval status for critical-item enforcement
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, sid));
  if (supplier?.approvalStatus === "blocked") {
    // Check if any item in this PO references a critical product
    const productIds = items
      .filter((i: any) => i.productId && !isNaN(parseInt(i.productId)))
      .map((i: any) => parseInt(i.productId));
    if (productIds.length > 0) {
      const criticalProducts = await db
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(and(inArray(productsTable.id, productIds), eq(productsTable.isCritical, "true")));
      if (criticalProducts.length > 0) {
        res.status(400).json({ error: "Fornecedor bloqueado. Este pedido contém itens críticos — selecione um fornecedor aprovado." });
        return;
      }
    }
  }

  for (const item of items) {
    if (!item.description || !item.quantity || !item.unitPrice) {
      res.status(400).json({ error: "Cada item deve ter descrição, quantidade e preço unitário" });
      return;
    }
  }

  const totalAmount = items.reduce((sum: number, item: any) => {
    return sum + parseFloat(item.quantity) * parseFloat(item.unitPrice);
  }, 0);

  let newOrderId: number | undefined;

  await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(purchaseOrdersTable)
      .values({
        supplierId: sid,
        status: "draft",
        totalAmount: String(totalAmount.toFixed(2)),
        freightCost: freightCost ? String(parseFloat(freightCost).toFixed(2)) : null,
        carrier: carrier || null,
        purchaseRequestId: purchaseRequestId ? parseInt(purchaseRequestId) : null,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        notes: notes || null,
      })
      .returning();

    newOrderId = order!.id;

    const itemValues = items.map((item: any) => {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      return {
        purchaseOrderId: order!.id,
        productId: item.productId ? parseInt(item.productId) : 0,
        description: String(item.description),
        quantity: String(qty),
        unitPrice: String(price.toFixed(2)),
        totalPrice: String((qty * price).toFixed(2)),
      };
    });

    await tx.insert(purchaseOrderItemsTable).values(itemValues);

    // If linked to a purchase request, mark it as converted
    if (purchaseRequestId) {
      await tx
        .update(purchaseRequestsTable)
        .set({ status: "converted", purchaseOrderId: order!.id })
        .where(eq(purchaseRequestsTable.id, parseInt(purchaseRequestId)));
    }
  });

  const result = await getPOWithItems(newOrderId!);
  res.status(201).json(result);
});

router.get("/compras/orders/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const result = await getPOWithItems(id);
  if (!result) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  res.json(result);
});

router.put("/compras/orders/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { supplierId, expectedDeliveryDate, notes, items, freightCost, carrier } = req.body;

  const [existing] = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  if (existing.status !== "draft") {
    res.status(400).json({ error: "Apenas pedidos em rascunho podem ser editados" });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Pedido deve ter pelo menos um item" });
    return;
  }

  const totalAmount = items.reduce((sum: number, item: any) => {
    return sum + parseFloat(item.quantity) * parseFloat(item.unitPrice);
  }, 0);

  await db.transaction(async (tx) => {
    await tx
      .update(purchaseOrdersTable)
      .set({
        supplierId: supplierId ? parseInt(supplierId) : existing.supplierId,
        totalAmount: String(totalAmount.toFixed(2)),
        freightCost: freightCost ? String(parseFloat(freightCost).toFixed(2)) : null,
        carrier: carrier || null,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        notes: notes || null,
      })
      .where(eq(purchaseOrdersTable.id, id));

    await tx.delete(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.purchaseOrderId, id));

    const itemValues = items.map((item: any) => {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      return {
        purchaseOrderId: id,
        productId: item.productId ? parseInt(item.productId) : 0,
        description: String(item.description),
        quantity: String(qty),
        unitPrice: String(price.toFixed(2)),
        totalPrice: String((qty * price).toFixed(2)),
      };
    });

    await tx.insert(purchaseOrderItemsTable).values(itemValues);
  });

  const result = await getPOWithItems(id);
  res.json(result);
});

router.delete("/compras/orders/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  if (existing.status === "received") {
    res.status(400).json({ error: "Pedidos já recebidos não podem ser cancelados" });
    return;
  }

  await db
    .update(purchaseOrdersTable)
    .set({ status: "cancelled" })
    .where(eq(purchaseOrdersTable.id, id));

  res.json({ ok: true });
});

// ─── PO Status Update ──────────────────────────────────────────────────────────

router.post("/compras/orders/:id/status", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { status } = req.body as { status: string };

  if (status === "received") {
    res.status(400).json({ error: "Para receber um pedido use POST /compras/orders/:id/receive" });
    return;
  }

  const validStatuses = ["draft", "sent", "cancelled"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Status inválido. Use: ${validStatuses.join(", ")}` });
    return;
  }

  const [existing] = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  if (existing.status === "received") {
    res.status(400).json({ error: "Pedido já foi recebido e não pode ter o status alterado" });
    return;
  }
  if (existing.status === "cancelled" && status !== "draft") {
    res.status(400).json({ error: "Pedido cancelado só pode ser reaberto como rascunho" });
    return;
  }

  const [updated] = await db
    .update(purchaseOrdersTable)
    .set({ status })
    .where(eq(purchaseOrdersTable.id, id))
    .returning();

  res.json(updated);
});

// ─── Receive PO (lot + stock) ─────────────────────────────────────────────────

router.post("/compras/orders/:id/receive", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  if (existing.status === "received") {
    res.status(400).json({ error: "Pedido já foi completamente recebido" });
    return;
  }
  if (existing.status === "cancelled") {
    res.status(400).json({ error: "Pedido cancelado não pode ser recebido" });
    return;
  }
  if (existing.status !== "sent" && existing.status !== "partially_received") {
    res.status(400).json({ error: "Apenas pedidos com status 'enviado' ou 'recebimento parcial' podem ser recebidos" });
    return;
  }

  // Receipt body: { nfNumber, carrier, freightCost, items: [{itemId, receivedQty, supplierLot, expiryDate, manufactureDate, warehouseId}] }
  const receiveInput = req.body as {
    nfNumber?: string;
    carrier?: string;
    freightCost?: number;
    items?: Array<{
      itemId: number;
      receivedQty: number;
      supplierLot?: string;
      expiryDate?: string;
      manufactureDate?: string;
      warehouseId?: number;
      divergenceNote?: string;
    }>;
  };

  type ReceiveItemDetail = NonNullable<typeof receiveInput.items>[number];
  // Build a map from itemId → receive details
  const receiveMap = new Map<number, ReceiveItemDetail>();
  for (const ri of receiveInput.items ?? []) {
    receiveMap.set(ri.itemId, ri);
  }

  // Get default warehouse (first active one if not specified per item)
  const [defaultWarehouse] = await db
    .select()
    .from(warehousesTable)
    .where(eq(warehousesTable.active, "true"))
    .orderBy(warehousesTable.id)
    .limit(1);

  try {
    await db.transaction(async (tx) => {
      // Lock the PO row first; fail fast if completely processed or invalid
      const [locked] = await tx
        .select({ status: purchaseOrdersTable.status })
        .from(purchaseOrdersTable)
        .where(eq(purchaseOrdersTable.id, id))
        .for("update");

      if (!locked || (locked.status !== "sent" && locked.status !== "partially_received")) {
        throw new Error("ALREADY_PROCESSED");
      }

      // Re-read items INSIDE the transaction (after lock) to avoid stale receivedQty
      // under concurrent receive requests for the same PO.
      const poItems = await tx
        .select()
        .from(purchaseOrderItemsTable)
        .where(eq(purchaseOrderItemsTable.purchaseOrderId, id));

      // Process each item: create quarantine lot for the DELTA qty received this call.
      // NOTE: do NOT increment product.currentStock here.
      // Stock is only released when CQ approves the lot (done in the estoque module).
      //
      // Quantities are stored as numeric(12,3) — preserve decimal precision throughout;
      // never use Math.round() on domain values.
      let anyNewlyReceived = false;
      let allFullyReceived = true;

      for (const item of poItems) {
        // Decimal-safe parsing — preserve up to 3 decimal places
        const orderedQty = parseFloat(parseFloat(String(item.quantity)).toFixed(3));
        const alreadyReceivedQty = parseFloat(parseFloat(String(item.receivedQty ?? "0")).toFixed(3));

        if (!item.productId || item.productId === 0) {
          // Non-product (description-only) lines: they are not physically received,
          // so they do NOT participate in the fully-received status check.
          continue;
        }

        const ri = receiveMap.get(item.id);
        // remaining = how many units are still outstanding for this item
        const remaining = parseFloat((orderedQty - alreadyReceivedQty).toFixed(3));
        // requestedDelta = what the caller wants to receive this time (≥ 0)
        const requestedDelta = ri
          ? parseFloat(Math.max(0, parseFloat(String(ri.receivedQty))).toFixed(3))
          : remaining;
        // deltaQty = actual receipt this call, clamped to remaining (prevents over-receipt)
        const deltaQty = parseFloat(Math.min(requestedDelta, remaining).toFixed(3));
        const newTotalReceived = parseFloat((alreadyReceivedQty + deltaQty).toFixed(3));

        // Update accumulated received quantity on the item
        await tx
          .update(purchaseOrderItemsTable)
          .set({ receivedQty: String(newTotalReceived) })
          .where(eq(purchaseOrderItemsTable.id, item.id));

        if (newTotalReceived < orderedQty) allFullyReceived = false;
        if (deltaQty <= 0) continue; // nothing new received for this item this time

        anyNewlyReceived = true;

        const warehouseId = ri?.warehouseId ?? defaultWarehouse?.id ?? null;
        const internalLot = `RC-${id}-${item.id}-${Date.now()}`;

        // Build divergence note: auto-detect qty divergence + user-supplied note
        const qtyDivergence = parseFloat((orderedQty - newTotalReceived).toFixed(3));
        const divergenceParts: string[] = [];
        if (qtyDivergence > 0) {
          divergenceParts.push(`Divergência de quantidade: recebido ${newTotalReceived} de ${orderedQty} pedidos (faltam ${qtyDivergence}).`);
        }
        if (ri?.divergenceNote) {
          divergenceParts.push(`Nota de divergência: ${ri.divergenceNote}`);
        }
        const lotNotes = [
          `Aguardando CQ. Recebimento PC #${id}.`,
          `Total recebido nesta entrada: ${deltaQty} (acumulado: ${newTotalReceived}/${orderedQty}).`,
          ...divergenceParts,
        ].join(" ");

        // Create lot in quarantine for the delta (CQ approval will release to available stock).
        // totalQty and availableQty use numeric(12,3) — no rounding needed.
        const [lot] = await tx
          .insert(productLotsTable)
          .values({
            productId: item.productId,
            internalLot,
            supplierLot: ri?.supplierLot || null,
            cqStatus: "quarantine",
            totalQty: String(deltaQty),
            availableQty: "0",     // Zero until CQ releases the lot
            warehouseId: warehouseId ?? undefined,
            expirationDate: ri?.expiryDate ? ri.expiryDate.slice(0, 10) : null,
            manufacturingDate: ri?.manufactureDate ? ri.manufactureDate.slice(0, 10) : null,
            notes: lotNotes,
          })
          .returning();

        // Record lot movement (physical receipt — does NOT change available stock).
        // quantity uses numeric(12,3) — no rounding needed.
        await tx.insert(lotMovementsTable).values({
          lotId: lot!.id,
          productId: item.productId,
          warehouseId: warehouseId ?? undefined,
          type: "input",
          quantity: String(deltaQty),
          reason: `Recebimento físico PC #${id} — aguarda CQ (${newTotalReceived}/${orderedQty})`,
          referenceId: id,
          referenceType: "purchase_order",
        });
      }

      // Determine PO final status:
      //   - all items at ordered qty → "received"
      //   - some newly received but not all → "partially_received"
      //   - nothing received this call → stay at current status (sent or partially_received)
      const newStatus = allFullyReceived
        ? "received"
        : anyNewlyReceived
        ? "partially_received"
        : locked.status;

      await tx
        .update(purchaseOrdersTable)
        .set({
          status: newStatus,
          receivedAt: anyNewlyReceived ? new Date() : existing.receivedAt,
          nfNumber: receiveInput.nfNumber || null,
          carrier: receiveInput.carrier || null,
          freightCost: receiveInput.freightCost != null
            ? String(parseFloat(String(receiveInput.freightCost)).toFixed(2))
            : null,
        })
        .where(eq(purchaseOrdersTable.id, id));
    });
  } catch (err: any) {
    if (err?.message === "ALREADY_PROCESSED") {
      res.status(409).json({ error: "Pedido já foi processado por outra requisição" });
    } else {
      res.status(500).json({ error: err?.message ?? "Erro ao registrar recebimento" });
    }
    return;
  }

  const result = await getPOWithItems(id);
  res.json(result);
});

// ─── Purchase Requests ────────────────────────────────────────────────────────

router.get("/compras/requests", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { status, priority } = req.query as Record<string, string>;
  const filters = [];
  if (status) filters.push(eq(purchaseRequestsTable.status, status));
  if (priority) filters.push(eq(purchaseRequestsTable.priority, priority));

  const requests = await db
    .select({
      id: purchaseRequestsTable.id,
      productId: purchaseRequestsTable.productId,
      productName: productsTable.name,
      description: purchaseRequestsTable.description,
      quantity: purchaseRequestsTable.quantity,
      unit: purchaseRequestsTable.unit,
      priority: purchaseRequestsTable.priority,
      status: purchaseRequestsTable.status,
      purchaseOrderId: purchaseRequestsTable.purchaseOrderId,
      requestedById: purchaseRequestsTable.requestedById,
      requestedByName: usersTable.name,
      approvedById: purchaseRequestsTable.approvedById,
      approvedAt: purchaseRequestsTable.approvedAt,
      notes: purchaseRequestsTable.notes,
      createdAt: purchaseRequestsTable.createdAt,
      updatedAt: purchaseRequestsTable.updatedAt,
    })
    .from(purchaseRequestsTable)
    .leftJoin(productsTable, eq(purchaseRequestsTable.productId, productsTable.id))
    .leftJoin(usersTable, eq(purchaseRequestsTable.requestedById, usersTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(purchaseRequestsTable.createdAt));

  res.json(requests);
});

router.post("/compras/requests", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { productId, description, quantity, unit, priority, notes } = req.body;

  if (!description || typeof description !== "string" || description.trim() === "") {
    res.status(400).json({ error: "Descrição é obrigatória" });
    return;
  }
  if (!quantity || isNaN(parseFloat(quantity))) {
    res.status(400).json({ error: "Quantidade é obrigatória" });
    return;
  }

  const [request] = await db
    .insert(purchaseRequestsTable)
    .values({
      productId: productId ? parseInt(productId) : null,
      description: description.trim(),
      quantity: String(parseFloat(quantity)),
      unit: unit || "un",
      priority: priority || "normal",
      status: "pending",
      requestedById: req.session.userId ?? null,
      notes: notes || null,
    })
    .returning();

  // Join with product/user for the response
  const [full] = await db
    .select({
      id: purchaseRequestsTable.id,
      productId: purchaseRequestsTable.productId,
      productName: productsTable.name,
      description: purchaseRequestsTable.description,
      quantity: purchaseRequestsTable.quantity,
      unit: purchaseRequestsTable.unit,
      priority: purchaseRequestsTable.priority,
      status: purchaseRequestsTable.status,
      purchaseOrderId: purchaseRequestsTable.purchaseOrderId,
      requestedById: purchaseRequestsTable.requestedById,
      requestedByName: usersTable.name,
      approvedById: purchaseRequestsTable.approvedById,
      approvedAt: purchaseRequestsTable.approvedAt,
      notes: purchaseRequestsTable.notes,
      createdAt: purchaseRequestsTable.createdAt,
      updatedAt: purchaseRequestsTable.updatedAt,
    })
    .from(purchaseRequestsTable)
    .leftJoin(productsTable, eq(purchaseRequestsTable.productId, productsTable.id))
    .leftJoin(usersTable, eq(purchaseRequestsTable.requestedById, usersTable.id))
    .where(eq(purchaseRequestsTable.id, request!.id));

  res.status(201).json(full);
});

router.put("/compras/requests/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select()
    .from(purchaseRequestsTable)
    .where(eq(purchaseRequestsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Solicitação não encontrada" });
    return;
  }

  if (existing.status !== "pending") {
    res.status(400).json({ error: "Apenas solicitações pendentes podem ser editadas. Use os endpoints /approve ou /reject para mudar o status." });
    return;
  }

  const { productId, description, quantity, unit, priority, notes } = req.body;

  // status changes are NOT allowed via PUT — use dedicated /approve and /reject
  const [updated] = await db
    .update(purchaseRequestsTable)
    .set({
      productId: productId !== undefined ? (productId ? parseInt(productId) : null) : existing.productId,
      description: description ? description.trim() : existing.description,
      quantity: quantity ? String(parseFloat(quantity)) : existing.quantity,
      unit: unit || existing.unit,
      priority: priority || existing.priority,
      notes: notes !== undefined ? (notes || null) : existing.notes,
    })
    .where(eq(purchaseRequestsTable.id, id))
    .returning();

  const [full] = await db
    .select({
      id: purchaseRequestsTable.id,
      productId: purchaseRequestsTable.productId,
      productName: productsTable.name,
      description: purchaseRequestsTable.description,
      quantity: purchaseRequestsTable.quantity,
      unit: purchaseRequestsTable.unit,
      priority: purchaseRequestsTable.priority,
      status: purchaseRequestsTable.status,
      purchaseOrderId: purchaseRequestsTable.purchaseOrderId,
      requestedById: purchaseRequestsTable.requestedById,
      requestedByName: usersTable.name,
      approvedById: purchaseRequestsTable.approvedById,
      approvedAt: purchaseRequestsTable.approvedAt,
      notes: purchaseRequestsTable.notes,
      createdAt: purchaseRequestsTable.createdAt,
      updatedAt: purchaseRequestsTable.updatedAt,
    })
    .from(purchaseRequestsTable)
    .leftJoin(productsTable, eq(purchaseRequestsTable.productId, productsTable.id))
    .leftJoin(usersTable, eq(purchaseRequestsTable.requestedById, usersTable.id))
    .where(eq(purchaseRequestsTable.id, updated!.id));

  res.json(full);
});

// ─── Purchase Request Approve/Reject (admin/manager only) ────────────────────

async function getPurchaseRequestFull(id: number) {
  const [full] = await db
    .select({
      id: purchaseRequestsTable.id,
      productId: purchaseRequestsTable.productId,
      productName: productsTable.name,
      description: purchaseRequestsTable.description,
      quantity: purchaseRequestsTable.quantity,
      unit: purchaseRequestsTable.unit,
      priority: purchaseRequestsTable.priority,
      status: purchaseRequestsTable.status,
      purchaseOrderId: purchaseRequestsTable.purchaseOrderId,
      requestedById: purchaseRequestsTable.requestedById,
      requestedByName: usersTable.name,
      approvedById: purchaseRequestsTable.approvedById,
      approvedAt: purchaseRequestsTable.approvedAt,
      notes: purchaseRequestsTable.notes,
      createdAt: purchaseRequestsTable.createdAt,
      updatedAt: purchaseRequestsTable.updatedAt,
    })
    .from(purchaseRequestsTable)
    .leftJoin(productsTable, eq(purchaseRequestsTable.productId, productsTable.id))
    .leftJoin(usersTable, eq(purchaseRequestsTable.requestedById, usersTable.id))
    .where(eq(purchaseRequestsTable.id, id));
  return full ?? null;
}

router.post("/compras/requests/:id/approve", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select()
    .from(purchaseRequestsTable)
    .where(eq(purchaseRequestsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Solicitação não encontrada" });
    return;
  }

  if (existing.status !== "pending") {
    res.status(400).json({ error: `Solicitação já tem status "${existing.status}" e não pode ser aprovada` });
    return;
  }

  await db
    .update(purchaseRequestsTable)
    .set({
      status: "approved",
      approvedById: req.session.userId ?? null,
      approvedAt: new Date(),
    })
    .where(eq(purchaseRequestsTable.id, id));

  const full = await getPurchaseRequestFull(id);
  res.json(full);
});

router.post("/compras/requests/:id/reject", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select()
    .from(purchaseRequestsTable)
    .where(eq(purchaseRequestsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Solicitação não encontrada" });
    return;
  }

  if (existing.status !== "pending") {
    res.status(400).json({ error: `Solicitação já tem status "${existing.status}" e não pode ser rejeitada` });
    return;
  }

  const { notes } = req.body as { notes?: string };

  await db
    .update(purchaseRequestsTable)
    .set({
      status: "rejected",
      approvedById: req.session.userId ?? null,
      approvedAt: new Date(),
      notes: notes || existing.notes,
    })
    .where(eq(purchaseRequestsTable.id, id));

  const full = await getPurchaseRequestFull(id);
  res.json(full);
});

// ─── Quotations ───────────────────────────────────────────────────────────────

async function getQuotationWithItems(id: number) {
  const [quotation] = await db
    .select()
    .from(quotationsTable)
    .where(eq(quotationsTable.id, id));

  if (!quotation) return null;

  const items = await db
    .select({
      id: quotationItemsTable.id,
      quotationId: quotationItemsTable.quotationId,
      supplierId: quotationItemsTable.supplierId,
      supplierName: suppliersTable.name,
      productId: quotationItemsTable.productId,
      description: quotationItemsTable.description,
      quantity: quotationItemsTable.quantity,
      unitPrice: quotationItemsTable.unitPrice,
      totalPrice: quotationItemsTable.totalPrice,
      deliveryDays: quotationItemsTable.deliveryDays,
      notes: quotationItemsTable.notes,
      selected: quotationItemsTable.selected,
      createdAt: quotationItemsTable.createdAt,
    })
    .from(quotationItemsTable)
    .leftJoin(suppliersTable, eq(quotationItemsTable.supplierId, suppliersTable.id))
    .where(eq(quotationItemsTable.quotationId, id))
    .orderBy(quotationItemsTable.unitPrice);

  return { ...quotation, items };
}

router.get("/compras/quotations", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { status } = req.query as Record<string, string>;
  const filters = [];
  if (status) filters.push(eq(quotationsTable.status, status));

  const quotations = await db
    .select()
    .from(quotationsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(quotationsTable.createdAt));

  // Load items for each quotation
  const results = await Promise.all(quotations.map((q) => getQuotationWithItems(q.id)));
  res.json(results.filter(Boolean));
});

router.post("/compras/quotations", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { purchaseRequestId, title, status, notes, items } = req.body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    res.status(400).json({ error: "Título é obrigatório" });
    return;
  }

  let quotationId: number | undefined;

  await db.transaction(async (tx) => {
    const [quotation] = await tx
      .insert(quotationsTable)
      .values({
        purchaseRequestId: purchaseRequestId ? parseInt(purchaseRequestId) : null,
        title: title.trim(),
        status: status || "open",
        notes: notes || null,
      })
      .returning();

    quotationId = quotation!.id;

    if (Array.isArray(items) && items.length > 0) {
      const itemValues = items.map((item: any) => {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unitPrice) || 0;
        return {
          quotationId: quotation!.id,
          supplierId: parseInt(item.supplierId),
          productId: item.productId ? parseInt(item.productId) : null,
          description: String(item.description),
          quantity: String(qty),
          unitPrice: String(price.toFixed(2)),
          totalPrice: String((qty * price).toFixed(2)),
          deliveryDays: item.deliveryDays ? parseInt(item.deliveryDays) : null,
          notes: item.notes || null,
          selected: "false",
        };
      });
      await tx.insert(quotationItemsTable).values(itemValues);
    }
  });

  const result = await getQuotationWithItems(quotationId!);
  res.status(201).json(result);
});

router.get("/compras/quotations/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const result = await getQuotationWithItems(id);
  if (!result) {
    res.status(404).json({ error: "Cotação não encontrada" });
    return;
  }

  res.json(result);
});

router.put("/compras/quotations/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Cotação não encontrada" });
    return;
  }

  const { purchaseRequestId, title, status, notes, items } = req.body;

  await db.transaction(async (tx) => {
    await tx
      .update(quotationsTable)
      .set({
        purchaseRequestId: purchaseRequestId !== undefined ? (purchaseRequestId ? parseInt(purchaseRequestId) : null) : existing.purchaseRequestId,
        title: title ? title.trim() : existing.title,
        status: status || existing.status,
        notes: notes !== undefined ? (notes || null) : existing.notes,
      })
      .where(eq(quotationsTable.id, id));

    if (Array.isArray(items)) {
      await tx.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
      if (items.length > 0) {
        const itemValues = items.map((item: any) => {
          const qty = parseFloat(item.quantity) || 1;
          const price = parseFloat(item.unitPrice) || 0;
          return {
            quotationId: id,
            supplierId: parseInt(item.supplierId),
            productId: item.productId ? parseInt(item.productId) : null,
            description: String(item.description),
            quantity: String(qty),
            unitPrice: String(price.toFixed(2)),
            totalPrice: String((qty * price).toFixed(2)),
            deliveryDays: item.deliveryDays ? parseInt(item.deliveryDays) : null,
            notes: item.notes || null,
            selected: item.selected === "true" ? "true" : "false",
          };
        });
        await tx.insert(quotationItemsTable).values(itemValues);
      }
    }
  });

  const result = await getQuotationWithItems(id);
  res.json(result);
});

// ─── Select Quotation Winner → Generate PO ────────────────────────────────────

router.post("/compras/quotations/:id/select", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const quotationId = parseId(req.params.id, res);
  if (quotationId === null) return;

  const { quotationItemId, expectedDeliveryDate, notes } = req.body as {
    quotationItemId: number;
    expectedDeliveryDate?: string;
    notes?: string;
  };

  if (!quotationItemId || isNaN(quotationItemId)) {
    res.status(400).json({ error: "quotationItemId é obrigatório" });
    return;
  }

  const [quotation] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, quotationId));
  if (!quotation) {
    res.status(404).json({ error: "Cotação não encontrada" });
    return;
  }

  if (quotation.status !== "open") {
    res.status(400).json({ error: "Apenas cotações abertas podem ter um vencedor selecionado" });
    return;
  }

  const [winnerItem] = await db
    .select()
    .from(quotationItemsTable)
    .where(and(eq(quotationItemsTable.id, quotationItemId), eq(quotationItemsTable.quotationId, quotationId)));

  if (!winnerItem) {
    res.status(404).json({ error: "Item de cotação não encontrado" });
    return;
  }

  // Check supplier is not blocked for critical items
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, winnerItem.supplierId));
  if (supplier?.approvalStatus === "blocked" && winnerItem.productId) {
    const [critCheck] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(and(eq(productsTable.id, winnerItem.productId), eq(productsTable.isCritical, "true")));
    if (critCheck) {
      res.status(400).json({ error: "Fornecedor bloqueado não pode vencer cotação de item crítico. Selecione outro fornecedor." });
      return;
    }
  }

  let newOrderId: number | undefined;

  await db.transaction(async (tx) => {
    // Mark this item as selected
    await tx
      .update(quotationItemsTable)
      .set({ selected: "true" })
      .where(eq(quotationItemsTable.id, quotationItemId));

    // Close quotation
    await tx
      .update(quotationsTable)
      .set({ status: "closed" })
      .where(eq(quotationsTable.id, quotationId));

    // Create purchase order
    const qty = parseFloat(String(winnerItem.quantity));
    const price = parseFloat(String(winnerItem.unitPrice));
    const total = qty * price;

    const [order] = await tx
      .insert(purchaseOrdersTable)
      .values({
        supplierId: winnerItem.supplierId,
        status: "draft",
        totalAmount: String(total.toFixed(2)),
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        notes: notes || `Gerado via Cotação #${quotationId}`,
        purchaseRequestId: quotation.purchaseRequestId,
      })
      .returning();

    newOrderId = order!.id;

    await tx.insert(purchaseOrderItemsTable).values({
      purchaseOrderId: order!.id,
      productId: winnerItem.productId || 0,
      description: winnerItem.description,
      quantity: String(qty),
      unitPrice: String(price.toFixed(2)),
      totalPrice: String(total.toFixed(2)),
    });

    // If linked to a purchase request, mark it as converted
    if (quotation.purchaseRequestId) {
      await tx
        .update(purchaseRequestsTable)
        .set({ status: "converted", purchaseOrderId: order!.id })
        .where(eq(purchaseRequestsTable.id, quotation.purchaseRequestId));
    }
  });

  const result = await getPOWithItems(newOrderId!);
  res.status(201).json(result);
});

// ─── Price History ────────────────────────────────────────────────────────────

router.get("/compras/price-history", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { productId, supplierId, months } = req.query as Record<string, string>;
  const monthsBack = parseInt(months ?? "12") || 12;

  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);

  const filters = [
    eq(purchaseOrdersTable.status, "received"),
    gte(purchaseOrdersTable.receivedAt, since),
  ];

  if (supplierId) {
    const sid = parseInt(supplierId);
    if (!isNaN(sid)) filters.push(eq(purchaseOrdersTable.supplierId, sid));
  }

  if (productId) {
    const pid = parseInt(productId);
    if (!isNaN(pid)) filters.push(eq(purchaseOrderItemsTable.productId, pid));
  }

  const rows = await db
    .select({
      orderId: purchaseOrdersTable.id,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      productId: purchaseOrderItemsTable.productId,
      productName: productsTable.name,
      description: purchaseOrderItemsTable.description,
      date: purchaseOrdersTable.receivedAt,
      unitPrice: purchaseOrderItemsTable.unitPrice,
      quantity: purchaseOrderItemsTable.quantity,
    })
    .from(purchaseOrderItemsTable)
    .innerJoin(purchaseOrdersTable, eq(purchaseOrderItemsTable.purchaseOrderId, purchaseOrdersTable.id))
    .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
    .leftJoin(productsTable, eq(purchaseOrderItemsTable.productId, productsTable.id))
    .where(and(...filters))
    .orderBy(purchaseOrdersTable.receivedAt);

  res.json(rows);
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get("/compras/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [spentRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(total_amount::numeric), 0)`,
    })
    .from(purchaseOrdersTable)
    .where(
      and(
        eq(purchaseOrdersTable.status, "received"),
        gte(purchaseOrdersTable.receivedAt, startOfMonth),
        lte(purchaseOrdersTable.receivedAt, endOfMonth)
      )
    );

  const statusCounts = await db
    .select({
      status: purchaseOrdersTable.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(purchaseOrdersTable)
    .groupBy(purchaseOrdersTable.status);

  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r.count]));

  // Overdue: sent orders with expectedDeliveryDate < now
  const [overdueRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(purchaseOrdersTable)
    .where(
      and(
        eq(purchaseOrdersTable.status, "sent"),
        lt(purchaseOrdersTable.expectedDeliveryDate, now),
        sql`${purchaseOrdersTable.expectedDeliveryDate} IS NOT NULL`
      )
    );

  // Pending purchase requests
  const [pendingReqRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(purchaseRequestsTable)
    .where(eq(purchaseRequestsTable.status, "pending"));

  // Lots in quarantine from purchase orders
  const [lotsInCqRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(productLotsTable)
    .where(eq(productLotsTable.cqStatus, "quarantine"));

  const pendingDeliveries = await db
    .select({
      id: purchaseOrdersTable.id,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      status: purchaseOrdersTable.status,
      totalAmount: purchaseOrdersTable.totalAmount,
      freightCost: purchaseOrdersTable.freightCost,
      carrier: purchaseOrdersTable.carrier,
      nfNumber: purchaseOrdersTable.nfNumber,
      purchaseRequestId: purchaseOrdersTable.purchaseRequestId,
      expectedDeliveryDate: purchaseOrdersTable.expectedDeliveryDate,
      receivedAt: purchaseOrdersTable.receivedAt,
      notes: purchaseOrdersTable.notes,
      createdAt: purchaseOrdersTable.createdAt,
      updatedAt: purchaseOrdersTable.updatedAt,
    })
    .from(purchaseOrdersTable)
    .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
    .where(eq(purchaseOrdersTable.status, "sent"))
    .orderBy(purchaseOrdersTable.expectedDeliveryDate)
    .limit(10);

  const topSuppliers = await db
    .select({
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      totalSpent: sql<number>`COALESCE(SUM(${purchaseOrdersTable.totalAmount}::numeric), 0)`,
      orderCount: sql<number>`COUNT(*)::int`,
    })
    .from(purchaseOrdersTable)
    .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
    .where(eq(purchaseOrdersTable.status, "received"))
    .groupBy(purchaseOrdersTable.supplierId, suppliersTable.name)
    .orderBy(desc(sql`SUM(${purchaseOrdersTable.totalAmount}::numeric)`))
    .limit(5);

  const monthlySpend = await db
    .select({
      month: sql<string>`TO_CHAR(received_at, 'YYYY-MM')`,
      total: sql<number>`COALESCE(SUM(total_amount::numeric), 0)`,
    })
    .from(purchaseOrdersTable)
    .where(
      and(
        eq(purchaseOrdersTable.status, "received"),
        gte(purchaseOrdersTable.receivedAt, new Date(now.getFullYear(), now.getMonth() - 5, 1))
      )
    )
    .groupBy(sql`TO_CHAR(received_at, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(received_at, 'YYYY-MM')`);

  const recentOrders = await db
    .select({
      id: purchaseOrdersTable.id,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      status: purchaseOrdersTable.status,
      totalAmount: purchaseOrdersTable.totalAmount,
      freightCost: purchaseOrdersTable.freightCost,
      carrier: purchaseOrdersTable.carrier,
      nfNumber: purchaseOrdersTable.nfNumber,
      purchaseRequestId: purchaseOrdersTable.purchaseRequestId,
      expectedDeliveryDate: purchaseOrdersTable.expectedDeliveryDate,
      receivedAt: purchaseOrdersTable.receivedAt,
      notes: purchaseOrdersTable.notes,
      createdAt: purchaseOrdersTable.createdAt,
      updatedAt: purchaseOrdersTable.updatedAt,
    })
    .from(purchaseOrdersTable)
    .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
    .orderBy(desc(purchaseOrdersTable.createdAt))
    .limit(5);

  res.json({
    totalSpentThisMonth: Number(spentRow?.total ?? 0),
    draftCount: Number(byStatus["draft"] ?? 0),
    sentCount: Number(byStatus["sent"] ?? 0),
    receivedCount: Number(byStatus["received"] ?? 0),
    cancelledCount: Number(byStatus["cancelled"] ?? 0),
    overdueCount: Number(overdueRow?.count ?? 0),
    pendingRequestsCount: Number(pendingReqRow?.count ?? 0),
    lotsInCqCount: Number(lotsInCqRow?.count ?? 0),
    pendingDeliveries,
    topSuppliers,
    monthlySpend,
    recentOrders,
  });
});

export default router;
