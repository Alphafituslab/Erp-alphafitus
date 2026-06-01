import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { db, qualityInspectionsTable, qualityNcrsTable, productsTable } from "@workspace/db";
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

// ─── Inspections ──────────────────────────────────────────────────────────────

router.get("/qualidade/inspections", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { productId, result, startDate, endDate } = req.query as Record<string, string>;
  const filters = [];

  if (productId) {
    const pid = parseInt(productId);
    if (!isNaN(pid)) filters.push(eq(qualityInspectionsTable.productId, pid));
  }
  if (result) filters.push(eq(qualityInspectionsTable.result, result));
  if (startDate) filters.push(gte(qualityInspectionsTable.inspectionDate, startDate));
  if (endDate) filters.push(lte(qualityInspectionsTable.inspectionDate, endDate));

  const rows = await db
    .select()
    .from(qualityInspectionsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(qualityInspectionsTable.inspectionDate), desc(qualityInspectionsTable.id));

  res.json(rows);
});

router.post("/qualidade/inspections", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { productId, productName, batchNumber, inspectionDate, inspector, result, quantityInspected, quantityFailed, notes } = req.body;

  if (!inspectionDate || !inspector || !inspector.trim()) {
    res.status(400).json({ error: "Data e inspetor são obrigatórios" });
    return;
  }
  if (!result || !["approved", "rejected", "conditional"].includes(result)) {
    res.status(400).json({ error: "Resultado deve ser approved, rejected ou conditional" });
    return;
  }

  // Resolve product name if productId provided and no name given
  let resolvedProductName = productName || null;
  if (productId && !resolvedProductName) {
    const [p] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, parseInt(productId)));
    if (p) resolvedProductName = p.name;
  }

  const [inspection] = await db
    .insert(qualityInspectionsTable)
    .values({
      productId: productId ? parseInt(productId) : null,
      productName: resolvedProductName,
      batchNumber: batchNumber || null,
      inspectionDate,
      inspector: inspector.trim(),
      result,
      quantityInspected: quantityInspected ? parseInt(quantityInspected) : 0,
      quantityFailed: quantityFailed ? parseInt(quantityFailed) : 0,
      notes: notes || null,
    })
    .returning();

  res.status(201).json(inspection);
});

router.put("/qualidade/inspections/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { productId, productName, batchNumber, inspectionDate, inspector, result, quantityInspected, quantityFailed, notes } = req.body;

  if (!inspectionDate || !inspector || !inspector.trim()) {
    res.status(400).json({ error: "Data e inspetor são obrigatórios" });
    return;
  }

  let resolvedProductName = productName || null;
  if (productId && !resolvedProductName) {
    const [p] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, parseInt(productId)));
    if (p) resolvedProductName = p.name;
  }

  const [inspection] = await db
    .update(qualityInspectionsTable)
    .set({
      productId: productId ? parseInt(productId) : null,
      productName: resolvedProductName,
      batchNumber: batchNumber || null,
      inspectionDate,
      inspector: inspector.trim(),
      result: result || "approved",
      quantityInspected: quantityInspected ? parseInt(quantityInspected) : 0,
      quantityFailed: quantityFailed ? parseInt(quantityFailed) : 0,
      notes: notes || null,
    })
    .where(eq(qualityInspectionsTable.id, id))
    .returning();

  if (!inspection) {
    res.status(404).json({ error: "Inspeção não encontrada" });
    return;
  }

  res.json(inspection);
});

router.delete("/qualidade/inspections/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [deleted] = await db
    .delete(qualityInspectionsTable)
    .where(eq(qualityInspectionsTable.id, id))
    .returning({ id: qualityInspectionsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Inspeção não encontrada" });
    return;
  }

  res.json({ ok: true });
});

// ─── NCRs ─────────────────────────────────────────────────────────────────────

router.get("/qualidade/ncrs", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { status, severity, productId } = req.query as Record<string, string>;
  const filters = [];

  if (status) filters.push(eq(qualityNcrsTable.status, status));
  if (severity) filters.push(eq(qualityNcrsTable.severity, severity));
  if (productId) {
    const pid = parseInt(productId);
    if (!isNaN(pid)) filters.push(eq(qualityNcrsTable.productId, pid));
  }

  const rows = await db
    .select()
    .from(qualityNcrsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(qualityNcrsTable.createdAt));

  res.json(rows);
});

router.post("/qualidade/ncrs", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { inspectionId, productId, productName, title, description, severity, status, rootCause, correctiveAction, reportedBy, assignedTo, dueDate } = req.body;

  if (!title || !title.trim()) {
    res.status(400).json({ error: "Título é obrigatório" });
    return;
  }

  let resolvedProductName = productName || null;
  if (productId && !resolvedProductName) {
    const [p] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, parseInt(productId)));
    if (p) resolvedProductName = p.name;
  }

  const [ncr] = await db
    .insert(qualityNcrsTable)
    .values({
      inspectionId: inspectionId ? parseInt(inspectionId) : null,
      productId: productId ? parseInt(productId) : null,
      productName: resolvedProductName,
      title: title.trim(),
      description: description || null,
      severity: severity || "medium",
      status: status || "open",
      rootCause: rootCause || null,
      correctiveAction: correctiveAction || null,
      reportedBy: reportedBy || null,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
      resolvedAt: null,
    })
    .returning();

  res.status(201).json(ncr);
});

router.put("/qualidade/ncrs/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { inspectionId, productId, productName, title, description, severity, status, rootCause, correctiveAction, reportedBy, assignedTo, dueDate } = req.body;

  if (!title || !title.trim()) {
    res.status(400).json({ error: "Título é obrigatório" });
    return;
  }

  let resolvedProductName = productName || null;
  if (productId && !resolvedProductName) {
    const [p] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, parseInt(productId)));
    if (p) resolvedProductName = p.name;
  }

  const [ncr] = await db
    .update(qualityNcrsTable)
    .set({
      inspectionId: inspectionId ? parseInt(inspectionId) : null,
      productId: productId ? parseInt(productId) : null,
      productName: resolvedProductName,
      title: title.trim(),
      description: description || null,
      severity: severity || "medium",
      status: status || "open",
      rootCause: rootCause || null,
      correctiveAction: correctiveAction || null,
      reportedBy: reportedBy || null,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
    })
    .where(eq(qualityNcrsTable.id, id))
    .returning();

  if (!ncr) {
    res.status(404).json({ error: "NCR não encontrada" });
    return;
  }

  res.json(ncr);
});

router.delete("/qualidade/ncrs/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [deleted] = await db
    .delete(qualityNcrsTable)
    .where(eq(qualityNcrsTable.id, id))
    .returning({ id: qualityNcrsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "NCR não encontrada" });
    return;
  }

  res.json({ ok: true });
});

router.post("/qualidade/ncrs/:id/resolve", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { correctiveAction } = req.body ?? {};

  const updateValues: Record<string, unknown> = {
    status: "resolved",
    resolvedAt: new Date(),
  };
  if (correctiveAction) updateValues.correctiveAction = correctiveAction;

  const [ncr] = await db
    .update(qualityNcrsTable)
    .set(updateValues)
    .where(eq(qualityNcrsTable.id, id))
    .returning();

  if (!ncr) {
    res.status(404).json({ error: "NCR não encontrada" });
    return;
  }

  res.json(ncr);
});

// ─── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/qualidade/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  // Inspection stats
  const [totalInsp] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(qualityInspectionsTable);

  const [approvedRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(qualityInspectionsTable)
    .where(eq(qualityInspectionsTable.result, "approved"));

  const [rejectedRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(qualityInspectionsTable)
    .where(eq(qualityInspectionsTable.result, "rejected"));

  const [conditionalRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(qualityInspectionsTable)
    .where(eq(qualityInspectionsTable.result, "conditional"));

  // NCR stats
  const [openNcrs] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(qualityNcrsTable)
    .where(eq(qualityNcrsTable.status, "open"));

  const [criticalNcrs] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(qualityNcrsTable)
    .where(
      and(
        eq(qualityNcrsTable.severity, "critical"),
        sql`${qualityNcrsTable.status} IN ('open', 'in_progress')`
      )
    );

  // Approval rate
  const total = Number(totalInsp?.count ?? 0);
  const approved = Number(approvedRow?.count ?? 0);
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  // Recent inspections
  const recentInspections = await db
    .select()
    .from(qualityInspectionsTable)
    .orderBy(desc(qualityInspectionsTable.createdAt))
    .limit(5);

  // Open NCRs ordered by severity
  const openNcrList = await db
    .select()
    .from(qualityNcrsTable)
    .where(sql`${qualityNcrsTable.status} IN ('open', 'in_progress')`)
    .orderBy(
      sql`CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
      desc(qualityNcrsTable.createdAt)
    )
    .limit(5);

  res.json({
    totalInspections: total,
    approvedCount: approved,
    rejectedCount: Number(rejectedRow?.count ?? 0),
    conditionalCount: Number(conditionalRow?.count ?? 0),
    approvalRate,
    openNcrsCount: Number(openNcrs?.count ?? 0),
    criticalNcrsCount: Number(criticalNcrs?.count ?? 0),
    recentInspections,
    openNcrList,
  });
});

export default router;
