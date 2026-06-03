import { Router, type IRouter } from "express";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import {
  db,
  formulasTable,
  formulaItemsTable,
  productionOrdersTable,
  productionStagesTable,
  productionMaterialConsumptionsTable,
  productsTable,
  productLotsTable,
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
  const id = parseInt(Array.isArray(param) ? param[0] : param, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return null;
  }
  return id;
}

// ─── OP Number Generator ───────────────────────────────────────────────────────

async function generateOpNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [last] = await db
    .select({ number: productionOrdersTable.number })
    .from(productionOrdersTable)
    .where(sql`number LIKE ${"OP-" + year + "-%"}`)
    .orderBy(desc(productionOrdersTable.id))
    .limit(1);
  const seq = last ? parseInt(last.number.split("-")[2] ?? "0", 10) + 1 : 1;
  return `OP-${year}-${String(seq).padStart(3, "0")}`;
}

// ─── Default stages per formula ───────────────────────────────────────────────

const STAGE_TYPES = [
  { stageType: "weighing", sequence: 1 },
  { stageType: "mixing", sequence: 2 },
  { stageType: "production", sequence: 3 },
  { stageType: "packaging", sequence: 4 },
];

// ─── Formulas ─────────────────────────────────────────────────────────────────

router.get("/producao/formulas", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { search, status, productId } = req.query as { search?: string; status?: string; productId?: string };
  const filters: any[] = [];
  if (status) filters.push(eq(formulasTable.status, status));
  if (productId) filters.push(eq(formulasTable.productId, Number(productId)));
  if (search) {
    const q = "%" + search + "%";
    filters.push(sql`(${formulasTable.productName} ILIKE ${q} OR ${formulasTable.version} ILIKE ${q})`);
  }
  const rows = await db
    .select()
    .from(formulasTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(formulasTable.createdAt));
  res.json(rows);
});

router.post("/producao/formulas", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { productId, productName, version, batchYield, unit, notes } = req.body;
  if (!productName) { res.status(400).json({ error: "productName é obrigatório" }); return; }
  const [row] = await db
    .insert(formulasTable)
    .values({
      productId: productId ? Number(productId) : null,
      productName,
      version: version || "1.0",
      batchYield: batchYield || "0",
      unit: unit || "kg",
      notes: notes || null,
      status: "draft",
    })
    .returning();
  res.status(201).json(row);
});

router.get("/producao/formulas/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [formula] = await db.select().from(formulasTable).where(eq(formulasTable.id, id));
  if (!formula) { res.status(404).json({ error: "Fórmula não encontrada" }); return; }
  const items = await db.select().from(formulaItemsTable).where(eq(formulaItemsTable.formulaId, id)).orderBy(asc(formulaItemsTable.id));
  res.json({ ...formula, items });
});

router.put("/producao/formulas/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [existing] = await db.select().from(formulasTable).where(eq(formulasTable.id, id));
  if (!existing) { res.status(404).json({ error: "Fórmula não encontrada" }); return; }
  if (existing.status === "approved" || existing.status === "obsolete") { res.status(400).json({ error: "Fórmulas aprovadas ou obsoletas não podem ser editadas. Crie uma nova versão." }); return; }
  const { productId, productName, version, batchYield, unit, notes } = req.body;
  const [row] = await db
    .update(formulasTable)
    .set({
      productId: productId !== undefined ? (productId ? Number(productId) : null) : existing.productId,
      productName: productName || existing.productName,
      version: version || existing.version,
      batchYield: batchYield || existing.batchYield,
      unit: unit || existing.unit,
      notes: notes !== undefined ? (notes || null) : existing.notes,
    })
    .where(eq(formulasTable.id, id))
    .returning();
  res.json(row);
});

router.delete("/producao/formulas/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [existing] = await db.select().from(formulasTable).where(eq(formulasTable.id, id));
  if (!existing) { res.status(404).json({ error: "Fórmula não encontrada" }); return; }
  if (existing.status === "approved" || existing.status === "obsolete") { res.status(400).json({ error: "Fórmulas aprovadas ou obsoletas não podem ser excluídas." }); return; }
  await db.delete(formulasTable).where(eq(formulasTable.id, id));
  res.json({ success: true });
});

router.post("/producao/formulas/:id/approve", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [existing] = await db.select().from(formulasTable).where(eq(formulasTable.id, id));
  if (!existing) { res.status(404).json({ error: "Fórmula não encontrada" }); return; }
  if (existing.status !== "draft") { res.status(400).json({ error: "Somente fórmulas em rascunho podem ser aprovadas" }); return; }
  const items = await db.select().from(formulaItemsTable).where(eq(formulaItemsTable.formulaId, id));
  if (items.length === 0) { res.status(400).json({ error: "Fórmula precisa de ao menos um componente para ser aprovada" }); return; }
  const approvedBy = req.session.userName ?? "Sistema";
  const [row] = await db
    .update(formulasTable)
    .set({ status: "approved", approvedBy, approvedAt: new Date() })
    .where(eq(formulasTable.id, id))
    .returning();
  res.json(row);
});

router.post("/producao/formulas/:id/obsolete", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [existing] = await db.select().from(formulasTable).where(eq(formulasTable.id, id));
  if (!existing) { res.status(404).json({ error: "Fórmula não encontrada" }); return; }
  const [row] = await db.update(formulasTable).set({ status: "obsolete" }).where(eq(formulasTable.id, id)).returning();
  res.json(row);
});

// ─── Formula Items ─────────────────────────────────────────────────────────────

router.get("/producao/formulas/:id/items", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const items = await db.select().from(formulaItemsTable).where(eq(formulaItemsTable.formulaId, id)).orderBy(asc(formulaItemsTable.id));
  res.json(items);
});

router.post("/producao/formulas/:id/items", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [formula] = await db.select().from(formulasTable).where(eq(formulasTable.id, id));
  if (!formula) { res.status(404).json({ error: "Fórmula não encontrada" }); return; }
  if (formula.status === "approved") { res.status(400).json({ error: "Fórmula aprovada não pode ser editada" }); return; }
  const { productId, productName, quantity, unit, function: fn, notes } = req.body;
  if (!productName || !quantity) { res.status(400).json({ error: "productName e quantity são obrigatórios" }); return; }
  const [row] = await db
    .insert(formulaItemsTable)
    .values({
      formulaId: id,
      productId: productId ? Number(productId) : null,
      productName,
      quantity: String(quantity),
      unit: unit || "kg",
      function: fn || null,
      notes: notes || null,
    })
    .returning();
  res.status(201).json(row);
});

router.put("/producao/formula-items/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [existing] = await db.select().from(formulaItemsTable).where(eq(formulaItemsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Item não encontrado" }); return; }
  // Guard: approved / obsolete formulas are immutable
  const [parentFormula] = await db.select({ status: formulasTable.status }).from(formulasTable).where(eq(formulasTable.id, existing.formulaId));
  if (parentFormula && ["approved", "obsolete"].includes(parentFormula.status)) {
    res.status(400).json({ error: "Itens de fórmulas aprovadas ou obsoletas não podem ser editados" });
    return;
  }
  const { productId, productName, quantity, unit, function: fn, notes } = req.body;
  const [row] = await db
    .update(formulaItemsTable)
    .set({
      productId: productId !== undefined ? (productId ? Number(productId) : null) : existing.productId,
      productName: productName || existing.productName,
      quantity: quantity ? String(quantity) : existing.quantity,
      unit: unit || existing.unit,
      function: fn !== undefined ? (fn || null) : existing.function,
      notes: notes !== undefined ? (notes || null) : existing.notes,
    })
    .where(eq(formulaItemsTable.id, id))
    .returning();
  res.json(row);
});

router.delete("/producao/formula-items/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [existing] = await db.select().from(formulaItemsTable).where(eq(formulaItemsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Item não encontrado" }); return; }
  // Guard: approved / obsolete formulas are immutable
  const [parentFormula] = await db.select({ status: formulasTable.status }).from(formulasTable).where(eq(formulasTable.id, existing.formulaId));
  if (parentFormula && ["approved", "obsolete"].includes(parentFormula.status)) {
    res.status(400).json({ error: "Itens de fórmulas aprovadas ou obsoletas não podem ser excluídos" });
    return;
  }
  await db.delete(formulaItemsTable).where(eq(formulaItemsTable.id, id));
  res.json({ success: true });
});

// ─── Material Needs Calculation ────────────────────────────────────────────────

router.get("/producao/formulas/:id/needs", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const qty = parseFloat((req.query.qty as string) || "1");
  const [formula] = await db.select().from(formulasTable).where(eq(formulasTable.id, id));
  if (!formula) { res.status(404).json({ error: "Fórmula não encontrada" }); return; }
  const items = await db.select().from(formulaItemsTable).where(eq(formulaItemsTable.formulaId, id));
  const batchYield = parseFloat(formula.batchYield);
  const factor = batchYield > 0 ? qty / batchYield : 1;
  const needs = await Promise.all(items.map(async (item) => {
    const needed = parseFloat(item.quantity) * factor;
    // Check available approved stock
    const [stock] = await db
      .select({ available: sql<string>`COALESCE(SUM(${productLotsTable.availableQty}), '0')` })
      .from(productLotsTable)
      .where(and(
        eq(productLotsTable.productId, item.productId ?? 0),
        eq(productLotsTable.cqStatus, "approved")
      ));
    const available = parseFloat(stock?.available ?? "0");
    return {
      ...item,
      needed: needed.toFixed(4),
      available: available.toFixed(3),
      sufficient: available >= needed,
      factor,
    };
  }));
  res.json({ formula, needs, qty, factor });
});

// ─── Production Orders ─────────────────────────────────────────────────────────

router.get("/producao/orders", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { status, search } = req.query as { status?: string; search?: string };
  const filters: any[] = [];
  if (status) filters.push(eq(productionOrdersTable.status, status));
  if (search) {
    const q = "%" + search + "%";
    filters.push(sql`(${productionOrdersTable.number} ILIKE ${q} OR ${productionOrdersTable.productName} ILIKE ${q} OR ${productionOrdersTable.batchLot} ILIKE ${q})`);
  }
  const rows = await db
    .select()
    .from(productionOrdersTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(productionOrdersTable.createdAt));
  res.json(rows);
});

router.post("/producao/orders", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { formulaId, productId, productName, plannedQty, unit, salesOrderId, scheduledStart, scheduledEnd, notes } = req.body;
  if (!productName || !plannedQty) { res.status(400).json({ error: "productName e plannedQty são obrigatórios" }); return; }
  const number = await generateOpNumber();

  // Snapshot formula version if provided — formula must be approved
  let formulaVersion: string | null = null;
  if (formulaId) {
    const [f] = await db.select({ version: formulasTable.version, status: formulasTable.status }).from(formulasTable).where(eq(formulasTable.id, Number(formulaId)));
    if (!f) { res.status(400).json({ error: "Fórmula não encontrada" }); return; }
    if (f.status !== "approved") { res.status(400).json({ error: "Somente fórmulas aprovadas podem ser usadas para criar OPs." }); return; }
    formulaVersion = f?.version ?? null;
  }

  const [order] = await db
    .insert(productionOrdersTable)
    .values({
      number,
      formulaId: formulaId ? Number(formulaId) : null,
      productId: productId ? Number(productId) : null,
      productName,
      formulaVersion,
      plannedQty: String(plannedQty),
      unit: unit || "kg",
      salesOrderId: salesOrderId ? Number(salesOrderId) : null,
      scheduledStart: scheduledStart || null,
      scheduledEnd: scheduledEnd || null,
      notes: notes || null,
      status: "planned",
    })
    .returning();

  // Auto-create 4 stages
  await db.insert(productionStagesTable).values(
    STAGE_TYPES.map((s) => ({ ...s, orderId: order.id, status: "pending" }))
  );

  res.status(201).json(order);
});

router.get("/producao/orders/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [order] = await db.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "OP não encontrada" }); return; }
  const stages = await db.select().from(productionStagesTable).where(eq(productionStagesTable.orderId, id)).orderBy(asc(productionStagesTable.sequence));
  let formulaItems: any[] = [];
  if (order.formulaId) {
    formulaItems = await db.select().from(formulaItemsTable).where(eq(formulaItemsTable.formulaId, order.formulaId));
  }
  // Include actual consumption records so OP detail can show real-time traceability
  const consumptions = await db
    .select({
      id: productionMaterialConsumptionsTable.id,
      stageId: productionMaterialConsumptionsTable.stageId,
      productId: productionMaterialConsumptionsTable.productId,
      productName: productionMaterialConsumptionsTable.productName,
      lotId: productionMaterialConsumptionsTable.lotId,
      internalLot: productionMaterialConsumptionsTable.internalLot,
      plannedQty: productionMaterialConsumptionsTable.plannedQty,
      actualQty: productionMaterialConsumptionsTable.actualQty,
      unit: productionMaterialConsumptionsTable.unit,
      recordedBy: productionMaterialConsumptionsTable.recordedBy,
      recordedAt: productionMaterialConsumptionsTable.recordedAt,
      supplierLot: productLotsTable.supplierLot,
      cqStatus: productLotsTable.cqStatus,
    })
    .from(productionMaterialConsumptionsTable)
    .leftJoin(productLotsTable, eq(productionMaterialConsumptionsTable.lotId, productLotsTable.id))
    .where(eq(productionMaterialConsumptionsTable.orderId, id))
    .orderBy(asc(productionMaterialConsumptionsTable.recordedAt));
  res.json({ ...order, stages, formulaItems, consumptions });
});

router.put("/producao/orders/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [existing] = await db.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, id));
  if (!existing) { res.status(404).json({ error: "OP não encontrada" }); return; }
  const terminal = ["finished", "cancelled"];
  if (terminal.includes(existing.status)) { res.status(400).json({ error: "OP finalizada ou cancelada não pode ser editada" }); return; }
  const { plannedQty, scheduledStart, scheduledEnd, notes, salesOrderId } = req.body;
  const [row] = await db
    .update(productionOrdersTable)
    .set({
      plannedQty: plannedQty ? String(plannedQty) : existing.plannedQty,
      scheduledStart: scheduledStart !== undefined ? (scheduledStart || null) : existing.scheduledStart,
      scheduledEnd: scheduledEnd !== undefined ? (scheduledEnd || null) : existing.scheduledEnd,
      notes: notes !== undefined ? (notes || null) : existing.notes,
      salesOrderId: salesOrderId !== undefined ? (salesOrderId ? Number(salesOrderId) : null) : existing.salesOrderId,
    })
    .where(eq(productionOrdersTable.id, id))
    .returning();
  res.json(row);
});

router.delete("/producao/orders/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [existing] = await db.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, id));
  if (!existing) { res.status(404).json({ error: "OP não encontrada" }); return; }
  if (!["planned", "cancelled"].includes(existing.status)) {
    res.status(400).json({ error: "Somente OPs planejadas ou canceladas podem ser excluídas" });
    return;
  }
  await db.delete(productionOrdersTable).where(eq(productionOrdersTable.id, id));
  res.json({ success: true });
});

// ─── OP Status Transitions ─────────────────────────────────────────────────────

router.post("/producao/orders/:id/release", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [order] = await db.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "OP não encontrada" }); return; }
  if (order.status !== "planned") { res.status(400).json({ error: "Somente OPs planejadas podem ser liberadas" }); return; }

  // Validate: if has formula, it must be approved and materials must be available
  if (order.formulaId) {
    const [formula] = await db.select({ batchYield: formulasTable.batchYield, status: formulasTable.status }).from(formulasTable).where(eq(formulasTable.id, order.formulaId));
    if (!formula || formula.status !== "approved") {
      res.status(400).json({ error: "A fórmula vinculada não está aprovada. Não é possível liberar esta OP." });
      return;
    }
    const items = await db.select().from(formulaItemsTable).where(eq(formulaItemsTable.formulaId, order.formulaId));
    const batchYield = order.plannedQty ? parseFloat(order.plannedQty) : 0;
    const fYield = parseFloat(formula.batchYield ?? "1");
    const factor = fYield > 0 ? batchYield / fYield : 1;

    const shortages: string[] = [];
    for (const item of items) {
      const needed = parseFloat(item.quantity) * factor;
      const [stock] = await db
        .select({ available: sql<string>`COALESCE(SUM(${productLotsTable.availableQty}), '0')` })
        .from(productLotsTable)
        .where(and(
          eq(productLotsTable.productId, item.productId ?? 0),
          eq(productLotsTable.cqStatus, "approved")
        ));
      const available = parseFloat(stock?.available ?? "0");
      if (available < needed) {
        shortages.push(`${item.productName}: necessário ${needed.toFixed(3)} ${item.unit}, disponível ${available.toFixed(3)} ${item.unit} (aprovado em CQ)`);
      }
    }
    if (shortages.length > 0) {
      res.status(400).json({ error: "Materiais insuficientes ou não aprovados em CQ", shortages });
      return;
    }
  }

  const releasedBy = req.session.userName ?? "Sistema";
  const [row] = await db
    .update(productionOrdersTable)
    .set({ status: "released", releasedBy, releasedAt: new Date() })
    .where(eq(productionOrdersTable.id, id))
    .returning();
  res.json(row);
});

router.post("/producao/orders/:id/start", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [order] = await db.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "OP não encontrada" }); return; }
  if (order.status !== "released") { res.status(400).json({ error: "Somente OPs liberadas podem ser iniciadas" }); return; }
  const [row] = await db
    .update(productionOrdersTable)
    .set({ status: "in_production", actualStart: new Date() })
    .where(eq(productionOrdersTable.id, id))
    .returning();
  res.json(row);
});

router.post("/producao/orders/:id/quality-check", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [order] = await db.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "OP não encontrada" }); return; }
  if (order.status !== "in_production") { res.status(400).json({ error: "OP precisa estar em produção para ir a CQ" }); return; }
  // Validate all stages are done before sending to QC
  const allStages = await db.select({ status: productionStagesTable.status, stageType: productionStagesTable.stageType })
    .from(productionStagesTable).where(eq(productionStagesTable.orderId, id));
  const notDone = allStages.filter((s) => s.status !== "done" && s.status !== "skipped");
  if (notDone.length > 0) {
    res.status(400).json({ error: `Existem ${notDone.length} etapa(s) não concluída(s). Todas as etapas de produção devem ser finalizadas antes de enviar ao CQ.` });
    return;
  }
  const { actualQty } = req.body;
  const [row] = await db
    .update(productionOrdersTable)
    .set({ status: "quality_check", actualQty: actualQty ? String(actualQty) : null })
    .where(eq(productionOrdersTable.id, id))
    .returning();
  res.json(row);
});

router.post("/producao/orders/:id/finish", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [order] = await db.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "OP não encontrada" }); return; }
  if (order.status !== "quality_check") { res.status(400).json({ error: "OP precisa estar em CQ para ser finalizada" }); return; }
  const { actualQty, batchLot } = req.body;
  const lot = batchLot || `PA-${order.number}-${Date.now().toString(36).toUpperCase()}`;
  const [row] = await db
    .update(productionOrdersTable)
    .set({ status: "finished", actualQty: actualQty ? String(actualQty) : order.actualQty, batchLot: lot, actualEnd: new Date() })
    .where(eq(productionOrdersTable.id, id))
    .returning();
  res.json(row);
});

router.post("/producao/orders/:id/cancel", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [order] = await db.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "OP não encontrada" }); return; }
  if (order.status === "finished") { res.status(400).json({ error: "OP finalizada não pode ser cancelada" }); return; }
  const [row] = await db.update(productionOrdersTable).set({ status: "cancelled" }).where(eq(productionOrdersTable.id, id)).returning();
  res.json(row);
});

// ─── Production Stages ─────────────────────────────────────────────────────────

router.get("/producao/orders/:id/stages", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const stages = await db.select().from(productionStagesTable).where(eq(productionStagesTable.orderId, id)).orderBy(asc(productionStagesTable.sequence));
  res.json(stages);
});

router.put("/producao/stages/:id/start", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [stage] = await db.select().from(productionStagesTable).where(eq(productionStagesTable.id, id));
  if (!stage) { res.status(404).json({ error: "Etapa não encontrada" }); return; }
  if (stage.status !== "pending") { res.status(400).json({ error: "Etapa já iniciada ou concluída" }); return; }
  // Enforce sequence: all prior stages must be done
  if (stage.sequence > 1) {
    const priorStages = await db
      .select({ status: productionStagesTable.status, sequence: productionStagesTable.sequence })
      .from(productionStagesTable)
      .where(and(eq(productionStagesTable.orderId, stage.orderId), lt(productionStagesTable.sequence, stage.sequence)));
    const incomplete = priorStages.find((s) => s.status !== "done");
    if (incomplete) {
      res.status(400).json({ error: `Etapa anterior (sequência ${incomplete.sequence}) ainda não foi concluída. Siga a ordem: pesagem → mistura → produção → embalagem.` });
      return;
    }
  }
  const { operatorId, operatorName, equipment, qtyIn } = req.body;
  const [row] = await db
    .update(productionStagesTable)
    .set({
      status: "in_progress",
      startedAt: new Date(),
      operatorId: operatorId ? Number(operatorId) : null,
      operatorName: operatorName || null,
      equipment: equipment || null,
      qtyIn: qtyIn ? String(qtyIn) : null,
    })
    .where(eq(productionStagesTable.id, id))
    .returning();
  res.json(row);
});

router.put("/producao/stages/:id/finish", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [stage] = await db.select().from(productionStagesTable).where(eq(productionStagesTable.id, id));
  if (!stage) { res.status(404).json({ error: "Etapa não encontrada" }); return; }
  if (stage.status !== "in_progress") { res.status(400).json({ error: "Etapa não está em andamento" }); return; }

  const { qtyOut, losses, notes, consumptions } = req.body as {
    qtyOut?: string | number;
    losses?: string | number;
    notes?: string;
    consumptions?: Array<{
      formulaItemId?: number;
      lotId: number;
      actualQty: number;
      plannedQty?: number;
      notes?: string;
    }>;
  };

  // ── Phase 1: Validate all consumptions BEFORE any writes ────────────────
  // Enforce: weighing stage requires at least one lot consumption
  const isWeighing = stage.stageType === "weighing";
  const consumptionList = Array.isArray(consumptions) ? consumptions.filter((c) => c.lotId && c.actualQty) : [];
  if (isWeighing && consumptionList.length === 0) {
    res.status(400).json({ error: "A etapa de pesagem exige o registro de pelo menos um lote de matéria-prima consumido." });
    return;
  }

  // Pre-validate each consumption and build enriched records (no DB writes yet)
  type EnrichedConsumption = {
    formulaItemId: number | null;
    productId: number | null;
    productName: string;
    lotId: number;
    internalLot: string | null;
    plannedQty: string | null;
    actualQty: string;
    unit: string;
    notes: string | null;
  };
  const enriched: EnrichedConsumption[] = [];
  const recordedBy = req.session.userName ?? "Sistema";

  for (const c of consumptionList) {
    const [lot] = await db
      .select({
        internalLot: productLotsTable.internalLot,
        productId: productLotsTable.productId,
        productName: productsTable.name,
        cqStatus: productLotsTable.cqStatus,
        availableQty: productLotsTable.availableQty,
      })
      .from(productLotsTable)
      .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
      .where(eq(productLotsTable.id, c.lotId));

    if (!lot) {
      res.status(400).json({ error: `Lote ID ${c.lotId} não encontrado.` });
      return;
    }
    if (lot.cqStatus !== "approved") {
      res.status(400).json({ error: `Lote ${lot.internalLot} não está aprovado pelo CQ (status: ${lot.cqStatus}). Só lotes aprovados podem ser consumidos.` });
      return;
    }
    const actualQtyNum = parseFloat(String(c.actualQty));
    const availableQtyNum = parseFloat(lot.availableQty ?? "0");
    if (actualQtyNum > availableQtyNum) {
      res.status(400).json({ error: `Saldo insuficiente no lote ${lot.internalLot}: disponível ${availableQtyNum} kg, solicitado ${actualQtyNum} kg.` });
      return;
    }

    let productId: number | null = lot.productId ?? null;
    let productName: string = lot.productName ?? "";
    if (c.formulaItemId) {
      const [fi] = await db
        .select({ productId: formulaItemsTable.productId, productName: formulaItemsTable.productName })
        .from(formulaItemsTable)
        .where(eq(formulaItemsTable.id, c.formulaItemId));
      if (fi) {
        if (fi.productId && lot.productId && fi.productId !== lot.productId) {
          res.status(400).json({ error: `Lote ${lot.internalLot} é de produto diferente do item da fórmula (${fi.productName}).` });
          return;
        }
        productId = fi.productId ?? productId;
        productName = fi.productName || productName;
      }
    }

    enriched.push({
      formulaItemId: c.formulaItemId ?? null,
      productId,
      productName,
      lotId: c.lotId,
      internalLot: lot.internalLot ?? null,
      plannedQty: c.plannedQty ? String(c.plannedQty) : null,
      actualQty: String(c.actualQty),
      unit: "kg",
      notes: c.notes ?? null,
    });
  }

  // ── Phase 2: Atomic transaction — update stage + insert consumptions ─────
  const qtyIn = parseFloat(stage.qtyIn ?? "0");
  const qtyOutN = parseFloat(String(qtyOut ?? "0"));
  const lossesN = parseFloat(String(losses ?? "0"));
  const yieldPct = qtyIn > 0 ? ((qtyOutN / qtyIn) * 100).toFixed(2) : null;

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(productionStagesTable)
      .set({
        status: "done",
        finishedAt: new Date(),
        qtyOut: qtyOut ? String(qtyOut) : null,
        losses: losses ? String(lossesN) : null,
        yieldPct: yieldPct ? String(yieldPct) : null,
        notes: notes || stage.notes,
      })
      .where(eq(productionStagesTable.id, id))
      .returning();

    if (enriched.length > 0) {
      await tx.insert(productionMaterialConsumptionsTable).values(
        enriched.map((e) => ({
          orderId: stage.orderId,
          stageId: id,
          formulaItemId: e.formulaItemId,
          productId: e.productId,
          productName: e.productName,
          lotId: e.lotId,
          internalLot: e.internalLot,
          plannedQty: e.plannedQty,
          actualQty: e.actualQty,
          unit: e.unit,
          recordedBy,
          notes: e.notes,
        }))
      );
      // Atomically decrement availableQty for each consumed lot
      for (const e of enriched) {
        await tx
          .update(productLotsTable)
          .set({ availableQty: sql`${productLotsTable.availableQty} - ${e.actualQty}::numeric` })
          .where(eq(productLotsTable.id, e.lotId));
      }
    }
    return updated;
  });

  res.json(row);
});

router.put("/producao/stages/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [stage] = await db.select().from(productionStagesTable).where(eq(productionStagesTable.id, id));
  if (!stage) { res.status(404).json({ error: "Etapa não encontrada" }); return; }
  const { operatorName, equipment, notes } = req.body;
  const [row] = await db
    .update(productionStagesTable)
    .set({
      operatorName: operatorName !== undefined ? (operatorName || null) : stage.operatorName,
      equipment: equipment !== undefined ? (equipment || null) : stage.equipment,
      notes: notes !== undefined ? (notes || null) : stage.notes,
    })
    .where(eq(productionStagesTable.id, id))
    .returning();
  res.json(row);
});

// ─── Traceability ──────────────────────────────────────────────────────────────

router.get("/producao/orders/:id/traceability", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [order] = await db.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "OP não encontrada" }); return; }
  const stages = await db
    .select()
    .from(productionStagesTable)
    .where(eq(productionStagesTable.orderId, id))
    .orderBy(asc(productionStagesTable.sequence));

  // Fetch actual consumption records for this order (real traceability by lot)
  const consumptions = await db
    .select({
      id: productionMaterialConsumptionsTable.id,
      stageId: productionMaterialConsumptionsTable.stageId,
      formulaItemId: productionMaterialConsumptionsTable.formulaItemId,
      productId: productionMaterialConsumptionsTable.productId,
      productName: productionMaterialConsumptionsTable.productName,
      lotId: productionMaterialConsumptionsTable.lotId,
      internalLot: productionMaterialConsumptionsTable.internalLot,
      plannedQty: productionMaterialConsumptionsTable.plannedQty,
      actualQty: productionMaterialConsumptionsTable.actualQty,
      unit: productionMaterialConsumptionsTable.unit,
      recordedBy: productionMaterialConsumptionsTable.recordedBy,
      recordedAt: productionMaterialConsumptionsTable.recordedAt,
      notes: productionMaterialConsumptionsTable.notes,
      // Enrich from lots table
      supplierLot: productLotsTable.supplierLot,
      cqStatus: productLotsTable.cqStatus,
    })
    .from(productionMaterialConsumptionsTable)
    .leftJoin(productLotsTable, eq(productionMaterialConsumptionsTable.lotId, productLotsTable.id))
    .where(eq(productionMaterialConsumptionsTable.orderId, id))
    .orderBy(asc(productionMaterialConsumptionsTable.recordedAt));

  // Also attach formula items for reference (formula snapshot at OP creation)
  let formulaItems: any[] = [];
  if (order.formulaId) {
    formulaItems = await db
      .select()
      .from(formulaItemsTable)
      .where(eq(formulaItemsTable.formulaId, order.formulaId));
  }

  res.json({ order, stages, consumptions, formulaItems });
});

// ─── Traceability by PA lot ─────────────────────────────────────────────────

router.get("/producao/traceability/by-lot/:batchLot", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const batchLot = String(req.params.batchLot);
  if (!batchLot) { res.status(400).json({ error: "batchLot é obrigatório" }); return; }
  const [order] = await db.select().from(productionOrdersTable).where(eq(productionOrdersTable.batchLot, batchLot));
  if (!order) { res.status(404).json({ error: `Nenhuma OP encontrada para o lote PA: ${batchLot}` }); return; }

  const stages = await db
    .select()
    .from(productionStagesTable)
    .where(eq(productionStagesTable.orderId, order.id))
    .orderBy(asc(productionStagesTable.sequence));

  const consumptions = await db
    .select({
      id: productionMaterialConsumptionsTable.id,
      stageId: productionMaterialConsumptionsTable.stageId,
      formulaItemId: productionMaterialConsumptionsTable.formulaItemId,
      productId: productionMaterialConsumptionsTable.productId,
      productName: productionMaterialConsumptionsTable.productName,
      lotId: productionMaterialConsumptionsTable.lotId,
      internalLot: productionMaterialConsumptionsTable.internalLot,
      plannedQty: productionMaterialConsumptionsTable.plannedQty,
      actualQty: productionMaterialConsumptionsTable.actualQty,
      unit: productionMaterialConsumptionsTable.unit,
      recordedBy: productionMaterialConsumptionsTable.recordedBy,
      recordedAt: productionMaterialConsumptionsTable.recordedAt,
      notes: productionMaterialConsumptionsTable.notes,
      supplierLot: productLotsTable.supplierLot,
      cqStatus: productLotsTable.cqStatus,
    })
    .from(productionMaterialConsumptionsTable)
    .leftJoin(productLotsTable, eq(productionMaterialConsumptionsTable.lotId, productLotsTable.id))
    .where(eq(productionMaterialConsumptionsTable.orderId, order.id))
    .orderBy(asc(productionMaterialConsumptionsTable.recordedAt));

  let formulaItems: any[] = [];
  if (order.formulaId) {
    formulaItems = await db.select().from(formulaItemsTable).where(eq(formulaItemsTable.formulaId, order.formulaId));
  }

  res.json({ order, stages, consumptions, formulaItems });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get("/producao/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const [totalOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(productionOrdersTable);
  const [inProduction] = await db.select({ count: sql<number>`count(*)::int` }).from(productionOrdersTable).where(eq(productionOrdersTable.status, "in_production"));
  const [planned] = await db.select({ count: sql<number>`count(*)::int` }).from(productionOrdersTable).where(eq(productionOrdersTable.status, "planned"));
  const [released] = await db.select({ count: sql<number>`count(*)::int` }).from(productionOrdersTable).where(eq(productionOrdersTable.status, "released"));
  const [qualityCheck] = await db.select({ count: sql<number>`count(*)::int` }).from(productionOrdersTable).where(eq(productionOrdersTable.status, "quality_check"));
  const [finished] = await db.select({ count: sql<number>`count(*)::int` }).from(productionOrdersTable).where(eq(productionOrdersTable.status, "finished"));
  const [totalFormulas] = await db.select({ count: sql<number>`count(*)::int` }).from(formulasTable);
  const [approvedFormulas] = await db.select({ count: sql<number>`count(*)::int` }).from(formulasTable).where(eq(formulasTable.status, "approved"));
  // Recent orders
  const recentOrders = await db.select().from(productionOrdersTable).orderBy(desc(productionOrdersTable.createdAt)).limit(5);
  res.json({
    totalOrders: totalOrders?.count ?? 0,
    inProduction: inProduction?.count ?? 0,
    planned: planned?.count ?? 0,
    released: released?.count ?? 0,
    qualityCheck: qualityCheck?.count ?? 0,
    finished: finished?.count ?? 0,
    totalFormulas: totalFormulas?.count ?? 0,
    approvedFormulas: approvedFormulas?.count ?? 0,
    recentOrders,
  });
});

export default router;
