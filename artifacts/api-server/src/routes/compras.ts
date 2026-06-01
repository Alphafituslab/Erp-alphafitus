import { Router, type IRouter } from "express";
import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import {
  db,
  suppliersTable,
  purchaseOrdersTable,
  purchaseOrderItemsTable,
  productsTable,
  stockMovementsTable,
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

// ─── Purchase Orders ──────────────────────────────────────────────────────────

async function getPOWithItems(id: number) {
  const [order] = await db
    .select({
      id: purchaseOrdersTable.id,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      status: purchaseOrdersTable.status,
      totalAmount: purchaseOrdersTable.totalAmount,
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

  const { supplierId, expectedDeliveryDate, notes, items } = req.body;

  if (!supplierId || isNaN(parseInt(supplierId))) {
    res.status(400).json({ error: "Fornecedor é obrigatório" });
    return;
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Pedido deve ter pelo menos um item" });
    return;
  }

  const sid = parseInt(supplierId);

  // Validate items
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

  const { supplierId, expectedDeliveryDate, notes, items } = req.body;

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
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        notes: notes || null,
      })
      .where(eq(purchaseOrdersTable.id, id));

    // Replace all items
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

  // Receiving a PO must go through the /receive endpoint (generates stock movements)
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

// ─── Receive PO (auto-generate stock movements) ───────────────────────────────

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

  if (existing.status !== "sent") {
    if (existing.status === "received") {
      res.status(400).json({ error: "Pedido já foi recebido" });
    } else if (existing.status === "cancelled") {
      res.status(400).json({ error: "Pedido cancelado não pode ser recebido" });
    } else {
      res.status(400).json({ error: "Apenas pedidos com status 'enviado' podem ser recebidos" });
    }
    return;
  }

  const items = await db
    .select()
    .from(purchaseOrderItemsTable)
    .where(eq(purchaseOrderItemsTable.purchaseOrderId, id));

  try {
    await db.transaction(async (tx) => {
      // Atomic conditional update: only mark as received if still in 'sent' state
      // This prevents duplicate processing under concurrent requests
      const updated = await tx
        .update(purchaseOrdersTable)
        .set({ status: "received", receivedAt: new Date() })
        .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.status, "sent")))
        .returning({ id: purchaseOrdersTable.id });

      if (updated.length === 0) {
        throw new Error("ALREADY_PROCESSED");
      }

      // For each item with a valid productId that exists in the DB, create a stock input movement
      for (const item of items) {
        if (!item.productId || item.productId === 0) continue;

        const qty = Math.round(parseFloat(String(item.quantity)));
        if (qty <= 0) continue;

        // Only proceed if the product actually exists
        const [product] = await tx
          .select({ id: productsTable.id })
          .from(productsTable)
          .where(eq(productsTable.id, item.productId));

        if (!product) continue; // product not in catalog, skip stock movement

        // Update stock
        await tx
          .update(productsTable)
          .set({ currentStock: sql`${productsTable.currentStock} + ${qty}` })
          .where(eq(productsTable.id, item.productId));

        // Record movement
        await tx.insert(stockMovementsTable).values({
          productId: item.productId,
          type: "input",
          quantity: qty,
          reason: `Recebimento PC #${id}`,
          referenceId: id,
          referenceType: "purchase_order",
          notes: item.description,
        });
      }
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

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get("/compras/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Total spent this month (received orders)
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

  // Count by status
  const statusCounts = await db
    .select({
      status: purchaseOrdersTable.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(purchaseOrdersTable)
    .groupBy(purchaseOrdersTable.status);

  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r.count]));

  // Pending deliveries (sent, not received yet, sorted by expected date)
  const pendingDeliveries = await db
    .select({
      id: purchaseOrdersTable.id,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      status: purchaseOrdersTable.status,
      totalAmount: purchaseOrdersTable.totalAmount,
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

  // Top suppliers by total amount (all time, received orders only)
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

  // Monthly spend (last 6 months)
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

  // Recent orders
  const recentOrders = await db
    .select({
      id: purchaseOrdersTable.id,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      status: purchaseOrdersTable.status,
      totalAmount: purchaseOrdersTable.totalAmount,
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
    pendingDeliveries,
    topSuppliers,
    monthlySpend,
    recentOrders,
  });
});

export default router;
