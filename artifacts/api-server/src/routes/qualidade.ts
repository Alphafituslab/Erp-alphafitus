import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc, sql, isNull, isNotNull } from "drizzle-orm";
import {
  db,
  qualityInspectionsTable,
  qualityNcrsTable,
  qualityAnalysesTable,
  analysisParametersTable,
  productsTable,
  productLotsTable,
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

// ─── Quality Analyses ─────────────────────────────────────────────────────────

router.get("/qualidade/analyses", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { status, productId, lotId } = req.query as Record<string, string>;
  const filters = [];

  if (status) filters.push(eq(qualityAnalysesTable.status, status));
  if (productId) {
    const pid = parseInt(productId);
    if (!isNaN(pid)) filters.push(eq(qualityAnalysesTable.productId, pid));
  }
  if (lotId) {
    const lid = parseInt(lotId);
    if (!isNaN(lid)) filters.push(eq(qualityAnalysesTable.lotId, lid));
  }

  const rows = await db
    .select()
    .from(qualityAnalysesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(
      sql`CASE status WHEN 'pending' THEN 1 WHEN 'in_analysis' THEN 2 WHEN 'approved' THEN 3 ELSE 4 END`,
      desc(qualityAnalysesTable.createdAt)
    );

  res.json(rows);
});

router.post("/qualidade/analyses", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { lotId, productId, productName, internalLot, sampleCode, analysisType, analystName, reviewerName, notes } = req.body;

  if (!sampleCode?.trim() || !analystName?.trim()) {
    res.status(400).json({ error: "Código da amostra e analista são obrigatórios" });
    return;
  }

  let resolvedProductName = productName || null;
  let resolvedInternalLot = internalLot || null;
  if (lotId && (!resolvedProductName || !resolvedInternalLot)) {
    const lid = parseInt(lotId);
    if (!isNaN(lid)) {
      const [lot] = await db
        .select({ internalLot: productLotsTable.internalLot, productId: productLotsTable.productId })
        .from(productLotsTable)
        .where(eq(productLotsTable.id, lid));
      if (lot) {
        if (!resolvedInternalLot) resolvedInternalLot = lot.internalLot;
        if (!resolvedProductName && lot.productId) {
          const [prod] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, lot.productId));
          if (prod) resolvedProductName = prod.name;
        }
      }
    }
  }

  const [analysis] = await db
    .insert(qualityAnalysesTable)
    .values({
      lotId: lotId ? parseInt(lotId) : null,
      productId: productId ? parseInt(productId) : null,
      productName: resolvedProductName,
      internalLot: resolvedInternalLot,
      sampleCode: sampleCode.trim(),
      analysisType: analysisType || "physical_chemical",
      analystName: analystName.trim(),
      reviewerName: reviewerName || null,
      status: "pending",
      notes: notes || null,
      justification: null,
      startedAt: null,
      completedAt: null,
    })
    .returning();

  res.status(201).json(analysis);
});

router.get("/qualidade/analyses/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [analysis] = await db
    .select()
    .from(qualityAnalysesTable)
    .where(eq(qualityAnalysesTable.id, id));

  if (!analysis) {
    res.status(404).json({ error: "Análise não encontrada" });
    return;
  }

  const parameters = await db
    .select()
    .from(analysisParametersTable)
    .where(eq(analysisParametersTable.analysisId, id))
    .orderBy(analysisParametersTable.id);

  res.json({ ...analysis, parameters });
});

router.put("/qualidade/analyses/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { lotId, productId, productName, internalLot, sampleCode, analysisType, analystName, reviewerName, notes } = req.body;

  if (!sampleCode?.trim() || !analystName?.trim()) {
    res.status(400).json({ error: "Código da amostra e analista são obrigatórios" });
    return;
  }

  const [analysis] = await db
    .update(qualityAnalysesTable)
    .set({
      lotId: lotId ? parseInt(lotId) : null,
      productId: productId ? parseInt(productId) : null,
      productName: productName || null,
      internalLot: internalLot || null,
      sampleCode: sampleCode.trim(),
      analysisType: analysisType || "physical_chemical",
      analystName: analystName.trim(),
      reviewerName: reviewerName || null,
      notes: notes || null,
    })
    .where(eq(qualityAnalysesTable.id, id))
    .returning();

  if (!analysis) {
    res.status(404).json({ error: "Análise não encontrada" });
    return;
  }

  res.json(analysis);
});

router.delete("/qualidade/analyses/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [deleted] = await db
    .delete(qualityAnalysesTable)
    .where(eq(qualityAnalysesTable.id, id))
    .returning({ id: qualityAnalysesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Análise não encontrada" });
    return;
  }

  res.json({ ok: true });
});

router.post("/qualidade/analyses/:id/start", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db.select().from(qualityAnalysesTable).where(eq(qualityAnalysesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Análise não encontrada" }); return; }

  if (existing.status !== "pending") {
    res.status(400).json({ error: "Apenas análises pendentes podem ser iniciadas" });
    return;
  }

  const [analysis] = await db
    .update(qualityAnalysesTable)
    .set({ status: "in_analysis", startedAt: new Date() })
    .where(eq(qualityAnalysesTable.id, id))
    .returning();

  res.json(analysis);
});

router.post("/qualidade/analyses/:id/complete", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { result, reviewerName, justification } = req.body ?? {};

  if (!result || !["approved", "rejected"].includes(result)) {
    res.status(400).json({ error: "Resultado deve ser approved ou rejected" });
    return;
  }

  const [existing] = await db.select().from(qualityAnalysesTable).where(eq(qualityAnalysesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Análise não encontrada" }); return; }

  if (!["pending", "in_analysis"].includes(existing.status)) {
    res.status(400).json({ error: "Análise já foi concluída" });
    return;
  }

  await db.transaction(async (tx) => {
    // Update analysis
    await tx
      .update(qualityAnalysesTable)
      .set({
        status: result,
        reviewerName: reviewerName || existing.reviewerName || null,
        justification: justification || null,
        completedAt: new Date(),
        startedAt: existing.startedAt ?? new Date(),
      })
      .where(eq(qualityAnalysesTable.id, id));

    // Auto-mark all pending parameters as conforming/non-conforming based on result
    await tx
      .update(analysisParametersTable)
      .set({ isConforming: result === "approved" })
      .where(
        and(
          eq(analysisParametersTable.analysisId, id),
          sql`${analysisParametersTable.isConforming} IS NULL`
        )
      );

    // CQ ↔ Estoque integration: update lot status
    if (existing.lotId) {
      const [lot] = await tx
        .select()
        .from(productLotsTable)
        .where(eq(productLotsTable.id, existing.lotId));

      if (lot) {
        let stockDelta = 0;
        const lotUpdates: Record<string, unknown> = {};

        if (result === "approved") {
          lotUpdates.cqStatus = "approved";
          const released = parseFloat(
            Math.max(
              0,
              parseFloat(String(lot.totalQty)) -
              parseFloat(String(lot.reservedQty)) -
              parseFloat(String(lot.blockedQty))
            ).toFixed(3)
          );
          lotUpdates.availableQty = String(released);
          stockDelta = released;
        } else {
          lotUpdates.cqStatus = "blocked";
          lotUpdates.availableQty = "0";
          lotUpdates.blockedQty = lot.totalQty;
          if (lot.cqStatus === "approved") {
            const wasAvailable = parseFloat(String(lot.availableQty));
            if (wasAvailable > 0) stockDelta = -wasAvailable;
          }
        }

        await tx
          .update(productLotsTable)
          .set(lotUpdates)
          .where(eq(productLotsTable.id, existing.lotId));

        if (stockDelta !== 0 && lot.productId) {
          await tx
            .update(productsTable)
            .set({
              currentStock: stockDelta > 0
                ? sql`${productsTable.currentStock} + ${stockDelta}`
                : sql`GREATEST(${productsTable.currentStock} + ${stockDelta}, 0)`,
            })
            .where(eq(productsTable.id, lot.productId));

          await tx.insert(stockMovementsTable).values({
            productId: lot.productId,
            type: stockDelta > 0 ? "input" : "output",
            quantity: String(Math.abs(stockDelta)),
            reason: stockDelta > 0
              ? `Liberação CQ — Lote ${lot.internalLot} aprovado (Análise #${id})`
              : `Bloqueio CQ — Lote ${lot.internalLot} reprovado (Análise #${id})`,
            referenceType: "cq_release",
            referenceId: id,
            notes: justification || null,
          });
        }

        // Auto-create NCR on rejection
        if (result === "rejected") {
          await tx.insert(qualityNcrsTable).values({
            productId: lot.productId,
            productName: existing.productName,
            title: `NC automática — Reprovação CQ: ${existing.productName ?? "Produto"} (Lote ${existing.internalLot ?? lot.internalLot})`,
            description: `Análise #${id} (${existing.sampleCode}) reprovada. ${justification || ""}`.trim(),
            severity: "high",
            status: "open",
            rootCause: null,
            correctiveAction: null,
            reportedBy: existing.analystName,
            assignedTo: null,
            dueDate: null,
            resolvedAt: null,
          });
        }
      }
    } else if (result === "rejected") {
      // No lot linked but still create NCR
      await tx.insert(qualityNcrsTable).values({
        productId: existing.productId,
        productName: existing.productName,
        title: `NC automática — Reprovação CQ: ${existing.productName ?? "Amostra"} (${existing.sampleCode})`,
        description: `Análise #${id} reprovada. ${justification || ""}`.trim(),
        severity: "high",
        status: "open",
        rootCause: null,
        correctiveAction: null,
        reportedBy: existing.analystName,
        assignedTo: null,
        dueDate: null,
        resolvedAt: null,
      });
    }
  });

  // Return analysis with parameters
  const [analysis] = await db.select().from(qualityAnalysesTable).where(eq(qualityAnalysesTable.id, id));
  const parameters = await db.select().from(analysisParametersTable).where(eq(analysisParametersTable.analysisId, id));

  res.json({ ...analysis, parameters });
});

// ─── Analysis Parameters ──────────────────────────────────────────────────────

router.post("/qualidade/analyses/:id/parameters", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const analysisId = parseId(req.params.id, res);
  if (analysisId === null) return;

  const { parameterName, specification, minValue, maxValue, resultValue, unit, isConforming } = req.body;

  if (!parameterName?.trim()) {
    res.status(400).json({ error: "Nome do parâmetro é obrigatório" });
    return;
  }

  const [param] = await db
    .insert(analysisParametersTable)
    .values({
      analysisId,
      parameterName: parameterName.trim(),
      specification: specification || null,
      minValue: minValue || null,
      maxValue: maxValue || null,
      resultValue: resultValue || null,
      unit: unit || null,
      isConforming: isConforming !== undefined ? Boolean(isConforming) : null,
    })
    .returning();

  res.status(201).json(param);
});

router.put("/qualidade/parameters/:parameterId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const parameterId = parseId(req.params.parameterId, res);
  if (parameterId === null) return;

  const { parameterName, specification, minValue, maxValue, resultValue, unit, isConforming } = req.body;

  if (!parameterName?.trim()) {
    res.status(400).json({ error: "Nome do parâmetro é obrigatório" });
    return;
  }

  // Auto-check conformance based on min/max if result provided
  let resolvedIsConforming: boolean | null = isConforming !== undefined ? Boolean(isConforming) : null;
  if (resultValue && resolvedIsConforming === null) {
    const rv = parseFloat(resultValue);
    if (!isNaN(rv)) {
      const min = minValue ? parseFloat(minValue) : null;
      const max = maxValue ? parseFloat(maxValue) : null;
      if (min !== null || max !== null) {
        resolvedIsConforming = (min === null || rv >= min) && (max === null || rv <= max);
      }
    }
  }

  const [param] = await db
    .update(analysisParametersTable)
    .set({
      parameterName: parameterName.trim(),
      specification: specification || null,
      minValue: minValue || null,
      maxValue: maxValue || null,
      resultValue: resultValue || null,
      unit: unit || null,
      isConforming: resolvedIsConforming,
    })
    .where(eq(analysisParametersTable.id, parameterId))
    .returning();

  if (!param) {
    res.status(404).json({ error: "Parâmetro não encontrado" });
    return;
  }

  res.json(param);
});

router.delete("/qualidade/parameters/:parameterId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const parameterId = parseId(req.params.parameterId, res);
  if (parameterId === null) return;

  const [deleted] = await db
    .delete(analysisParametersTable)
    .where(eq(analysisParametersTable.id, parameterId))
    .returning({ id: analysisParametersTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Parâmetro não encontrado" });
    return;
  }

  res.json({ ok: true });
});

// ─── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/qualidade/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  // Inspection stats
  const [totalInsp] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityInspectionsTable);
  const [approvedRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityInspectionsTable).where(eq(qualityInspectionsTable.result, "approved"));
  const [rejectedRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityInspectionsTable).where(eq(qualityInspectionsTable.result, "rejected"));
  const [conditionalRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityInspectionsTable).where(eq(qualityInspectionsTable.result, "conditional"));

  // NCR stats
  const [openNcrs] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityNcrsTable).where(eq(qualityNcrsTable.status, "open"));
  const [criticalNcrs] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(qualityNcrsTable)
    .where(and(eq(qualityNcrsTable.severity, "critical"), sql`${qualityNcrsTable.status} IN ('open', 'in_progress')`));

  const total = Number(totalInsp?.count ?? 0);
  const approved = Number(approvedRow?.count ?? 0);
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  // Analysis stats
  const [pendingAnalyses] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityAnalysesTable).where(eq(qualityAnalysesTable.status, "pending"));
  const [inAnalysisRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityAnalysesTable).where(eq(qualityAnalysesTable.status, "in_analysis"));
  const [approvedAnalyses] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityAnalysesTable).where(eq(qualityAnalysesTable.status, "approved"));
  const [rejectedAnalyses] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityAnalysesTable).where(eq(qualityAnalysesTable.status, "rejected"));

  const totalAnalyses = Number(approvedAnalyses?.count ?? 0) + Number(rejectedAnalyses?.count ?? 0);
  const analysisApprovalRate = totalAnalyses > 0 ? Math.round((Number(approvedAnalyses?.count ?? 0) / totalAnalyses) * 100) : 0;

  // Average analysis duration (completed only)
  const [avgRow] = await db
    .select({ avg: sql<string>`AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400)::text` })
    .from(qualityAnalysesTable)
    .where(and(
      sql`${qualityAnalysesTable.completedAt} IS NOT NULL`,
      sql`${qualityAnalysesTable.status} IN ('approved', 'rejected')`
    ));
  const avgDays = avgRow?.avg ? parseFloat(avgRow.avg) : null;
  const avgAnalysisDaysStr = avgDays !== null ? `${avgDays.toFixed(1)} dias` : "—";

  // Recent analyses
  const recentAnalyses = await db
    .select()
    .from(qualityAnalysesTable)
    .orderBy(desc(qualityAnalysesTable.createdAt))
    .limit(5);

  // Recent inspections
  const recentInspections = await db.select().from(qualityInspectionsTable).orderBy(desc(qualityInspectionsTable.createdAt)).limit(5);

  // Open NCRs
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
    pendingAnalysesCount: Number(pendingAnalyses?.count ?? 0),
    inAnalysisCount: Number(inAnalysisRow?.count ?? 0),
    analysisApprovalRate,
    avgAnalysisDaysStr,
    recentAnalyses,
  });
});

export default router;
