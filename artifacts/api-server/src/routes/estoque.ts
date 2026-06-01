import { Router, type IRouter } from "express";
import { and, eq, gte, lte, sql, desc, like, or, isNotNull } from "drizzle-orm";
import {
  db, productsTable, stockMovementsTable,
  warehousesTable, productLotsTable, lotMovementsTable,
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

// ─── Products ─────────────────────────────────────────────────────────────────

router.get("/estoque/products", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { search, category, active, lowStock } = req.query as Record<string, string>;

  const filters = [];

  if (active !== undefined) {
    filters.push(eq(productsTable.active, active));
  } else {
    filters.push(eq(productsTable.active, "true"));
  }

  if (search) {
    filters.push(
      sql`(${productsTable.name} ILIKE ${"%" + search + "%"} OR ${productsTable.sku} ILIKE ${"%" + search + "%"} OR ${productsTable.category} ILIKE ${"%" + search + "%"})`
    );
  }

  if (category) {
    filters.push(eq(productsTable.category, category));
  }

  if (lowStock === "true") {
    filters.push(sql`${productsTable.currentStock} <= ${productsTable.minStock}`);
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(and(...filters))
    .orderBy(productsTable.name);

  res.json(products);
});

router.post("/estoque/products", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, sku, description, category, unit, costPrice, salePrice, minStock, currentStock } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [product] = await db
    .insert(productsTable)
    .values({
      name: name.trim(),
      sku: sku || null,
      description: description || null,
      category: category || null,
      unit: unit || "un",
      costPrice: costPrice ? String(costPrice) : null,
      salePrice: salePrice ? String(salePrice) : null,
      minStock: minStock ? parseInt(minStock) : 0,
      currentStock: currentStock ? parseInt(currentStock) : 0,
      active: "true",
    })
    .returning();

  res.status(201).json(product);
});

router.put("/estoque/products/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { name, sku, description, category, unit, costPrice, salePrice, minStock } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [product] = await db
    .update(productsTable)
    .set({
      name: name.trim(),
      sku: sku || null,
      description: description || null,
      category: category || null,
      unit: unit || "un",
      costPrice: costPrice ? String(costPrice) : null,
      salePrice: salePrice ? String(salePrice) : null,
      minStock: minStock !== undefined ? parseInt(minStock) : 0,
    })
    .where(eq(productsTable.id, id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  res.json(product);
});

router.delete("/estoque/products/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [product] = await db
    .update(productsTable)
    .set({ active: "false" })
    .where(eq(productsTable.id, id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  res.json({ ok: true });
});

// ─── Stock Movements ──────────────────────────────────────────────────────────

router.get("/estoque/movements", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { productId, type, startDate, endDate } = req.query as Record<string, string>;

  const filters = [];

  if (productId) {
    const pid = parseInt(productId);
    if (!isNaN(pid)) filters.push(eq(stockMovementsTable.productId, pid));
  }
  if (type) filters.push(eq(stockMovementsTable.type, type));
  if (startDate) filters.push(gte(stockMovementsTable.createdAt, new Date(startDate)));
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filters.push(lte(stockMovementsTable.createdAt, end));
  }

  const movements = await db
    .select({
      id: stockMovementsTable.id,
      productId: stockMovementsTable.productId,
      productName: productsTable.name,
      lotId: stockMovementsTable.lotId,
      lotInternalLot: productLotsTable.internalLot,
      type: stockMovementsTable.type,
      quantity: stockMovementsTable.quantity,
      reason: stockMovementsTable.reason,
      referenceId: stockMovementsTable.referenceId,
      referenceType: stockMovementsTable.referenceType,
      notes: stockMovementsTable.notes,
      createdAt: stockMovementsTable.createdAt,
    })
    .from(stockMovementsTable)
    .leftJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .leftJoin(productLotsTable, eq(stockMovementsTable.lotId, productLotsTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(stockMovementsTable.createdAt))
    .limit(200);

  res.json(movements);
});

router.post("/estoque/movements", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { productId, lotId, type, quantity, reason, notes } = req.body;

  if (!productId || isNaN(parseInt(productId))) {
    res.status(400).json({ error: "Produto é obrigatório" });
    return;
  }
  if (!type || !["input", "output"].includes(type)) {
    res.status(400).json({ error: "Tipo deve ser 'input' ou 'output'" });
    return;
  }
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    res.status(400).json({ error: "Quantidade deve ser maior que zero" });
    return;
  }

  const pid = parseInt(productId);
  const lid = lotId ? parseInt(lotId) : null;

  let resultMovement: typeof stockMovementsTable.$inferSelect | undefined;
  let productName: string | undefined;
  let lotInternalLot: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, pid))
        .for("update");

      if (!product) {
        throw Object.assign(new Error("Produto não encontrado"), { status: 404 });
      }
      productName = product.name;

      // If a lotId is provided, validate and update lot quantities
      if (lid !== null) {
        const [lot] = await tx.select().from(productLotsTable).where(eq(productLotsTable.id, lid)).for("update");
        if (!lot) throw Object.assign(new Error("Lote não encontrado"), { status: 404 });
        if (lot.productId !== pid) throw Object.assign(new Error("Lote não pertence a este produto"), { status: 400 });
        if (lot.cqStatus !== "approved") throw Object.assign(new Error(`Lote em status "${lot.cqStatus}" — somente lotes aprovados podem ser movimentados`), { status: 400 });

        lotInternalLot = lot.internalLot;

        if (type === "output") {
          if (parseFloat(String(lot.availableQty)) < qty) {
            throw Object.assign(new Error(`Disponível no lote ${lot.internalLot}: ${lot.availableQty}`), { status: 400 });
          }
          await tx.update(productLotsTable)
            .set({
              availableQty: sql`${productLotsTable.availableQty} - ${qty}`,
              totalQty: sql`${productLotsTable.totalQty} - ${qty}`,
            })
            .where(eq(productLotsTable.id, lid));
        } else {
          await tx.update(productLotsTable)
            .set({
              availableQty: sql`${productLotsTable.availableQty} + ${qty}`,
              totalQty: sql`${productLotsTable.totalQty} + ${qty}`,
            })
            .where(eq(productLotsTable.id, lid));
        }

        await tx.insert(lotMovementsTable).values({
          lotId: lid,
          productId: pid,
          warehouseId: lot.warehouseId ?? null,
          type,
          quantity: String(qty),
          reason: reason || null,
          notes: notes || null,
          userId: req.session.userId ?? null,
          referenceType: "manual",
        });
      }

      if (type === "output") {
        if (product.currentStock < qty) {
          throw Object.assign(
            new Error(`Estoque insuficiente. Disponível: ${product.currentStock}`),
            { status: 400 }
          );
        }
        const [updated] = await tx
          .update(productsTable)
          .set({ currentStock: sql`${productsTable.currentStock} - ${qty}` })
          .where(
            and(
              eq(productsTable.id, pid),
              sql`${productsTable.currentStock} >= ${qty}`
            )
          )
          .returning({ currentStock: productsTable.currentStock });

        if (!updated) {
          throw Object.assign(
            new Error("Estoque insuficiente (atualizado por outra operação simultânea)"),
            { status: 400 }
          );
        }
      } else {
        await tx
          .update(productsTable)
          .set({ currentStock: sql`${productsTable.currentStock} + ${qty}` })
          .where(eq(productsTable.id, pid));
      }

      const [movement] = await tx
        .insert(stockMovementsTable)
        .values({
          productId: pid,
          lotId: lid,
          type,
          quantity: qty,
          reason: reason || null,
          referenceType: lid ? "lot" : "manual",
          notes: notes || null,
        })
        .returning();

      resultMovement = movement;
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    const message = err?.message ?? "Erro interno";
    res.status(status).json({ error: message });
    return;
  }

  res.status(201).json({ ...resultMovement, productName, lotInternalLot });
});

// ─── Warehouses / Depósitos ───────────────────────────────────────────────────

router.get("/estoque/warehouses", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { active } = req.query as Record<string, string>;

  const filters = active !== undefined
    ? [eq(warehousesTable.active, active)]
    : [eq(warehousesTable.active, "true")];

  const warehouses = await db
    .select()
    .from(warehousesTable)
    .where(and(...filters))
    .orderBy(warehousesTable.name);

  res.json(warehouses);
});

router.post("/estoque/warehouses", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, code, description } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Nome é obrigatório" }); return; }
  if (!code?.trim()) { res.status(400).json({ error: "Código é obrigatório" }); return; }

  try {
    const [warehouse] = await db
      .insert(warehousesTable)
      .values({ name: name.trim(), code: code.trim().toUpperCase(), description: description || null })
      .returning();
    res.status(201).json(warehouse);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(400).json({ error: "Código de depósito já existe" });
    } else {
      res.status(500).json({ error: "Erro ao criar depósito" });
    }
  }
});

router.put("/estoque/warehouses/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { name, code, description, active } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Nome é obrigatório" }); return; }

  const [warehouse] = await db
    .update(warehousesTable)
    .set({
      name: name.trim(),
      ...(code ? { code: code.trim().toUpperCase() } : {}),
      description: description ?? null,
      active: active ?? "true",
    })
    .where(eq(warehousesTable.id, id))
    .returning();

  if (!warehouse) { res.status(404).json({ error: "Depósito não encontrado" }); return; }
  res.json(warehouse);
});

// ─── Product Lots — shared select ────────────────────────────────────────────

const LOT_SELECT = {
  id: productLotsTable.id,
  productId: productLotsTable.productId,
  productName: productsTable.name,
  productUnit: productsTable.unit,
  internalLot: productLotsTable.internalLot,
  supplierLot: productLotsTable.supplierLot,
  warehouseId: productLotsTable.warehouseId,
  warehouseName: warehousesTable.name,
  manufacturingDate: productLotsTable.manufacturingDate,
  expirationDate: productLotsTable.expirationDate,
  cqStatus: productLotsTable.cqStatus,
  totalQty: productLotsTable.totalQty,
  availableQty: productLotsTable.availableQty,
  reservedQty: productLotsTable.reservedQty,
  blockedQty: productLotsTable.blockedQty,
  notes: productLotsTable.notes,
  createdAt: productLotsTable.createdAt,
  updatedAt: productLotsTable.updatedAt,
};

// ─── Product Lots ─────────────────────────────────────────────────────────────

router.get("/estoque/lots", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { productId, warehouseId, cqStatus, expiringDays, search } = req.query as Record<string, string>;

  const filters: any[] = [];

  if (productId) {
    const pid = parseInt(productId);
    if (!isNaN(pid)) filters.push(eq(productLotsTable.productId, pid));
  }
  if (warehouseId) {
    const wid = parseInt(warehouseId);
    if (!isNaN(wid)) filters.push(eq(productLotsTable.warehouseId, wid));
  }
  if (cqStatus) filters.push(eq(productLotsTable.cqStatus, cqStatus));

  if (expiringDays) {
    const days = parseInt(expiringDays);
    if (!isNaN(days)) {
      const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      filters.push(
        and(
          isNotNull(productLotsTable.expirationDate),
          sql`${productLotsTable.expirationDate} >= ${today}`,
          sql`${productLotsTable.expirationDate} <= ${cutoff}`
        )
      );
    }
  }

  if (search) {
    filters.push(
      or(
        like(productLotsTable.internalLot, `%${search}%`),
        sql`${productLotsTable.supplierLot} ILIKE ${"%" + search + "%"}`,
        sql`${productsTable.name} ILIKE ${"%" + search + "%"}`
      )
    );
  }

  const lots = await db
    .select(LOT_SELECT)
    .from(productLotsTable)
    .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
    .leftJoin(warehousesTable, eq(productLotsTable.warehouseId, warehousesTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(productLotsTable.expirationDate, productLotsTable.createdAt);

  res.json(lots);
});

router.post("/estoque/lots", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const {
    productId, internalLot, supplierLot, warehouseId,
    manufacturingDate, expirationDate, cqStatus,
    totalQty, availableQty, reservedQty, blockedQty, notes,
  } = req.body;

  if (!productId || isNaN(parseInt(productId))) {
    res.status(400).json({ error: "Produto é obrigatório" }); return;
  }
  if (!internalLot?.trim()) {
    res.status(400).json({ error: "Número do lote é obrigatório" }); return;
  }
  const qty = parseInt(totalQty);
  if (isNaN(qty) || qty < 0) {
    res.status(400).json({ error: "Quantidade deve ser ≥ 0" }); return;
  }

  const pid = parseInt(productId);
  const status = cqStatus || "quarantine";
  const avail = availableQty !== undefined ? parseInt(availableQty) : (status === "approved" ? qty : 0);

  try {
    let lotId!: number;

    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(productLotsTable)
        .values({
          productId: pid,
          internalLot: internalLot.trim(),
          supplierLot: supplierLot || null,
          warehouseId: warehouseId ? parseInt(warehouseId) : null,
          manufacturingDate: manufacturingDate || null,
          expirationDate: expirationDate || null,
          cqStatus: status,
          totalQty: String(qty),
          availableQty: String(avail),
          reservedQty: reservedQty ? String(parseInt(reservedQty)) : "0",
          blockedQty: blockedQty ? String(parseInt(blockedQty)) : "0",
          notes: notes || null,
        })
        .returning({ id: productLotsTable.id });

      lotId = inserted!.id;

      await tx
        .update(productsTable)
        .set({ currentStock: sql`${productsTable.currentStock} + ${qty}` })
        .where(eq(productsTable.id, pid));

      await tx.insert(lotMovementsTable).values({
        lotId: lotId,
        productId: pid,
        warehouseId: warehouseId ? parseInt(warehouseId) : null,
        type: "input",
        quantity: String(qty),
        reason: "Entrada de lote",
        notes: notes || null,
        userId: req.session.userId ?? null,
        referenceType: "manual",
      });
    });

    const [result] = await db
      .select(LOT_SELECT)
      .from(productLotsTable)
      .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
      .leftJoin(warehousesTable, eq(productLotsTable.warehouseId, warehousesTable.id))
      .where(eq(productLotsTable.id, lotId));

    res.status(201).json(result);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(400).json({ error: "Número de lote já existe" });
    } else {
      res.status(500).json({ error: err?.message ?? "Erro ao criar lote" });
    }
  }
});

router.get("/estoque/lots/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [lot] = await db
    .select(LOT_SELECT)
    .from(productLotsTable)
    .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
    .leftJoin(warehousesTable, eq(productLotsTable.warehouseId, warehousesTable.id))
    .where(eq(productLotsTable.id, id));

  if (!lot) { res.status(404).json({ error: "Lote não encontrado" }); return; }
  res.json(lot);
});

router.put("/estoque/lots/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { cqStatus, warehouseId, manufacturingDate, expirationDate, supplierLot, notes } = req.body;

  const VALID_CQ = ["quarantine", "approved", "rejected", "blocked"];

  const [existing] = await db.select().from(productLotsTable).where(eq(productLotsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Lote não encontrado" }); return; }

  const updates: Record<string, any> = {};
  if (cqStatus !== undefined) {
    if (!VALID_CQ.includes(cqStatus)) { res.status(400).json({ error: "Status CQ inválido" }); return; }
    updates.cqStatus = cqStatus;
    if (existing.cqStatus === "quarantine" && cqStatus === "approved") {
      const released = parseFloat(String(existing.totalQty)) - parseFloat(String(existing.reservedQty)) - parseFloat(String(existing.blockedQty));
      updates.availableQty = String(Math.max(0, released));
    }
    if (cqStatus === "rejected" || cqStatus === "blocked") {
      updates.availableQty = "0";
      updates.blockedQty = existing.totalQty;
    }
  }
  if (warehouseId !== undefined) updates.warehouseId = warehouseId ? parseInt(warehouseId) : null;
  if (manufacturingDate !== undefined) updates.manufacturingDate = manufacturingDate || null;
  if (expirationDate !== undefined) updates.expirationDate = expirationDate || null;
  if (supplierLot !== undefined) updates.supplierLot = supplierLot || null;
  if (notes !== undefined) updates.notes = notes || null;

  await db.update(productLotsTable).set(updates).where(eq(productLotsTable.id, id));

  const [result] = await db
    .select(LOT_SELECT)
    .from(productLotsTable)
    .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
    .leftJoin(warehousesTable, eq(productLotsTable.warehouseId, warehousesTable.id))
    .where(eq(productLotsTable.id, id));

  res.json(result);
});

// ─── Lot: Inventory Adjustment ────────────────────────────────────────────────

router.post("/estoque/lots/:id/adjust", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { newAvailableQty, reason, notes } = req.body;

  if (typeof newAvailableQty !== "number" || newAvailableQty < 0) {
    res.status(400).json({ error: "Nova quantidade deve ser ≥ 0" }); return;
  }
  if (!reason?.trim()) {
    res.status(400).json({ error: "Justificativa obrigatória para ajuste de inventário" }); return;
  }

  const [existing] = await db.select().from(productLotsTable).where(eq(productLotsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Lote não encontrado" }); return; }

  // availableQty/totalQty are numeric(12,3) stored as string — parse for arithmetic
  const currentAvailableQty = parseFloat(String(existing.availableQty));
  const currentTotalQty = parseFloat(String(existing.totalQty));
  const delta = parseFloat((newAvailableQty - currentAvailableQty).toFixed(3));
  const newTotal = parseFloat(Math.max(0, currentTotalQty + delta).toFixed(3));

  await db.transaction(async (tx) => {
    await tx
      .update(productLotsTable)
      .set({ availableQty: String(newAvailableQty), totalQty: String(newTotal) })
      .where(eq(productLotsTable.id, id));

    if (delta !== 0) {
      await tx
        .update(productsTable)
        .set({
          currentStock: delta > 0
            ? sql`${productsTable.currentStock} + ${Math.abs(delta)}`
            : sql`GREATEST(${productsTable.currentStock} - ${Math.abs(delta)}, 0)`,
        })
        .where(eq(productsTable.id, existing.productId));

      await tx.insert(stockMovementsTable).values({
        productId: existing.productId,
        type: delta > 0 ? "input" : "output",
        quantity: Math.abs(delta),
        reason: `Ajuste — Lote ${existing.internalLot}: ${reason.trim()}`,
        referenceType: "adjustment",
        notes: notes || null,
      });
    }

    await tx.insert(lotMovementsTable).values({
      lotId: id,
      productId: existing.productId,
      warehouseId: existing.warehouseId ?? null,
      type: "adjustment",
      quantity: String(Math.abs(delta)),
      reason: reason.trim(),
      notes: notes || null,
      userId: req.session.userId ?? null,
      referenceType: "adjustment",
    });
  });

  const [result] = await db
    .select(LOT_SELECT)
    .from(productLotsTable)
    .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
    .leftJoin(warehousesTable, eq(productLotsTable.warehouseId, warehousesTable.id))
    .where(eq(productLotsTable.id, id));

  res.json(result);
});

// ─── Lot: Transfer Between Warehouses ────────────────────────────────────────

router.post("/estoque/lots/:id/transfer", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { toWarehouseId, quantity, reason, notes } = req.body;

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    res.status(400).json({ error: "Quantidade deve ser maior que zero" }); return;
  }
  if (!toWarehouseId || isNaN(parseInt(toWarehouseId))) {
    res.status(400).json({ error: "Depósito destino é obrigatório" }); return;
  }
  if (!reason?.trim()) {
    res.status(400).json({ error: "Motivo da transferência é obrigatório" }); return;
  }

  const [existing] = await db.select().from(productLotsTable).where(eq(productLotsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Lote não encontrado" }); return; }
  // availableQty is numeric(12,3) stored as string — parse before comparison
  if (parseFloat(String(existing.availableQty)) < qty) {
    res.status(400).json({ error: `Disponível insuficiente. Disponível: ${existing.availableQty}` }); return;
  }

  const toWid = parseInt(toWarehouseId);
  const [toWarehouse] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, toWid));
  if (!toWarehouse) { res.status(404).json({ error: "Depósito destino não encontrado" }); return; }

  await db.transaction(async (tx) => {
    await tx.update(productLotsTable)
      .set({
        availableQty: sql`${productLotsTable.availableQty} - ${qty}`,
        totalQty: sql`${productLotsTable.totalQty} - ${qty}`,
      })
      .where(eq(productLotsTable.id, id));

    const newLotNumber = `${existing.internalLot}-T${toWid}`;
    const [existingDestLot] = await tx
      .select({ id: productLotsTable.id })
      .from(productLotsTable)
      .where(eq(productLotsTable.internalLot, newLotNumber));

    if (existingDestLot) {
      await tx.update(productLotsTable)
        .set({
          availableQty: sql`${productLotsTable.availableQty} + ${qty}`,
          totalQty: sql`${productLotsTable.totalQty} + ${qty}`,
        })
        .where(eq(productLotsTable.id, existingDestLot.id));
    } else {
      await tx.insert(productLotsTable).values({
        productId: existing.productId,
        internalLot: newLotNumber,
        supplierLot: existing.supplierLot,
        warehouseId: toWid,
        manufacturingDate: existing.manufacturingDate,
        expirationDate: existing.expirationDate,
        cqStatus: existing.cqStatus,
        totalQty: String(qty),
        availableQty: String(qty),
        reservedQty: "0",
        blockedQty: "0",
        notes: `Transferido de ${existing.internalLot}`,
      });
    }

    await tx.insert(lotMovementsTable).values({
      lotId: id,
      productId: existing.productId,
      warehouseId: existing.warehouseId ?? null,
      toWarehouseId: toWid,
      type: "transfer",
      quantity: String(qty),
      reason: reason.trim(),
      notes: notes || null,
      userId: req.session.userId ?? null,
      referenceType: "transfer",
    });
  });

  const [result] = await db
    .select(LOT_SELECT)
    .from(productLotsTable)
    .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
    .leftJoin(warehousesTable, eq(productLotsTable.warehouseId, warehousesTable.id))
    .where(eq(productLotsTable.id, id));

  res.json(result);
});

// ─── Lot: Movement History (Rastreabilidade) ──────────────────────────────────

router.get("/estoque/lots/:id/movements", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [lot] = await db.select({ id: productLotsTable.id }).from(productLotsTable).where(eq(productLotsTable.id, id));
  if (!lot) { res.status(404).json({ error: "Lote não encontrado" }); return; }

  const movements = await db.execute(sql`
    SELECT
      lm.id,
      lm.lot_id AS "lotId",
      lm.product_id AS "productId",
      p.name AS "productName",
      pl.internal_lot AS "internalLot",
      lm.warehouse_id AS "warehouseId",
      fw.name AS "warehouseName",
      lm.to_warehouse_id AS "toWarehouseId",
      tw.name AS "toWarehouseName",
      lm.type,
      lm.quantity,
      lm.reason,
      lm.notes,
      lm.user_id AS "userId",
      lm.reference_id AS "referenceId",
      lm.reference_type AS "referenceType",
      lm.created_at AS "createdAt"
    FROM lot_movements lm
    LEFT JOIN products p ON p.id = lm.product_id
    LEFT JOIN product_lots pl ON pl.id = lm.lot_id
    LEFT JOIN warehouses fw ON fw.id = lm.warehouse_id
    LEFT JOIN warehouses tw ON tw.id = lm.to_warehouse_id
    WHERE lm.lot_id = ${id}
    ORDER BY lm.created_at DESC
    LIMIT 100
  `);

  res.json(movements.rows);
});

// ─── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/estoque/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const today = new Date().toISOString().slice(0, 10);
  const in30  = new Date(Date.now() + 30  * 86400000).toISOString().slice(0, 10);
  const in60  = new Date(Date.now() + 60  * 86400000).toISOString().slice(0, 10);
  const in90  = new Date(Date.now() + 90  * 86400000).toISOString().slice(0, 10);

  const hasQtyFilter = and(isNotNull(productLotsTable.expirationDate), sql`${productLotsTable.totalQty} > 0`);

  // "quarantine aging" = in quarantine for more than 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    [totalRow], [lowRow], [outRow], [valueRow],
    lowStockProducts, recentMovements,
    [exp30Row], [exp60Row], [exp90Row], [quarantineRow], [quarantineAgingRow],
    expiringLotsList, quarantineLotsList, quarantineAgingList,
  ] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)::int` }).from(productsTable).where(eq(productsTable.active, "true")),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(productsTable).where(
      and(eq(productsTable.active, "true"), sql`${productsTable.currentStock} <= ${productsTable.minStock}`, sql`${productsTable.currentStock} > 0`)
    ),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(productsTable).where(
      and(eq(productsTable.active, "true"), sql`${productsTable.currentStock} = 0`)
    ),
    db.select({ value: sql<number>`COALESCE(SUM(cost_price::numeric * current_stock), 0)` }).from(productsTable).where(
      and(eq(productsTable.active, "true"), sql`cost_price IS NOT NULL`)
    ),
    db.select().from(productsTable).where(
      and(eq(productsTable.active, "true"), sql`${productsTable.currentStock} <= ${productsTable.minStock}`)
    ).orderBy(productsTable.currentStock).limit(10),
    db.select({
      id: stockMovementsTable.id, productId: stockMovementsTable.productId,
      productName: productsTable.name,
      lotId: stockMovementsTable.lotId,
      lotInternalLot: productLotsTable.internalLot,
      type: stockMovementsTable.type,
      quantity: stockMovementsTable.quantity, reason: stockMovementsTable.reason,
      referenceId: stockMovementsTable.referenceId, referenceType: stockMovementsTable.referenceType,
      notes: stockMovementsTable.notes, createdAt: stockMovementsTable.createdAt,
    }).from(stockMovementsTable)
      .leftJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
      .leftJoin(productLotsTable, eq(stockMovementsTable.lotId, productLotsTable.id))
      .orderBy(desc(stockMovementsTable.createdAt)).limit(5),

    db.select({ count: sql<number>`COUNT(*)::int` }).from(productLotsTable).where(
      and(hasQtyFilter, sql`${productLotsTable.expirationDate} >= ${today}`, sql`${productLotsTable.expirationDate} <= ${in30}`)
    ),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(productLotsTable).where(
      and(hasQtyFilter, sql`${productLotsTable.expirationDate} >= ${today}`, sql`${productLotsTable.expirationDate} <= ${in60}`)
    ),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(productLotsTable).where(
      and(hasQtyFilter, sql`${productLotsTable.expirationDate} >= ${today}`, sql`${productLotsTable.expirationDate} <= ${in90}`)
    ),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(productLotsTable).where(
      and(eq(productLotsTable.cqStatus, "quarantine"), sql`${productLotsTable.totalQty} > 0`)
    ),
    // quarantine aging: lots in quarantine for > 30 days
    db.select({ count: sql<number>`COUNT(*)::int` }).from(productLotsTable).where(
      and(
        eq(productLotsTable.cqStatus, "quarantine"),
        sql`${productLotsTable.totalQty} > 0`,
        sql`${productLotsTable.createdAt} < ${thirtyDaysAgo}`
      )
    ),
    db.select(LOT_SELECT).from(productLotsTable)
      .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
      .leftJoin(warehousesTable, eq(productLotsTable.warehouseId, warehousesTable.id))
      .where(and(hasQtyFilter, sql`${productLotsTable.expirationDate} >= ${today}`, sql`${productLotsTable.expirationDate} <= ${in90}`))
      .orderBy(productLotsTable.expirationDate).limit(10),
    db.select(LOT_SELECT).from(productLotsTable)
      .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
      .leftJoin(warehousesTable, eq(productLotsTable.warehouseId, warehousesTable.id))
      .where(and(eq(productLotsTable.cqStatus, "quarantine"), sql`${productLotsTable.totalQty} > 0`))
      .orderBy(productLotsTable.createdAt).limit(10),
    // quarantine aging list
    db.select(LOT_SELECT).from(productLotsTable)
      .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
      .leftJoin(warehousesTable, eq(productLotsTable.warehouseId, warehousesTable.id))
      .where(and(
        eq(productLotsTable.cqStatus, "quarantine"),
        sql`${productLotsTable.totalQty} > 0`,
        sql`${productLotsTable.createdAt} < ${thirtyDaysAgo}`
      ))
      .orderBy(productLotsTable.createdAt).limit(10),
  ]);

  res.json({
    totalProducts: Number(totalRow?.count ?? 0),
    lowStockCount: Number(lowRow?.count ?? 0),
    outOfStockCount: Number(outRow?.count ?? 0),
    totalStockValue: Number(valueRow?.value ?? 0),
    lowStockProducts,
    recentMovements,
    expiringLots30:  Number(exp30Row?.count  ?? 0),
    expiringLots60:  Number(exp60Row?.count  ?? 0),
    expiringLots90:  Number(exp90Row?.count  ?? 0),
    quarantineLots:  Number(quarantineRow?.count ?? 0),
    quarantineAgingLots: Number(quarantineAgingRow?.count ?? 0),
    expiringLotsList,
    quarantineLotsList,
    quarantineAgingList,
  });
});

export default router;
