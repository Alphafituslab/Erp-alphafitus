import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc, sql, isNull, lt } from "drizzle-orm";
import multer from "multer";
import {
  db,
  qualityInspectionsTable,
  qualityNcrsTable,
  capaActionsTable,
  capaEvidencesTable,
  qualityAnalysesTable,
  analysisParametersTable,
  qualityCertificatesTable,
  productsTable,
  productLotsTable,
  stockMovementsTable,
  purchaseOrdersTable,
  purchaseOrderItemsTable,
  suppliersTable,
} from "@workspace/db";
import type { Request, Response } from "express";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

function certNumber(id: number): string {
  return `CERT-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;
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

  if (!inspectionDate || !inspector?.trim()) {
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

  if (!inspectionDate || !inspector?.trim()) {
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

  if (!inspection) { res.status(404).json({ error: "Inspeção não encontrada" }); return; }
  res.json(inspection);
});

router.delete("/qualidade/inspections/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [deleted] = await db.delete(qualityInspectionsTable).where(eq(qualityInspectionsTable.id, id)).returning({ id: qualityInspectionsTable.id });
  if (!deleted) { res.status(404).json({ error: "Inspeção não encontrada" }); return; }
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

  const { inspectionId, productId, productName, title, description, severity, status, rootCause, correctiveAction, reportedBy, assignedTo, dueDate, ncType, origin } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: "Título é obrigatório" }); return; }

  let resolvedProductName = productName || null;
  if (productId && !resolvedProductName) {
    const [p] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, parseInt(productId)));
    if (p) resolvedProductName = p.name;
  }

  const [ncr] = await db.insert(qualityNcrsTable).values({
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
    ncType: ncType || null,
    origin: origin || null,
  }).returning();

  res.status(201).json(ncr);
});

router.put("/qualidade/ncrs/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { inspectionId, productId, productName, title, description, severity, status, rootCause, correctiveAction, reportedBy, assignedTo, dueDate, ncType, origin, whyAnalysis, ishikawaCategories, investigatedBy, verifiedBy, verificationNotes, closedBy } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: "Título é obrigatório" }); return; }

  let resolvedProductName = productName || null;
  if (productId && !resolvedProductName) {
    const [p] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, parseInt(productId)));
    if (p) resolvedProductName = p.name;
  }

  const [ncr] = await db.update(qualityNcrsTable).set({
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
    ncType: ncType || null,
    origin: origin || null,
    whyAnalysis: whyAnalysis || null,
    ishikawaCategories: ishikawaCategories || null,
    investigatedBy: investigatedBy || null,
    verifiedBy: verifiedBy || null,
    verificationNotes: verificationNotes || null,
    closedBy: closedBy || null,
  }).where(eq(qualityNcrsTable.id, id)).returning();

  if (!ncr) { res.status(404).json({ error: "NCR não encontrada" }); return; }
  res.json(ncr);
});

router.delete("/qualidade/ncrs/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [deleted] = await db.delete(qualityNcrsTable).where(eq(qualityNcrsTable.id, id)).returning({ id: qualityNcrsTable.id });
  if (!deleted) { res.status(404).json({ error: "NCR não encontrada" }); return; }
  res.json({ ok: true });
});

router.post("/qualidade/ncrs/:id/resolve", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { correctiveAction } = req.body ?? {};
  const updateValues: Record<string, unknown> = { status: "resolved", resolvedAt: new Date() };
  if (correctiveAction) updateValues.correctiveAction = correctiveAction;

  const [ncr] = await db.update(qualityNcrsTable).set(updateValues).where(eq(qualityNcrsTable.id, id)).returning();
  if (!ncr) { res.status(404).json({ error: "NCR não encontrada" }); return; }
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

  // FIX #2: Pending/in_analysis sorted oldest-first (priority by aging).
  // Completed analyses sorted newest-first for history.
  const rows = await db
    .select()
    .from(qualityAnalysesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(
      sql`CASE status WHEN 'pending' THEN 1 WHEN 'in_analysis' THEN 2 WHEN 'approved' THEN 3 ELSE 4 END`,
      sql`CASE WHEN status IN ('pending','in_analysis') THEN EXTRACT(EPOCH FROM created_at) ELSE -EXTRACT(EPOCH FROM created_at) END ASC`
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
  let resolvedProductId = productId ? parseInt(productId) : null;

  // Auto-populate from lot when lotId is provided
  if (lotId) {
    const lid = parseInt(lotId);
    if (!isNaN(lid)) {
      const [lot] = await db.select().from(productLotsTable).where(eq(productLotsTable.id, lid));
      if (lot) {
        if (!resolvedInternalLot) resolvedInternalLot = lot.internalLot;
        if (!resolvedProductId) resolvedProductId = lot.productId;
        if (!resolvedProductName && lot.productId) {
          const [prod] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, lot.productId));
          if (prod) resolvedProductName = prod.name;
        }
      }
    }
  } else if (resolvedProductId && !resolvedProductName) {
    const [prod] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, resolvedProductId));
    if (prod) resolvedProductName = prod.name;
  }

  const [analysis] = await db.insert(qualityAnalysesTable).values({
    lotId: lotId ? parseInt(lotId) : null,
    productId: resolvedProductId,
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
  }).returning();

  res.status(201).json(analysis);
});

router.get("/qualidade/analyses/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [analysis] = await db.select().from(qualityAnalysesTable).where(eq(qualityAnalysesTable.id, id));
  if (!analysis) { res.status(404).json({ error: "Análise não encontrada" }); return; }

  const parameters = await db.select().from(analysisParametersTable).where(eq(analysisParametersTable.analysisId, id)).orderBy(analysisParametersTable.id);
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

  const [analysis] = await db.update(qualityAnalysesTable).set({
    lotId: lotId ? parseInt(lotId) : null,
    productId: productId ? parseInt(productId) : null,
    productName: productName || null,
    internalLot: internalLot || null,
    sampleCode: sampleCode.trim(),
    analysisType: analysisType || "physical_chemical",
    analystName: analystName.trim(),
    reviewerName: reviewerName || null,
    notes: notes || null,
  }).where(eq(qualityAnalysesTable.id, id)).returning();

  if (!analysis) { res.status(404).json({ error: "Análise não encontrada" }); return; }
  res.json(analysis);
});

router.delete("/qualidade/analyses/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [deleted] = await db.delete(qualityAnalysesTable).where(eq(qualityAnalysesTable.id, id)).returning({ id: qualityAnalysesTable.id });
  if (!deleted) { res.status(404).json({ error: "Análise não encontrada" }); return; }
  res.json({ ok: true });
});

router.post("/qualidade/analyses/:id/start", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db.select().from(qualityAnalysesTable).where(eq(qualityAnalysesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Análise não encontrada" }); return; }
  if (existing.status !== "pending") { res.status(400).json({ error: "Apenas análises pendentes podem ser iniciadas" }); return; }

  const [analysis] = await db.update(qualityAnalysesTable).set({ status: "in_analysis", startedAt: new Date() }).where(eq(qualityAnalysesTable.id, id)).returning();
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
    const now = new Date();

    await tx.update(qualityAnalysesTable).set({
      status: result,
      reviewerName: reviewerName || existing.reviewerName || null,
      justification: justification || null,
      completedAt: now,
      startedAt: existing.startedAt ?? now,
    }).where(eq(qualityAnalysesTable.id, id));

    // Auto-mark pending parameters (null isConforming) with bulk result
    await tx.update(analysisParametersTable).set({ isConforming: result === "approved" }).where(
      and(eq(analysisParametersTable.analysisId, id), isNull(analysisParametersTable.isConforming))
    );

    // FIX #3: Fetch params AFTER auto-mark so snapshot reflects final values
    const params = await tx.select().from(analysisParametersTable).where(eq(analysisParametersTable.analysisId, id));

    // CQ ↔ Estoque: idempotent lot state transition (FIX #5)
    if (existing.lotId) {
      const [lot] = await tx.select().from(productLotsTable).where(eq(productLotsTable.id, existing.lotId));
      if (lot) {
        const prevAvailable = parseFloat(String(lot.availableQty));
        const totalQty = parseFloat(String(lot.totalQty));
        const reservedQty = parseFloat(String(lot.reservedQty));
        let stockDelta = 0;
        const lotUpdates: Record<string, unknown> = {};

        if (result === "approved") {
          // Released = totalQty - reservedQty (max available after releasing quarantine)
          const released = Math.max(0, totalQty - reservedQty);
          lotUpdates.cqStatus = "approved";
          lotUpdates.availableQty = String(released);
          lotUpdates.blockedQty = "0"; // clear any prior block
          // Only add delta that wasn't already available (idempotent)
          stockDelta = released - prevAvailable;
        } else {
          // rejected: block all stock — only subtract what was currently available
          lotUpdates.cqStatus = "blocked";
          lotUpdates.availableQty = "0";
          lotUpdates.blockedQty = String(totalQty);
          stockDelta = -prevAvailable;
        }

        await tx.update(productLotsTable).set(lotUpdates).where(eq(productLotsTable.id, existing.lotId));

        if (stockDelta !== 0 && lot.productId) {
          await tx.update(productsTable).set({
            currentStock: stockDelta > 0
              ? sql`${productsTable.currentStock} + ${stockDelta}`
              : sql`GREATEST(${productsTable.currentStock} + ${stockDelta}, 0)`,
          }).where(eq(productsTable.id, lot.productId));

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

    // FIX #3: Persist quality certificate (parameters snapshot as JSON)
    const certParams = params.map((p) => ({
      parameterName: p.parameterName,
      specification: p.specification,
      minValue: p.minValue,
      maxValue: p.maxValue,
      resultValue: p.resultValue,
      unit: p.unit,
      isConforming: p.isConforming,
    }));

    const [newCert] = await tx.insert(qualityCertificatesTable).values({
      analysisId: id,
      certificateNumber: "PENDING",
      sampleCode: existing.sampleCode,
      productId: existing.productId,
      productName: existing.productName,
      internalLot: existing.internalLot,
      analysisType: existing.analysisType,
      result,
      analystName: existing.analystName,
      reviewerName: reviewerName || existing.reviewerName || null,
      justification: justification || null,
      parametersSnapshot: JSON.stringify(certParams),
      issuedAt: now,
    }).returning();

    // Update certificate number now that we have the real ID
    if (newCert) {
      await tx.update(qualityCertificatesTable)
        .set({ certificateNumber: certNumber(newCert.id) })
        .where(eq(qualityCertificatesTable.id, newCert.id));
    }
  });

  const [analysis] = await db.select().from(qualityAnalysesTable).where(eq(qualityAnalysesTable.id, id));
  const updatedParams = await db.select().from(analysisParametersTable).where(eq(analysisParametersTable.analysisId, id));
  res.json({ ...analysis, parameters: updatedParams });
});

// ─── Analysis Parameters ──────────────────────────────────────────────────────

router.post("/qualidade/analyses/:id/parameters", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const analysisId = parseId(req.params.id, res);
  if (analysisId === null) return;

  const { parameterName, specification, minValue, maxValue, resultValue, unit, isConforming } = req.body;
  if (!parameterName?.trim()) { res.status(400).json({ error: "Nome do parâmetro é obrigatório" }); return; }

  // FIX #2 (POST): auto-compute conformance from min/max range at creation, same as PUT
  let resolvedIsConforming: boolean | null = isConforming !== undefined && isConforming !== null ? Boolean(isConforming) : null;
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

  const [param] = await db.insert(analysisParametersTable).values({
    analysisId,
    parameterName: parameterName.trim(),
    specification: specification || null,
    minValue: minValue || null,
    maxValue: maxValue || null,
    resultValue: resultValue || null,
    unit: unit || null,
    isConforming: resolvedIsConforming,
  }).returning();

  res.status(201).json(param);
});

router.put("/qualidade/parameters/:parameterId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const parameterId = parseId(req.params.parameterId, res);
  if (parameterId === null) return;

  const { parameterName, specification, minValue, maxValue, resultValue, unit, isConforming } = req.body;
  if (!parameterName?.trim()) { res.status(400).json({ error: "Nome do parâmetro é obrigatório" }); return; }

  let resolvedIsConforming: boolean | null = isConforming !== undefined && isConforming !== null ? Boolean(isConforming) : null;
  // Auto-check conformance by min/max if result provided and no explicit override
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

  const [param] = await db.update(analysisParametersTable).set({
    parameterName: parameterName.trim(),
    specification: specification || null,
    minValue: minValue || null,
    maxValue: maxValue || null,
    resultValue: resultValue || null,
    unit: unit || null,
    isConforming: resolvedIsConforming,
  }).where(eq(analysisParametersTable.id, parameterId)).returning();

  if (!param) { res.status(404).json({ error: "Parâmetro não encontrado" }); return; }
  res.json(param);
});

router.delete("/qualidade/parameters/:parameterId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const parameterId = parseId(req.params.parameterId, res);
  if (parameterId === null) return;
  const [deleted] = await db.delete(analysisParametersTable).where(eq(analysisParametersTable.id, parameterId)).returning({ id: analysisParametersTable.id });
  if (!deleted) { res.status(404).json({ error: "Parâmetro não encontrado" }); return; }
  res.json({ ok: true });
});

// ─── Quality Certificates ─────────────────────────────────────────────────────

router.get("/qualidade/certificates", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const rows = await db.select().from(qualityCertificatesTable).orderBy(desc(qualityCertificatesTable.issuedAt));
  res.json(rows);
});

router.get("/qualidade/certificates/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [cert] = await db.select().from(qualityCertificatesTable).where(eq(qualityCertificatesTable.id, id));
  if (!cert) { res.status(404).json({ error: "Certificado não encontrado" }); return; }
  res.json(cert);
});

// ─── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/qualidade/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const [totalInsp] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityInspectionsTable);
  const [approvedRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityInspectionsTable).where(eq(qualityInspectionsTable.result, "approved"));
  const [rejectedRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityInspectionsTable).where(eq(qualityInspectionsTable.result, "rejected"));
  const [conditionalRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityInspectionsTable).where(eq(qualityInspectionsTable.result, "conditional"));

  const [openNcrs] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityNcrsTable).where(eq(qualityNcrsTable.status, "open"));
  const [criticalNcrs] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityNcrsTable).where(and(eq(qualityNcrsTable.severity, "critical"), sql`${qualityNcrsTable.status} IN ('open','in_progress')`));

  const total = Number(totalInsp?.count ?? 0);
  const approved = Number(approvedRow?.count ?? 0);
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  const [pendingAnalyses] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityAnalysesTable).where(eq(qualityAnalysesTable.status, "pending"));
  const [inAnalysisRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityAnalysesTable).where(eq(qualityAnalysesTable.status, "in_analysis"));
  const [approvedAnalyses] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityAnalysesTable).where(eq(qualityAnalysesTable.status, "approved"));
  const [rejectedAnalyses] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(qualityAnalysesTable).where(eq(qualityAnalysesTable.status, "rejected"));

  const totalAnalyses = Number(approvedAnalyses?.count ?? 0) + Number(rejectedAnalyses?.count ?? 0);
  const analysisApprovalRate = totalAnalyses > 0 ? Math.round((Number(approvedAnalyses?.count ?? 0) / totalAnalyses) * 100) : 0;

  const [avgRow] = await db.select({ avg: sql<string>`AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400)::text` }).from(qualityAnalysesTable).where(
    and(sql`${qualityAnalysesTable.completedAt} IS NOT NULL`, sql`${qualityAnalysesTable.status} IN ('approved','rejected')`)
  );
  const avgDays = avgRow?.avg ? parseFloat(avgRow.avg) : null;
  const avgAnalysisDaysStr = avgDays !== null ? `${avgDays.toFixed(1)} dias` : "—";

  const recentAnalyses = await db.select().from(qualityAnalysesTable).orderBy(desc(qualityAnalysesTable.createdAt)).limit(5);
  const recentInspections = await db.select().from(qualityInspectionsTable).orderBy(desc(qualityInspectionsTable.createdAt)).limit(5);
  const openNcrList = await db.select().from(qualityNcrsTable)
    .where(sql`${qualityNcrsTable.status} IN ('open','in_progress')`)
    .orderBy(sql`CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`, desc(qualityNcrsTable.createdAt))
    .limit(5);

  // FIX #4: Parameter rejection index — top non-conforming parameters across all analyses
  const topRejectedParametersRaw = await db
    .select({
      parameterName: analysisParametersTable.parameterName,
      rejectCount: sql<number>`COUNT(*) FILTER (WHERE is_conforming = false)::int`,
      totalCount: sql<number>`COUNT(*)::int`,
    })
    .from(analysisParametersTable)
    .groupBy(analysisParametersTable.parameterName)
    .having(sql`COUNT(*) > 0`)
    .orderBy(sql`COUNT(*) FILTER (WHERE is_conforming = false) DESC`)
    .limit(10);

  const topRejectedParameters = topRejectedParametersRaw
    .filter((r) => Number(r.rejectCount) > 0)
    .map((r) => ({
      parameterName: r.parameterName,
      rejectCount: Number(r.rejectCount),
      totalCount: Number(r.totalCount),
      rejectionRate: Number(r.totalCount) > 0 ? Math.round((Number(r.rejectCount) / Number(r.totalCount)) * 100) : 0,
    }));

  // FIX #1: Supplier quality KPIs — join quality_analyses → purchase_order_items → purchase_orders → suppliers
  const supplierQualityRaw = await db
    .select({
      supplierId: suppliersTable.id,
      supplierName: suppliersTable.name,
      approvedCount: sql<number>`COUNT(*) FILTER (WHERE ${qualityAnalysesTable.status} = 'approved')::int`,
      rejectedCount: sql<number>`COUNT(*) FILTER (WHERE ${qualityAnalysesTable.status} = 'rejected')::int`,
      totalCount: sql<number>`COUNT(*)::int`,
    })
    .from(qualityAnalysesTable)
    .innerJoin(purchaseOrderItemsTable, eq(purchaseOrderItemsTable.productId, qualityAnalysesTable.productId!))
    .innerJoin(purchaseOrdersTable, eq(purchaseOrdersTable.id, purchaseOrderItemsTable.purchaseOrderId))
    .innerJoin(suppliersTable, eq(suppliersTable.id, purchaseOrdersTable.supplierId))
    .where(
      and(
        sql`${qualityAnalysesTable.status} IN ('approved','rejected')`,
        sql`${qualityAnalysesTable.productId} IS NOT NULL`
      )
    )
    .groupBy(suppliersTable.id, suppliersTable.name)
    .having(sql`COUNT(*) > 0`)
    .orderBy(sql`COUNT(*) FILTER (WHERE ${qualityAnalysesTable.status} = 'rejected') DESC`)
    .limit(10);

  const supplierQuality = supplierQualityRaw.map((s) => ({
    supplierId: Number(s.supplierId),
    supplierName: s.supplierName,
    approvedCount: Number(s.approvedCount),
    rejectedCount: Number(s.rejectedCount),
    totalCount: Number(s.totalCount),
    approvalRate: Number(s.totalCount) > 0 ? Math.round((Number(s.approvedCount) / Number(s.totalCount)) * 100) : 0,
  }));

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
    topRejectedParameters,
    supplierQuality,
  });
});

// ─── CAPA: NCR Detail ─────────────────────────────────────────────────────────

router.get("/qualidade/ncrs/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [ncr] = await db.select().from(qualityNcrsTable).where(eq(qualityNcrsTable.id, id));
  if (!ncr) { res.status(404).json({ error: "NCR não encontrada" }); return; }

  const today = new Date().toISOString().slice(0, 10);
  const actions = await db.select().from(capaActionsTable).where(eq(capaActionsTable.ncrId, id)).orderBy(capaActionsTable.id);
  // Auto-mark overdue actions
  const enrichedActions = actions.map((a) => ({
    ...a,
    status: a.status !== "done" && a.dueDate && a.dueDate < today ? "overdue" : a.status,
  }));

  res.json({ ...ncr, actions: enrichedActions });
});

// ─── CAPA: Status Transition ──────────────────────────────────────────────────

// Sequential CAPA workflow: each stage must be reached in order.
// Direct jumps to "closed" are not allowed except from effectiveness_check.
const CAPA_TRANSITIONS: Record<string, string[]> = {
  open:                 ["investigation"],
  investigation:        ["action_plan"],
  action_plan:          ["execution"],
  execution:            ["effectiveness_check"],
  effectiveness_check:  ["closed"],
  // Legacy BC statuses (pre-CAPA) — allow limited forward movement
  in_progress:          ["investigation", "resolved"],
  resolved:             ["closed"],
};

router.post("/qualidade/ncrs/:id/transition", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { toStatus, investigatedBy, verifiedBy, verificationNotes, closedBy, whyAnalysis, ishikawaCategories } = req.body ?? {};
  if (!toStatus) { res.status(400).json({ error: "toStatus é obrigatório" }); return; }

  const [existing] = await db.select().from(qualityNcrsTable).where(eq(qualityNcrsTable.id, id));
  if (!existing) { res.status(404).json({ error: "NCR não encontrada" }); return; }

  const allowed = CAPA_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(toStatus)) {
    res.status(400).json({ error: `Transição inválida: ${existing.status} → ${toStatus}. O fluxo CAPA exige progressão sequencial: open → investigation → action_plan → execution → effectiveness_check → closed.` });
    return;
  }

  // ── Stage prerequisite enforcement ────────────────────────────────────────
  // investigation → action_plan: must have root cause analysis (5-porquês)
  if (toStatus === "action_plan") {
    const why = (whyAnalysis ?? existing.whyAnalysis ?? "").trim();
    if (!why) {
      res.status(400).json({ error: "Análise de causa raiz (5-Porquês) é obrigatória antes de avançar para Plano de Ação." });
      return;
    }
  }

  // action_plan → execution: must have at least 1 CAPA action defined
  if (toStatus === "execution") {
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(capaActionsTable)
      .where(eq(capaActionsTable.ncrId, id));
    if (Number(count) === 0) {
      res.status(400).json({ error: "Cadastre pelo menos uma ação CAPA antes de iniciar a Execução." });
      return;
    }
  }

  // execution → effectiveness_check: must have at least 1 completed action
  if (toStatus === "effectiveness_check") {
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(capaActionsTable)
      .where(and(eq(capaActionsTable.ncrId, id), eq(capaActionsTable.status, "done")));
    if (Number(count) === 0) {
      res.status(400).json({ error: "Pelo menos uma ação CAPA deve estar concluída (status 'done') antes de avançar para Verificação de Eficácia." });
      return;
    }
  }

  // effectiveness_check → closed: quality role gate (admin or manager) + required fields
  if (toStatus === "closed") {
    const role = req.session.role;
    if (role !== "admin" && role !== "manager") {
      res.status(403).json({ error: "Apenas usuários com perfil Gerente ou Administrador podem encerrar uma CAPA." });
      return;
    }
    const notes = verificationNotes ?? existing.verificationNotes ?? "";
    if (!notes.trim()) {
      res.status(400).json({ error: "Notas de verificação de eficácia são obrigatórias para encerrar a CAPA." });
      return;
    }
  }

  const now = new Date();
  const updates: Record<string, unknown> = { status: toStatus };

  if (toStatus === "investigation") {
    updates.investigatedBy = investigatedBy || req.session.userName || null;
    updates.investigatedAt = now;
    if (whyAnalysis) updates.whyAnalysis = whyAnalysis;
    if (ishikawaCategories) updates.ishikawaCategories = ishikawaCategories;
  }
  if (toStatus === "action_plan") {
    updates.actionPlanApprovedAt = now;
    if (whyAnalysis) updates.whyAnalysis = whyAnalysis;
    if (ishikawaCategories) updates.ishikawaCategories = ishikawaCategories;
  }
  if (toStatus === "effectiveness_check") {
    updates.verifiedBy = verifiedBy || req.session.userName || null;
    updates.verifiedAt = now;
    if (verificationNotes) updates.verificationNotes = verificationNotes;
  }
  if (toStatus === "closed") {
    updates.closedBy = closedBy || req.session.userName || null;
    updates.closedAt = now;
    updates.resolvedAt = now;
    updates.verifiedBy = verifiedBy || existing.verifiedBy || req.session.userName || null;
    updates.verifiedAt = existing.verifiedAt ?? now;
    if (verificationNotes) updates.verificationNotes = verificationNotes;
  }
  if (toStatus === "resolved") updates.resolvedAt = now;

  const [updated] = await db.update(qualityNcrsTable).set(updates).where(eq(qualityNcrsTable.id, id)).returning();
  res.json(updated);
});

// ─── CAPA: Actions CRUD ───────────────────────────────────────────────────────

router.get("/qualidade/ncrs/:id/actions", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  const today = new Date().toISOString().slice(0, 10);
  const actions = await db.select().from(capaActionsTable).where(eq(capaActionsTable.ncrId, id)).orderBy(capaActionsTable.id);
  const enriched = actions.map((a) => ({
    ...a,
    status: a.status !== "done" && a.dueDate && a.dueDate < today ? "overdue" : a.status,
  }));
  res.json(enriched);
});

router.post("/qualidade/ncrs/:id/actions", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const ncrId = parseId(req.params.id, res);
  if (ncrId === null) return;

  const [ncr] = await db.select({ id: qualityNcrsTable.id }).from(qualityNcrsTable).where(eq(qualityNcrsTable.id, ncrId));
  if (!ncr) { res.status(404).json({ error: "NCR não encontrada" }); return; }

  const { actionType, description, responsible, dueDate, evidence, status, notes } = req.body;
  if (!description?.trim()) { res.status(400).json({ error: "Descrição é obrigatória" }); return; }

  const [action] = await db.insert(capaActionsTable).values({
    ncrId,
    actionType: actionType || "corrective",
    description: description.trim(),
    responsible: responsible || null,
    dueDate: dueDate || null,
    evidence: evidence || null,
    status: status || "pending",
    notes: notes || null,
  }).returning();

  res.status(201).json(action);
});

router.put("/qualidade/capa/actions/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { actionType, description, responsible, dueDate, evidence, status, notes } = req.body;
  if (!description?.trim()) { res.status(400).json({ error: "Descrição é obrigatória" }); return; }

  const completedAt = status === "done" ? new Date() : null;

  const [action] = await db.update(capaActionsTable).set({
    actionType: actionType || "corrective",
    description: description.trim(),
    responsible: responsible || null,
    dueDate: dueDate || null,
    evidence: evidence || null,
    status: status || "pending",
    notes: notes || null,
    completedAt,
  }).where(eq(capaActionsTable.id, id)).returning();

  if (!action) { res.status(404).json({ error: "Ação não encontrada" }); return; }
  res.json(action);
});

router.delete("/qualidade/capa/actions/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [deleted] = await db.delete(capaActionsTable).where(eq(capaActionsTable.id, id)).returning({ id: capaActionsTable.id });
  if (!deleted) { res.status(404).json({ error: "Ação não encontrada" }); return; }
  res.json({ ok: true });
});

// ─── CAPA: Evidence File Upload ────────────────────────────────────────────────

router.post(
  "/qualidade/capa/actions/:id/evidence",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id, res);
    if (id === null) return;
    if (!req.file) { res.status(400).json({ error: "Arquivo não enviado" }); return; }

    const [action] = await db.select({ id: capaActionsTable.id }).from(capaActionsTable).where(eq(capaActionsTable.id, id));
    if (!action) { res.status(404).json({ error: "Ação não encontrada" }); return; }

    const fileData = req.file.buffer.toString("base64");
    const [evidence] = await db.insert(capaEvidencesTable).values({
      capaActionId: id,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      fileData,
      uploadedBy: req.session.userName || null,
    }).returning();

    res.status(201).json({
      id: evidence.id,
      capaActionId: evidence.capaActionId,
      fileName: evidence.fileName,
      mimeType: evidence.mimeType,
      fileSizeBytes: evidence.fileSizeBytes,
      uploadedBy: evidence.uploadedBy,
      uploadedAt: evidence.uploadedAt,
    });
  }
);

router.get("/qualidade/capa/actions/:id/evidence", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  const files = await db
    .select({
      id: capaEvidencesTable.id,
      capaActionId: capaEvidencesTable.capaActionId,
      fileName: capaEvidencesTable.fileName,
      mimeType: capaEvidencesTable.mimeType,
      fileSizeBytes: capaEvidencesTable.fileSizeBytes,
      uploadedBy: capaEvidencesTable.uploadedBy,
      uploadedAt: capaEvidencesTable.uploadedAt,
    })
    .from(capaEvidencesTable)
    .where(eq(capaEvidencesTable.capaActionId, id))
    .orderBy(capaEvidencesTable.uploadedAt);

  res.json(files);
});

router.get("/qualidade/capa/evidence/:id/download", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [ev] = await db.select().from(capaEvidencesTable).where(eq(capaEvidencesTable.id, id));
  if (!ev) { res.status(404).json({ error: "Evidência não encontrada" }); return; }

  const buf = Buffer.from(ev.fileData, "base64");
  res.setHeader("Content-Type", ev.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(ev.fileName)}"`);
  res.setHeader("Content-Length", buf.length);
  res.end(buf);
});

router.delete("/qualidade/capa/evidence/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [deleted] = await db.delete(capaEvidencesTable).where(eq(capaEvidencesTable.id, id)).returning({ id: capaEvidencesTable.id });
  if (!deleted) { res.status(404).json({ error: "Evidência não encontrada" }); return; }
  res.json({ ok: true });
});

// ─── CAPA: Dashboard ──────────────────────────────────────────────────────────

router.get("/qualidade/capa/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const today = new Date().toISOString().slice(0, 10);

  // NCR counts by status
  const statusCounts = await db
    .select({ status: qualityNcrsTable.status, count: sql<number>`COUNT(*)::int` })
    .from(qualityNcrsTable)
    .groupBy(qualityNcrsTable.status);

  // NCR counts by type
  const typeCounts = await db
    .select({ ncType: qualityNcrsTable.ncType, count: sql<number>`COUNT(*)::int` })
    .from(qualityNcrsTable)
    .groupBy(qualityNcrsTable.ncType);

  // Average closure time (days) for closed NCRs
  const [avgClosure] = await db
    .select({ avg: sql<string>`AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400)::text` })
    .from(qualityNcrsTable)
    .where(sql`${qualityNcrsTable.closedAt} IS NOT NULL`);

  // Overdue open actions
  const [overdueActions] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(capaActionsTable)
    .where(and(
      sql`${capaActionsTable.status} != 'done'`,
      sql`${capaActionsTable.dueDate} < ${today}`,
    ));

  // Total open actions
  const [openActions] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(capaActionsTable)
    .where(sql`${capaActionsTable.status} != 'done'`);

  // NCRs with overdue main due date
  const [overdueNcrs] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(qualityNcrsTable)
    .where(and(
      sql`${qualityNcrsTable.status} NOT IN ('closed','resolved')`,
      sql`${qualityNcrsTable.dueDate} IS NOT NULL`,
      sql`${qualityNcrsTable.dueDate} < ${today}`,
    ));

  // Recent open NCRs
  const recentOpenNcrs = await db
    .select()
    .from(qualityNcrsTable)
    .where(sql`${qualityNcrsTable.status} NOT IN ('closed','resolved')`)
    .orderBy(sql`CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`, desc(qualityNcrsTable.createdAt))
    .limit(10);

  // Actions approaching deadline (next 7 days, not done)
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const deadline = sevenDaysLater.toISOString().slice(0, 10);
  const upcomingActions = await db
    .select()
    .from(capaActionsTable)
    .where(and(
      sql`${capaActionsTable.status} != 'done'`,
      sql`${capaActionsTable.dueDate} IS NOT NULL`,
      sql`${capaActionsTable.dueDate} >= ${today}`,
      sql`${capaActionsTable.dueDate} <= ${deadline}`,
    ))
    .orderBy(capaActionsTable.dueDate)
    .limit(10);

  // NCR counts by origin
  const originCounts = await db
    .select({ origin: qualityNcrsTable.origin, count: sql<number>`COUNT(*)::int` })
    .from(qualityNcrsTable)
    .where(sql`${qualityNcrsTable.origin} IS NOT NULL AND ${qualityNcrsTable.origin} != ''`)
    .groupBy(qualityNcrsTable.origin);

  // Recurrence: products with more than 1 NCR (open or closed)
  const recurrenceRows = await db
    .select({ productId: qualityNcrsTable.productId, productName: qualityNcrsTable.productName, count: sql<number>`COUNT(*)::int` })
    .from(qualityNcrsTable)
    .where(sql`${qualityNcrsTable.productId} IS NOT NULL`)
    .groupBy(qualityNcrsTable.productId, qualityNcrsTable.productName)
    .having(sql`COUNT(*) > 1`)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(5);

  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, Number(r.count)]));
  const byType = Object.fromEntries(typeCounts.map((r) => [r.ncType ?? "other", Number(r.count)]));
  const byOrigin = Object.fromEntries(originCounts.map((r) => [r.origin ?? "other", Number(r.count)]));
  const totalOpen = statusCounts.filter((r) => !["closed", "resolved"].includes(r.status)).reduce((s, r) => s + Number(r.count), 0);
  const totalClosed = (byStatus["closed"] ?? 0) + (byStatus["resolved"] ?? 0);
  const totalNcrs = totalOpen + totalClosed;
  const avgDays = avgClosure?.avg ? parseFloat(avgClosure.avg) : null;
  const recurrenceCount = recurrenceRows.length;
  // Recurrence rate = % of total NCRs that belong to products with >1 NCR
  const recurrentNcrCount = recurrenceRows.reduce((s, r) => s + Number(r.count), 0);
  const recurrenceRate = totalNcrs > 0 ? parseFloat(((recurrentNcrCount / totalNcrs) * 100).toFixed(1)) : 0;

  res.json({
    totalOpen,
    totalClosed,
    byStatus,
    byType,
    byOrigin,
    recurrenceCount,
    recurrenceRate,
    recurrentProducts: recurrenceRows,
    overdueNcrsCount: Number(overdueNcrs?.count ?? 0),
    overdueActionsCount: Number(overdueActions?.count ?? 0),
    openActionsCount: Number(openActions?.count ?? 0),
    avgClosureDays: avgDays !== null ? parseFloat(avgDays.toFixed(1)) : null,
    recentOpenNcrs,
    upcomingActions,
  });
});

export default router;
