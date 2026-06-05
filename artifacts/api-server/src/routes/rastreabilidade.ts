import { Router, type IRouter } from "express";
import { and, eq, ilike, or, sql, inArray } from "drizzle-orm";
import {
  db,
  productLotsTable,
  lotMovementsTable,
  productionOrdersTable,
  productionMaterialConsumptionsTable,
  productionStagesTable,
  salesOrdersTable,
  clientsTable,
  qualityAnalysesTable,
  qualityNcrsTable,
  qualityCertificatesTable,
  fiscalDocumentsTable,
  purchaseOrdersTable,
  suppliersTable,
  productsTable,
} from "@workspace/db";
import type { Request, Response } from "express";
import PDFDocument from "pdfkit";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  return true;
}

// ─── Search lots for autocomplete ────────────────────────────────────────────

router.get("/rastreabilidade/search", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const q = String(req.query.q ?? "").trim();
  if (!q || q.length < 2) { res.json([]); return; }

  const lotResults = await db.select({
    internalLot: productLotsTable.internalLot,
    supplierLot: productLotsTable.supplierLot,
    productName: productsTable.name,
    cqStatus: productLotsTable.cqStatus,
  }).from(productLotsTable)
    .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
    .where(or(
      ilike(productLotsTable.internalLot, `%${q}%`),
      ilike(productLotsTable.supplierLot, `%${q}%`),
    ))
    .limit(10);

  const opResults = await db.select({
    batchLot: productionOrdersTable.batchLot,
    productName: productionOrdersTable.productName,
    number: productionOrdersTable.number,
  }).from(productionOrdersTable)
    .where(and(
      sql`${productionOrdersTable.batchLot} IS NOT NULL`,
      ilike(productionOrdersTable.batchLot, `%${q}%`),
    ))
    .limit(10);

  const suggestions = [
    ...lotResults.map(r => ({
      lot: r.internalLot,
      label: `${r.internalLot} — ${r.productName ?? "Produto desconhecido"}${r.supplierLot ? ` (Lote forn.: ${r.supplierLot})` : ""}`,
      type: "product_lot",
      cqStatus: r.cqStatus,
    })),
    ...opResults
      .filter(r => r.batchLot && !lotResults.some(l => l.internalLot === r.batchLot))
      .map(r => ({
        lot: r.batchLot!,
        label: `${r.batchLot} — PA de ${r.productName} (OP: ${r.number})`,
        type: "pa_lot",
        cqStatus: null,
      })),
  ];

  res.json(suggestions);
});

// ─── Full traceability trace ──────────────────────────────────────────────────

router.get("/rastreabilidade/trace", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const lotNumber = String(req.query.lot ?? "").trim();
  if (!lotNumber) { res.status(400).json({ error: "Parâmetro 'lot' é obrigatório" }); return; }

  const result: any = {
    lotNumber,
    detectedAs: "unknown",
    mpLotInfo: null,
    paOrderInfo: null,
    forward: null,
    backward: null,
  };

  // ── 1. Try to find as product lot (MP or internal lot) ────────────────────
  const [mpLot] = await db.select({
    id: productLotsTable.id,
    internalLot: productLotsTable.internalLot,
    supplierLot: productLotsTable.supplierLot,
    productId: productLotsTable.productId,
    productName: productsTable.name,
    cqStatus: productLotsTable.cqStatus,
    totalQty: productLotsTable.totalQty,
    availableQty: productLotsTable.availableQty,
    manufacturingDate: productLotsTable.manufacturingDate,
    expirationDate: productLotsTable.expirationDate,
    notes: productLotsTable.notes,
    createdAt: productLotsTable.createdAt,
  }).from(productLotsTable)
    .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
    .where(eq(productLotsTable.internalLot, lotNumber));

  // ── 2. Try to find as PA lot (batchLot in production_orders) ─────────────
  const paOrders = await db.select({
    id: productionOrdersTable.id,
    number: productionOrdersTable.number,
    batchLot: productionOrdersTable.batchLot,
    productId: productionOrdersTable.productId,
    productName: productionOrdersTable.productName,
    plannedQty: productionOrdersTable.plannedQty,
    actualQty: productionOrdersTable.actualQty,
    unit: productionOrdersTable.unit,
    status: productionOrdersTable.status,
    salesOrderId: productionOrdersTable.salesOrderId,
    scheduledStart: productionOrdersTable.scheduledStart,
    scheduledEnd: productionOrdersTable.scheduledEnd,
    actualStart: productionOrdersTable.actualStart,
    actualEnd: productionOrdersTable.actualEnd,
    releasedBy: productionOrdersTable.releasedBy,
    notes: productionOrdersTable.notes,
    createdAt: productionOrdersTable.createdAt,
  }).from(productionOrdersTable)
    .where(eq(productionOrdersTable.batchLot, lotNumber));

  if (!mpLot && paOrders.length === 0) {
    res.status(404).json({ error: `Nenhum lote encontrado para: ${lotNumber}` });
    return;
  }

  const isMpLot = !!mpLot;
  const isPaLot = paOrders.length > 0;
  result.detectedAs = isMpLot && isPaLot ? "both" : isMpLot ? "mp" : "pa";
  result.mpLotInfo = mpLot ?? null;

  // ── FORWARD trace (MP lot → OPs → PA lots → Sales → Clients) ────────────
  if (isMpLot) {
    const consumptions = await db.select({
      id: productionMaterialConsumptionsTable.id,
      orderId: productionMaterialConsumptionsTable.orderId,
      productName: productionMaterialConsumptionsTable.productName,
      internalLot: productionMaterialConsumptionsTable.internalLot,
      actualQty: productionMaterialConsumptionsTable.actualQty,
      unit: productionMaterialConsumptionsTable.unit,
      recordedBy: productionMaterialConsumptionsTable.recordedBy,
      recordedAt: productionMaterialConsumptionsTable.recordedAt,
    }).from(productionMaterialConsumptionsTable)
      .where(or(
        eq(productionMaterialConsumptionsTable.lotId, mpLot.id),
        eq(productionMaterialConsumptionsTable.internalLot, lotNumber),
      ));

    const opIds = [...new Set(consumptions.map(c => c.orderId))];
    let ops: any[] = [];
    let paLots: any[] = [];
    let salesOrders: any[] = [];
    let clients: any[] = [];
    let fiscalDocs: any[] = [];

    if (opIds.length > 0) {
      ops = await db.select().from(productionOrdersTable).where(inArray(productionOrdersTable.id, opIds));

      const batchLots = ops.filter(o => o.batchLot).map(o => o.batchLot!);
      if (batchLots.length > 0) {
        paLots = await db.select({
          id: productLotsTable.id,
          internalLot: productLotsTable.internalLot,
          cqStatus: productLotsTable.cqStatus,
          totalQty: productLotsTable.totalQty,
          expirationDate: productLotsTable.expirationDate,
          productName: productsTable.name,
        }).from(productLotsTable)
          .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
          .where(inArray(productLotsTable.internalLot, batchLots));
      }

      const soIds = ops.filter(o => o.salesOrderId).map(o => o.salesOrderId!);
      if (soIds.length > 0) {
        salesOrders = await db.select({
          id: salesOrdersTable.id,
          clientId: salesOrdersTable.clientId,
          status: salesOrdersTable.status,
          totalAmount: salesOrdersTable.totalAmount,
          deliveryDate: salesOrdersTable.deliveryDate,
          createdAt: salesOrdersTable.createdAt,
          clientName: clientsTable.name,
          clientDocument: clientsTable.document,
          clientCity: clientsTable.city,
          clientState: clientsTable.state,
        }).from(salesOrdersTable)
          .leftJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
          .where(inArray(salesOrdersTable.id, soIds));

        const clientIds = [...new Set(salesOrders.filter(s => s.clientId).map(s => s.clientId!))];
        if (clientIds.length > 0) {
          clients = await db.select().from(clientsTable).where(inArray(clientsTable.id, clientIds));
        }

        fiscalDocs = await db.select().from(fiscalDocumentsTable)
          .where(and(
            sql`${fiscalDocumentsTable.referenceOrderId} = ANY(ARRAY[${sql.join(soIds.map(id => sql`${id.toString()}`), sql`, `)}])`,
          ))
          .limit(20);
      }
    }

    // CQ analyses for this MP lot
    const cqAnalyses = await db.select({
      id: qualityAnalysesTable.id,
      sampleCode: qualityAnalysesTable.sampleCode,
      analysisType: qualityAnalysesTable.analysisType,
      status: qualityAnalysesTable.status,
      analystName: qualityAnalysesTable.analystName,
      completedAt: qualityAnalysesTable.completedAt,
    }).from(qualityAnalysesTable)
      .where(or(
        eq(qualityAnalysesTable.lotId, mpLot.id),
        eq(qualityAnalysesTable.internalLot, lotNumber),
      ));

    const cqCerts = await db.select().from(qualityCertificatesTable)
      .where(eq(qualityCertificatesTable.internalLot, lotNumber));

    result.forward = {
      consumptions,
      productionOrders: ops,
      paLots,
      salesOrders,
      clients,
      fiscalDocs,
      cqAnalyses,
      cqCertificates: cqCerts,
    };
  }

  // ── BACKWARD trace (PA lot → OP → MPs → Suppliers → CQ) ─────────────────
  if (isPaLot || (isMpLot && paOrders.length > 0)) {
    const ordersToTrace = isPaLot ? paOrders : paOrders;
    result.paOrderInfo = ordersToTrace;

    const allConsumptions: any[] = [];
    const allStages: any[] = [];
    const allMpLotIds: number[] = [];
    const allMpLotNumbers: string[] = [];

    for (const op of ordersToTrace) {
      const stages = await db.select()
        .from(productionStagesTable)
        .where(eq(productionStagesTable.orderId, op.id))
        .orderBy(productionStagesTable.sequence);
      allStages.push(...stages);

      const consumptions = await db.select({
        id: productionMaterialConsumptionsTable.id,
        orderId: productionMaterialConsumptionsTable.orderId,
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
      }).from(productionMaterialConsumptionsTable)
        .leftJoin(productLotsTable, eq(productionMaterialConsumptionsTable.lotId, productLotsTable.id))
        .where(eq(productionMaterialConsumptionsTable.orderId, op.id));
      allConsumptions.push(...consumptions);

      for (const c of consumptions) {
        if (c.lotId && !allMpLotIds.includes(c.lotId)) allMpLotIds.push(c.lotId);
        if (c.internalLot && !allMpLotNumbers.includes(c.internalLot)) allMpLotNumbers.push(c.internalLot);
      }
    }

    let mpLots: any[] = [];
    let cqAnalyses: any[] = [];
    let cqCerts: any[] = [];
    let suppliers: any[] = [];
    let ncrs: any[] = [];

    if (allMpLotIds.length > 0) {
      mpLots = await db.select({
        id: productLotsTable.id,
        internalLot: productLotsTable.internalLot,
        supplierLot: productLotsTable.supplierLot,
        cqStatus: productLotsTable.cqStatus,
        totalQty: productLotsTable.totalQty,
        expirationDate: productLotsTable.expirationDate,
        productName: productsTable.name,
      }).from(productLotsTable)
        .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
        .where(inArray(productLotsTable.id, allMpLotIds));

      cqAnalyses = await db.select({
        id: qualityAnalysesTable.id,
        internalLot: qualityAnalysesTable.internalLot,
        sampleCode: qualityAnalysesTable.sampleCode,
        analysisType: qualityAnalysesTable.analysisType,
        status: qualityAnalysesTable.status,
        analystName: qualityAnalysesTable.analystName,
        completedAt: qualityAnalysesTable.completedAt,
        productName: qualityAnalysesTable.productName,
      }).from(qualityAnalysesTable)
        .where(inArray(qualityAnalysesTable.lotId, allMpLotIds));

      if (allMpLotNumbers.length > 0) {
        const moreCerts = await db.select().from(qualityCertificatesTable)
          .where(inArray(qualityCertificatesTable.internalLot, allMpLotNumbers));
        cqCerts.push(...moreCerts);
      }
    }

    // Suppliers: find via lot_movements where referenceType = 'purchase_order'
    if (allMpLotIds.length > 0) {
      const movements = await db.select({
        lotId: lotMovementsTable.lotId,
        referenceId: lotMovementsTable.referenceId,
        referenceType: lotMovementsTable.referenceType,
      }).from(lotMovementsTable)
        .where(and(
          inArray(lotMovementsTable.lotId, allMpLotIds),
          eq(lotMovementsTable.referenceType, "purchase_order"),
          sql`${lotMovementsTable.referenceId} IS NOT NULL`,
        ));

      const poIds = [...new Set(movements.filter(m => m.referenceId).map(m => m.referenceId!))];
      if (poIds.length > 0) {
        const pos = await db.select({
          id: purchaseOrdersTable.id,
          supplierId: purchaseOrdersTable.supplierId,
          nfNumber: purchaseOrdersTable.nfNumber,
          receivedAt: purchaseOrdersTable.receivedAt,
          totalAmount: purchaseOrdersTable.totalAmount,
          supplierName: suppliersTable.name,
          supplierDocument: suppliersTable.document,
          supplierCity: suppliersTable.city,
          supplierState: suppliersTable.state,
          supplierApprovalStatus: suppliersTable.approvalStatus,
        }).from(purchaseOrdersTable)
          .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
          .where(inArray(purchaseOrdersTable.id, poIds));
        suppliers.push(...pos);
      }
    }

    // NCRs related to PA lot's product
    const paProductIds = [...new Set(ordersToTrace.filter(o => o.productId).map(o => o.productId!))];
    if (paProductIds.length > 0) {
      ncrs = await db.select({
        id: qualityNcrsTable.id,
        productName: qualityNcrsTable.productName,
        title: qualityNcrsTable.title,
        severity: qualityNcrsTable.severity,
        status: qualityNcrsTable.status,
        ncType: qualityNcrsTable.ncType,
        reportedBy: qualityNcrsTable.reportedBy,
        createdAt: qualityNcrsTable.createdAt,
      }).from(qualityNcrsTable)
        .where(inArray(qualityNcrsTable.productId, paProductIds))
        .limit(10);
    }

    // Sales orders & clients for these OPs
    const soIds = ordersToTrace.filter(o => o.salesOrderId).map(o => o.salesOrderId!);
    let salesOrders: any[] = [];
    if (soIds.length > 0) {
      salesOrders = await db.select({
        id: salesOrdersTable.id,
        status: salesOrdersTable.status,
        totalAmount: salesOrdersTable.totalAmount,
        deliveryDate: salesOrdersTable.deliveryDate,
        clientName: clientsTable.name,
        clientDocument: clientsTable.document,
        clientCity: clientsTable.city,
      }).from(salesOrdersTable)
        .leftJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
        .where(inArray(salesOrdersTable.id, soIds));
    }

    result.backward = {
      productionOrders: ordersToTrace,
      stages: allStages,
      consumedMpLots: allConsumptions,
      mpLots,
      qualityAnalyses: cqAnalyses,
      qualityCertificates: cqCerts,
      suppliers,
      ncrs,
      salesOrders,
    };
  }

  res.json(result);
});

// ─── Forward-only endpoint ────────────────────────────────────────────────────

router.get("/rastreabilidade/forward", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const lotNumber = String(req.query.lot ?? "").trim();
  if (!lotNumber) { res.status(400).json({ error: "Parâmetro 'lot' é obrigatório" }); return; }

  const [mpLot] = await db.select({
    id: productLotsTable.id,
    internalLot: productLotsTable.internalLot,
    supplierLot: productLotsTable.supplierLot,
    productId: productLotsTable.productId,
    productName: productsTable.name,
    cqStatus: productLotsTable.cqStatus,
    totalQty: productLotsTable.totalQty,
    availableQty: productLotsTable.availableQty,
    manufacturingDate: productLotsTable.manufacturingDate,
    expirationDate: productLotsTable.expirationDate,
    notes: productLotsTable.notes,
    createdAt: productLotsTable.createdAt,
  }).from(productLotsTable)
    .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
    .where(eq(productLotsTable.internalLot, lotNumber));

  if (!mpLot) {
    res.status(404).json({ error: `Lote de MP não encontrado: ${lotNumber}` });
    return;
  }

  const consumptions = await db.select({
    id: productionMaterialConsumptionsTable.id,
    orderId: productionMaterialConsumptionsTable.orderId,
    productName: productionMaterialConsumptionsTable.productName,
    internalLot: productionMaterialConsumptionsTable.internalLot,
    actualQty: productionMaterialConsumptionsTable.actualQty,
    unit: productionMaterialConsumptionsTable.unit,
    recordedBy: productionMaterialConsumptionsTable.recordedBy,
    recordedAt: productionMaterialConsumptionsTable.recordedAt,
  }).from(productionMaterialConsumptionsTable)
    .where(or(
      eq(productionMaterialConsumptionsTable.lotId, mpLot.id),
      eq(productionMaterialConsumptionsTable.internalLot, lotNumber),
    ));

  const opIds = [...new Set(consumptions.map(c => c.orderId))];
  let ops: any[] = [];
  let paLots: any[] = [];
  let salesOrders: any[] = [];
  let clients: any[] = [];
  let fiscalDocs: any[] = [];

  if (opIds.length > 0) {
    ops = await db.select().from(productionOrdersTable).where(inArray(productionOrdersTable.id, opIds));
    const batchLots = ops.filter(o => o.batchLot).map(o => o.batchLot!);
    if (batchLots.length > 0) {
      paLots = await db.select({
        id: productLotsTable.id,
        internalLot: productLotsTable.internalLot,
        cqStatus: productLotsTable.cqStatus,
        totalQty: productLotsTable.totalQty,
        expirationDate: productLotsTable.expirationDate,
        productName: productsTable.name,
      }).from(productLotsTable)
        .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
        .where(inArray(productLotsTable.internalLot, batchLots));
    }
    const soIds = ops.filter(o => o.salesOrderId).map(o => o.salesOrderId!);
    if (soIds.length > 0) {
      salesOrders = await db.select({
        id: salesOrdersTable.id,
        clientId: salesOrdersTable.clientId,
        status: salesOrdersTable.status,
        totalAmount: salesOrdersTable.totalAmount,
        deliveryDate: salesOrdersTable.deliveryDate,
        createdAt: salesOrdersTable.createdAt,
        clientName: clientsTable.name,
        clientDocument: clientsTable.document,
        clientCity: clientsTable.city,
        clientState: clientsTable.state,
      }).from(salesOrdersTable)
        .leftJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
        .where(inArray(salesOrdersTable.id, soIds));

      const clientIds = [...new Set(salesOrders.filter(s => s.clientId).map(s => s.clientId!))];
      if (clientIds.length > 0) {
        clients = await db.select().from(clientsTable).where(inArray(clientsTable.id, clientIds));
      }
      fiscalDocs = await db.select().from(fiscalDocumentsTable)
        .where(sql`${fiscalDocumentsTable.referenceOrderId} = ANY(ARRAY[${sql.join(soIds.map(id => sql`${id.toString()}`), sql`, `)}])`)
        .limit(20);
    }
  }

  const cqAnalyses = await db.select({
    id: qualityAnalysesTable.id,
    sampleCode: qualityAnalysesTable.sampleCode,
    analysisType: qualityAnalysesTable.analysisType,
    status: qualityAnalysesTable.status,
    analystName: qualityAnalysesTable.analystName,
    completedAt: qualityAnalysesTable.completedAt,
  }).from(qualityAnalysesTable)
    .where(or(
      eq(qualityAnalysesTable.lotId, mpLot.id),
      eq(qualityAnalysesTable.internalLot, lotNumber),
    ));

  const cqCerts = await db.select().from(qualityCertificatesTable)
    .where(eq(qualityCertificatesTable.internalLot, lotNumber));

  res.json({
    lotNumber,
    mpLotInfo: mpLot,
    consumptions,
    productionOrders: ops,
    paLots,
    salesOrders,
    clients,
    fiscalDocs,
    cqAnalyses,
    cqCertificates: cqCerts,
  });
});

// ─── Backward-only endpoint ───────────────────────────────────────────────────

router.get("/rastreabilidade/backward", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const lotNumber = String(req.query.lot ?? "").trim();
  if (!lotNumber) { res.status(400).json({ error: "Parâmetro 'lot' é obrigatório" }); return; }

  const paOrders = await db.select({
    id: productionOrdersTable.id,
    number: productionOrdersTable.number,
    batchLot: productionOrdersTable.batchLot,
    productId: productionOrdersTable.productId,
    productName: productionOrdersTable.productName,
    plannedQty: productionOrdersTable.plannedQty,
    actualQty: productionOrdersTable.actualQty,
    unit: productionOrdersTable.unit,
    status: productionOrdersTable.status,
    salesOrderId: productionOrdersTable.salesOrderId,
    scheduledStart: productionOrdersTable.scheduledStart,
    scheduledEnd: productionOrdersTable.scheduledEnd,
    actualStart: productionOrdersTable.actualStart,
    actualEnd: productionOrdersTable.actualEnd,
    releasedBy: productionOrdersTable.releasedBy,
    notes: productionOrdersTable.notes,
    createdAt: productionOrdersTable.createdAt,
  }).from(productionOrdersTable)
    .where(eq(productionOrdersTable.batchLot, lotNumber));

  if (paOrders.length === 0) {
    res.status(404).json({ error: `Nenhuma OP encontrada com lote PA: ${lotNumber}` });
    return;
  }

  const allConsumptions: any[] = [];
  const allStages: any[] = [];
  const allMpLotIds: number[] = [];
  const allMpLotNumbers: string[] = [];

  for (const op of paOrders) {
    const stages = await db.select()
      .from(productionStagesTable)
      .where(eq(productionStagesTable.orderId, op.id))
      .orderBy(productionStagesTable.sequence);
    allStages.push(...stages);

    const consumptions = await db.select({
      id: productionMaterialConsumptionsTable.id,
      orderId: productionMaterialConsumptionsTable.orderId,
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
    }).from(productionMaterialConsumptionsTable)
      .leftJoin(productLotsTable, eq(productionMaterialConsumptionsTable.lotId, productLotsTable.id))
      .where(eq(productionMaterialConsumptionsTable.orderId, op.id));
    allConsumptions.push(...consumptions);

    for (const c of consumptions) {
      if (c.lotId && !allMpLotIds.includes(c.lotId)) allMpLotIds.push(c.lotId);
      if (c.internalLot && !allMpLotNumbers.includes(c.internalLot)) allMpLotNumbers.push(c.internalLot);
    }
  }

  let mpLots: any[] = [];
  let cqAnalyses: any[] = [];
  let cqCerts: any[] = [];
  let suppliers: any[] = [];
  let ncrs: any[] = [];

  if (allMpLotIds.length > 0) {
    mpLots = await db.select({
      id: productLotsTable.id,
      internalLot: productLotsTable.internalLot,
      supplierLot: productLotsTable.supplierLot,
      cqStatus: productLotsTable.cqStatus,
      totalQty: productLotsTable.totalQty,
      expirationDate: productLotsTable.expirationDate,
      productName: productsTable.name,
    }).from(productLotsTable)
      .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
      .where(inArray(productLotsTable.id, allMpLotIds));

    cqAnalyses = await db.select({
      id: qualityAnalysesTable.id,
      internalLot: qualityAnalysesTable.internalLot,
      sampleCode: qualityAnalysesTable.sampleCode,
      analysisType: qualityAnalysesTable.analysisType,
      status: qualityAnalysesTable.status,
      analystName: qualityAnalysesTable.analystName,
      completedAt: qualityAnalysesTable.completedAt,
      productName: qualityAnalysesTable.productName,
    }).from(qualityAnalysesTable)
      .where(inArray(qualityAnalysesTable.lotId, allMpLotIds));

    if (allMpLotNumbers.length > 0) {
      cqCerts = await db.select().from(qualityCertificatesTable)
        .where(inArray(qualityCertificatesTable.internalLot, allMpLotNumbers));
    }

    const movements = await db.select({
      lotId: lotMovementsTable.lotId,
      referenceId: lotMovementsTable.referenceId,
      referenceType: lotMovementsTable.referenceType,
    }).from(lotMovementsTable)
      .where(and(
        inArray(lotMovementsTable.lotId, allMpLotIds),
        eq(lotMovementsTable.referenceType, "purchase_order"),
        sql`${lotMovementsTable.referenceId} IS NOT NULL`,
      ));

    const poIds = [...new Set(movements.filter(m => m.referenceId).map(m => m.referenceId!))];
    if (poIds.length > 0) {
      const pos = await db.select({
        id: purchaseOrdersTable.id,
        supplierId: purchaseOrdersTable.supplierId,
        nfNumber: purchaseOrdersTable.nfNumber,
        receivedAt: purchaseOrdersTable.receivedAt,
        totalAmount: purchaseOrdersTable.totalAmount,
        supplierName: suppliersTable.name,
        supplierDocument: suppliersTable.document,
        supplierCity: suppliersTable.city,
        supplierState: suppliersTable.state,
        supplierApprovalStatus: suppliersTable.approvalStatus,
      }).from(purchaseOrdersTable)
        .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
        .where(inArray(purchaseOrdersTable.id, poIds));
      suppliers.push(...pos);
    }
  }

  const paProductIds = [...new Set(paOrders.filter(o => o.productId).map(o => o.productId!))];
  if (paProductIds.length > 0) {
    ncrs = await db.select({
      id: qualityNcrsTable.id,
      productName: qualityNcrsTable.productName,
      title: qualityNcrsTable.title,
      severity: qualityNcrsTable.severity,
      status: qualityNcrsTable.status,
      ncType: qualityNcrsTable.ncType,
      reportedBy: qualityNcrsTable.reportedBy,
      createdAt: qualityNcrsTable.createdAt,
    }).from(qualityNcrsTable)
      .where(inArray(qualityNcrsTable.productId, paProductIds))
      .limit(10);
  }

  const soIds = paOrders.filter(o => o.salesOrderId).map(o => o.salesOrderId!);
  let salesOrders: any[] = [];
  if (soIds.length > 0) {
    salesOrders = await db.select({
      id: salesOrdersTable.id,
      status: salesOrdersTable.status,
      totalAmount: salesOrdersTable.totalAmount,
      deliveryDate: salesOrdersTable.deliveryDate,
      clientName: clientsTable.name,
      clientDocument: clientsTable.document,
      clientCity: clientsTable.city,
    }).from(salesOrdersTable)
      .leftJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
      .where(inArray(salesOrdersTable.id, soIds));
  }

  res.json({
    lotNumber,
    productionOrders: paOrders,
    stages: allStages,
    consumedMpLots: allConsumptions,
    mpLots,
    qualityAnalyses: cqAnalyses,
    qualityCertificates: cqCerts,
    suppliers,
    ncrs,
    salesOrders,
  });
});

// ─── Alerts: critical lots (rejected | quarantine) with impact ────────────────

router.get("/rastreabilidade/alerts", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  // 1. All lots with critical CQ status
  const criticalLots = await db.select({
    id: productLotsTable.id,
    internalLot: productLotsTable.internalLot,
    supplierLot: productLotsTable.supplierLot,
    cqStatus: productLotsTable.cqStatus,
    totalQty: productLotsTable.totalQty,
    availableQty: productLotsTable.availableQty,
    manufacturingDate: productLotsTable.manufacturingDate,
    expirationDate: productLotsTable.expirationDate,
    createdAt: productLotsTable.createdAt,
    productName: productsTable.name,
    productId: productLotsTable.productId,
  }).from(productLotsTable)
    .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
    .where(or(
      eq(productLotsTable.cqStatus, "rejected"),
      eq(productLotsTable.cqStatus, "quarantine"),
    ))
    .orderBy(productLotsTable.createdAt);

  if (criticalLots.length === 0) {
    res.json({ alerts: [], totalLots: 0, totalOpsAffected: 0, totalClientsExposed: 0 });
    return;
  }

  const lotIds = criticalLots.map(l => l.id);
  const lotNumbers = criticalLots.map(l => l.internalLot).filter(Boolean) as string[];

  // 2. All consumptions referencing these lots
  const allConsumptions = await db.select({
    id: productionMaterialConsumptionsTable.id,
    orderId: productionMaterialConsumptionsTable.orderId,
    lotId: productionMaterialConsumptionsTable.lotId,
    internalLot: productionMaterialConsumptionsTable.internalLot,
  }).from(productionMaterialConsumptionsTable)
    .where(or(
      inArray(productionMaterialConsumptionsTable.lotId, lotIds),
      lotNumbers.length > 0 ? inArray(productionMaterialConsumptionsTable.internalLot, lotNumbers) : sql`false`,
    ));

  // 3. Production orders involved
  const opIds = [...new Set(allConsumptions.map(c => c.orderId))];
  let opsMap: Map<number, { id: number; number: string; salesOrderId: number | null; batchLot: string | null }> = new Map();

  if (opIds.length > 0) {
    const ops = await db.select({
      id: productionOrdersTable.id,
      number: productionOrdersTable.number,
      salesOrderId: productionOrdersTable.salesOrderId,
      batchLot: productionOrdersTable.batchLot,
    }).from(productionOrdersTable).where(inArray(productionOrdersTable.id, opIds));
    for (const op of ops) opsMap.set(op.id, op);
  }

  // 4. Sales orders and clients for exposed OPs
  const soIds = [...new Set([...opsMap.values()].filter(o => o.salesOrderId).map(o => o.salesOrderId!))];
  let soClientMap: Map<number, { clientId: number | null; clientName: string | null; clientDocument: string | null; clientCity: string | null; status: string | null }> = new Map();

  if (soIds.length > 0) {
    const salesOrders = await db.select({
      id: salesOrdersTable.id,
      clientId: salesOrdersTable.clientId,
      status: salesOrdersTable.status,
      clientName: clientsTable.name,
      clientDocument: clientsTable.document,
      clientCity: clientsTable.city,
    }).from(salesOrdersTable)
      .leftJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
      .where(inArray(salesOrdersTable.id, soIds));
    for (const so of salesOrders) soClientMap.set(so.id, so);
  }

  // 5. Aggregate per critical lot
  const alerts = criticalLots.map(lot => {
    // Consumptions for this specific lot
    const lotConsumptions = allConsumptions.filter(c =>
      c.lotId === lot.id || c.internalLot === lot.internalLot
    );
    const affectedOpIds = [...new Set(lotConsumptions.map(c => c.orderId))];
    const affectedOps = affectedOpIds.map(id => opsMap.get(id)).filter((x): x is NonNullable<typeof x> => x !== undefined);

    // Clients exposed via sales orders
    const exposedSoIds = [...new Set(affectedOps.filter(o => o.salesOrderId).map(o => o.salesOrderId!))];
    const exposedClients = exposedSoIds.map(soId => {
      const so = soClientMap.get(soId);
      return so ? { soId, clientId: so.clientId, clientName: so.clientName, clientDocument: so.clientDocument, clientCity: so.clientCity, status: so.status } : null;
    }).filter(Boolean);

    const uniqueClientIds = [...new Set(exposedClients.map(c => c!.clientId).filter(Boolean))];

    return {
      lotId: lot.id,
      internalLot: lot.internalLot,
      supplierLot: lot.supplierLot,
      cqStatus: lot.cqStatus,
      productName: lot.productName,
      productId: lot.productId,
      totalQty: lot.totalQty,
      availableQty: lot.availableQty,
      manufacturingDate: lot.manufacturingDate,
      expirationDate: lot.expirationDate,
      createdAt: lot.createdAt,
      opsAffectedCount: affectedOpIds.length,
      clientsExposedCount: uniqueClientIds.length,
      affectedOps: affectedOps.map(op => ({ id: op.id, number: op.number, salesOrderId: op.salesOrderId, batchLot: op.batchLot })),
      exposedClients: exposedClients.map(c => ({
        soId: c!.soId,
        clientId: c!.clientId,
        clientName: c!.clientName,
        clientDocument: c!.clientDocument,
        clientCity: c!.clientCity,
        soStatus: c!.status,
      })),
    };
  });

  const totalOpsAffected = new Set(alerts.flatMap(a => a.affectedOps.map(o => o.id))).size;
  const totalClientsExposed = new Set(alerts.flatMap(a => a.exposedClients.map(c => c.clientId).filter(Boolean))).size;

  res.json({
    alerts,
    totalLots: alerts.length,
    totalOpsAffected,
    totalClientsExposed,
  });
});

// ─── Alerts PDF: official recall impact report ────────────────────────────────

router.get("/rastreabilidade/alerts/pdf", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  // ── Fetch same data as /alerts ──────────────────────────────────────────────
  const criticalLots = await db.select({
    id: productLotsTable.id,
    internalLot: productLotsTable.internalLot,
    supplierLot: productLotsTable.supplierLot,
    cqStatus: productLotsTable.cqStatus,
    totalQty: productLotsTable.totalQty,
    availableQty: productLotsTable.availableQty,
    manufacturingDate: productLotsTable.manufacturingDate,
    expirationDate: productLotsTable.expirationDate,
    createdAt: productLotsTable.createdAt,
    productName: productsTable.name,
    productId: productLotsTable.productId,
  }).from(productLotsTable)
    .leftJoin(productsTable, eq(productLotsTable.productId, productsTable.id))
    .where(or(
      eq(productLotsTable.cqStatus, "rejected"),
      eq(productLotsTable.cqStatus, "quarantine"),
    ))
    .orderBy(productLotsTable.createdAt);

  let alerts: any[] = [];
  let totalOpsAffected = 0;
  let totalClientsExposed = 0;

  if (criticalLots.length > 0) {
    const lotIds = criticalLots.map(l => l.id);
    const lotNumbers = criticalLots.map(l => l.internalLot).filter(Boolean) as string[];

    const allConsumptions = await db.select({
      id: productionMaterialConsumptionsTable.id,
      orderId: productionMaterialConsumptionsTable.orderId,
      lotId: productionMaterialConsumptionsTable.lotId,
      internalLot: productionMaterialConsumptionsTable.internalLot,
    }).from(productionMaterialConsumptionsTable)
      .where(or(
        inArray(productionMaterialConsumptionsTable.lotId, lotIds),
        lotNumbers.length > 0 ? inArray(productionMaterialConsumptionsTable.internalLot, lotNumbers) : sql`false`,
      ));

    const opIds = [...new Set(allConsumptions.map(c => c.orderId))];
    let opsMap: Map<number, { id: number; number: string; salesOrderId: number | null; batchLot: string | null }> = new Map();

    if (opIds.length > 0) {
      const ops = await db.select({
        id: productionOrdersTable.id,
        number: productionOrdersTable.number,
        salesOrderId: productionOrdersTable.salesOrderId,
        batchLot: productionOrdersTable.batchLot,
      }).from(productionOrdersTable).where(inArray(productionOrdersTable.id, opIds));
      for (const op of ops) opsMap.set(op.id, op);
    }

    const soIds = [...new Set([...opsMap.values()].filter(o => o.salesOrderId).map(o => o.salesOrderId!))];
    let soClientMap: Map<number, { clientId: number | null; clientName: string | null; clientDocument: string | null; clientCity: string | null; status: string | null }> = new Map();

    if (soIds.length > 0) {
      const salesOrders = await db.select({
        id: salesOrdersTable.id,
        clientId: salesOrdersTable.clientId,
        status: salesOrdersTable.status,
        clientName: clientsTable.name,
        clientDocument: clientsTable.document,
        clientCity: clientsTable.city,
      }).from(salesOrdersTable)
        .leftJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
        .where(inArray(salesOrdersTable.id, soIds));
      for (const so of salesOrders) soClientMap.set(so.id, so);
    }

    const globalOpIds = new Set<number>();
    const globalClientIds = new Set<number>();

    alerts = criticalLots.map(lot => {
      const lotConsumptions = allConsumptions.filter(c =>
        c.lotId === lot.id || c.internalLot === lot.internalLot
      );
      const affectedOpIds = [...new Set(lotConsumptions.map(c => c.orderId))];
      const affectedOps = affectedOpIds.map(id => opsMap.get(id)).filter((x): x is NonNullable<typeof x> => x !== undefined);
      affectedOps.forEach(op => globalOpIds.add(op.id));

      const exposedSoIds = [...new Set(affectedOps.filter(o => o.salesOrderId).map(o => o.salesOrderId!))];
      const exposedClients = exposedSoIds.map(soId => {
        const so = soClientMap.get(soId);
        return so ? { soId, clientId: so.clientId, clientName: so.clientName, clientDocument: so.clientDocument, clientCity: so.clientCity, soStatus: so.status } : null;
      }).filter((x): x is NonNullable<typeof x> => x !== null);

      const uniqueClientIds = [...new Set(exposedClients.map(c => c.clientId).filter((id): id is number => id !== null))];
      uniqueClientIds.forEach(id => globalClientIds.add(id));

      return {
        lotId: lot.id,
        internalLot: lot.internalLot,
        supplierLot: lot.supplierLot,
        cqStatus: lot.cqStatus,
        productName: lot.productName,
        totalQty: lot.totalQty,
        availableQty: lot.availableQty,
        manufacturingDate: lot.manufacturingDate,
        expirationDate: lot.expirationDate,
        opsAffectedCount: affectedOpIds.length,
        clientsExposedCount: uniqueClientIds.length,
        affectedOps: affectedOps.map(op => ({ id: op.id, number: op.number, batchLot: op.batchLot })),
        exposedClients: exposedClients.map(c => ({
          soId: c.soId,
          clientId: c.clientId,
          clientName: c.clientName,
          clientDocument: c.clientDocument,
          clientCity: c.clientCity,
          soStatus: c.soStatus,
        })),
      };
    });

    totalOpsAffected = globalOpIds.size;
    totalClientsExposed = globalClientIds.size;
  }

  // ── Build PDF ───────────────────────────────────────────────────────────────
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmtDate = (d: Date | string | null | undefined) => {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
    } catch { return "—"; }
  };
  const docNum = `RECALL-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const generatedAt = `${fmtDate(now)} às ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  // Layout constants
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 45;
  const CW = PAGE_W - MARGIN * 2;

  const CLR_HEADER_BG  = "#1e3a5f";
  const CLR_HEADER_TXT = "#ffffff";
  const CLR_ACCENT     = "#2563eb";
  const CLR_TEXT       = "#1e293b";
  const CLR_MUTED      = "#64748b";
  const CLR_BORDER     = "#cbd5e1";
  const CLR_ROW_ALT    = "#f8fafc";
  const CLR_RED        = "#dc2626";
  const CLR_ORANGE     = "#ea580c";
  const CLR_WHITE      = "#ffffff";
  const CLR_SECTION_BG = "#eff6ff";
  const CLR_SECTION_BD = "#bfdbfe";

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true, autoFirstPage: false });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  function addPage() {
    doc.addPage({ size: "A4", margin: MARGIN });
  }

  function drawPageHeader() {
    const y = MARGIN;
    // Blue header bar
    doc.rect(0, 0, PAGE_W, 68).fill(CLR_HEADER_BG);
    // Company name
    doc.font("Helvetica-Bold").fontSize(14).fillColor(CLR_HEADER_TXT)
      .text("NEXUS ERP", MARGIN, 14, { lineBreak: false });
    // Document type
    doc.font("Helvetica").fontSize(9).fillColor("#93c5fd")
      .text("Sistema Integrado de Gestão Empresarial", MARGIN, 30, { lineBreak: false });
    // Report title (right side)
    doc.font("Helvetica-Bold").fontSize(13).fillColor(CLR_HEADER_TXT)
      .text("LAUDO DE IMPACTO DE RECALL", MARGIN, 14, { align: "right", lineBreak: false });
    doc.font("Helvetica").fontSize(8).fillColor("#93c5fd")
      .text(`Nº ${docNum}`, MARGIN, 30, { align: "right", lineBreak: false });
    // Separator line below header
    doc.moveTo(0, 68).lineTo(PAGE_W, 68).strokeColor(CLR_ACCENT).lineWidth(2).stroke();
    doc.y = y + 68 - MARGIN + 12; // position after header
  }

  function drawPageFooter(pageNum: number, totalPages: number) {
    const footerY = PAGE_H - 30;
    doc.moveTo(MARGIN, footerY - 6).lineTo(PAGE_W - MARGIN, footerY - 6)
      .strokeColor(CLR_BORDER).lineWidth(0.5).stroke();
    doc.font("Helvetica").fontSize(7).fillColor(CLR_MUTED)
      .text(`Documento gerado em ${generatedAt} — NEXUS ERP — Uso interno e auditoria ANVISA/ISO`, MARGIN, footerY, { lineBreak: false })
      .text(`Página ${pageNum} de ${totalPages}`, MARGIN, footerY, { align: "right", lineBreak: false });
  }

  function ensureSpace(needed: number) {
    if (doc.y + needed > PAGE_H - 50) {
      addPage();
      drawPageHeader();
    }
  }

  function sectionTitle(title: string) {
    ensureSpace(28);
    const sy = doc.y + 6;
    doc.rect(MARGIN, sy, CW, 18).fill(CLR_SECTION_BG);
    doc.rect(MARGIN, sy, 4, 18).fill(CLR_ACCENT);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(CLR_ACCENT)
      .text(title, MARGIN + 10, sy + 5, { lineBreak: false });
    doc.y = sy + 24;
  }

  function labelValue(label: string, value: string, x: number, y: number, colW: number) {
    doc.font("Helvetica").fontSize(7.5).fillColor(CLR_MUTED)
      .text(label, x, y, { lineBreak: false, width: colW });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(CLR_TEXT)
      .text(value, x, y + 9, { lineBreak: false, width: colW });
  }

  // ── Page 1 ──────────────────────────────────────────────────────────────────
  addPage();
  drawPageHeader();

  const topY = doc.y;

  // Document metadata box
  doc.rect(MARGIN, topY, CW, 54).fill(CLR_ROW_ALT).stroke(CLR_BORDER);
  doc.rect(MARGIN, topY, CW, 54).strokeColor(CLR_BORDER).lineWidth(0.5).stroke();
  const col4 = CW / 4;
  labelValue("Número do Documento", docNum, MARGIN + 8, topY + 6, col4 - 8);
  labelValue("Data de Emissão", generatedAt, MARGIN + col4 + 8, topY + 6, col4 - 8);
  labelValue("Responsável", req.session.userName ?? "Sistema", MARGIN + col4 * 2 + 8, topY + 6, col4 - 8);
  labelValue("Classificação", "CONFIDENCIAL — Uso Restrito", MARGIN + col4 * 3 + 8, topY + 6, col4 - 8);

  doc.y = topY + 62;

  // Purpose box
  sectionTitle("FINALIDADE DO DOCUMENTO");
  const purposeY = doc.y;
  doc.rect(MARGIN, purposeY, CW, 36).fill(CLR_ROW_ALT);
  doc.rect(MARGIN, purposeY, CW, 36).strokeColor(CLR_BORDER).lineWidth(0.5).stroke();
  doc.font("Helvetica").fontSize(8).fillColor(CLR_TEXT)
    .text(
      "Este laudo identifica todos os lotes de matérias-primas com status crítico de controle de qualidade (reprovado ou em quarentena) " +
      "e mapeia o impacto na cadeia produtiva, incluindo ordens de produção que consumiram tais lotes e os clientes potencialmente " +
      "expostos a produtos acabados derivados. Documento válido para fins de auditoria ANVISA, certificação ISO 9001 e ação de recall.",
      MARGIN + 8, purposeY + 6, { width: CW - 16, lineBreak: true }
    );
  doc.y = purposeY + 42;

  // Summary KPIs
  sectionTitle("RESUMO EXECUTIVO");
  const kpiY = doc.y;
  const kpiW = CW / 3;

  const kpis = [
    { label: "Lotes com Status Crítico", value: String(alerts.length), color: alerts.length > 0 ? CLR_RED : "#059669", sub: "reprovados + quarentena" },
    { label: "Ordens de Produção Afetadas", value: String(totalOpsAffected), color: totalOpsAffected > 0 ? CLR_ORANGE : CLR_MUTED, sub: "que consumiram lotes críticos" },
    { label: "Clientes Potencialmente Expostos", value: String(totalClientsExposed), color: totalClientsExposed > 0 ? CLR_RED : CLR_MUTED, sub: "via pedidos de venda vinculados" },
  ];

  kpis.forEach((kpi, i) => {
    const kx = MARGIN + i * kpiW;
    doc.rect(kx, kpiY, kpiW - 4, 56).fill(CLR_ROW_ALT);
    doc.rect(kx, kpiY, kpiW - 4, 56).strokeColor(CLR_BORDER).lineWidth(0.5).stroke();
    doc.rect(kx, kpiY, kpiW - 4, 3).fill(kpi.color);
    doc.font("Helvetica-Bold").fontSize(26).fillColor(kpi.color)
      .text(kpi.value, kx + 8, kpiY + 10, { lineBreak: false, width: kpiW - 16 });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(CLR_TEXT)
      .text(kpi.label, kx + 8, kpiY + 38, { lineBreak: false, width: kpiW - 16 });
    doc.font("Helvetica").fontSize(7).fillColor(CLR_MUTED)
      .text(kpi.sub, kx + 8, kpiY + 48, { lineBreak: false, width: kpiW - 16 });
  });

  doc.y = kpiY + 64;

  if (alerts.length === 0) {
    sectionTitle("RESULTADO DA ANÁLISE");
    const noAlertY = doc.y;
    doc.rect(MARGIN, noAlertY, CW, 48).fill("#f0fdf4");
    doc.rect(MARGIN, noAlertY, CW, 48).strokeColor("#86efac").lineWidth(0.5).stroke();
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#059669")
      .text("✓ Nenhum lote crítico detectado", MARGIN + 10, noAlertY + 10, { lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor("#15803d")
      .text("Todos os lotes estão aprovados ou pendentes de análise. Nenhuma ação de recall é necessária no momento.", MARGIN + 10, noAlertY + 26, { width: CW - 20 });
    doc.y = noAlertY + 56;
  } else {
    // ── Table of critical lots ──────────────────────────────────────────────────
    sectionTitle(`LISTA DE LOTES CRÍTICOS (${alerts.length} lote${alerts.length > 1 ? "s" : ""})`);

    // Table header
    const th = [
      { label: "Lote Interno", w: 95 },
      { label: "Produto", w: 130 },
      { label: "Status CQ", w: 65 },
      { label: "Qtd Total", w: 55 },
      { label: "Validade", w: 65 },
      { label: "OPs Afet.", w: 45 },
      { label: "Clientes Exp.", w: 50 },
    ];
    const TH = 14;
    const TD = 14;

    function drawTableHeader(ty: number) {
      doc.rect(MARGIN, ty, CW, TH).fill(CLR_ACCENT);
      let tx = MARGIN + 4;
      for (const col of th) {
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(CLR_WHITE)
          .text(col.label, tx, ty + 3.5, { lineBreak: false, width: col.w - 4 });
        tx += col.w;
      }
    }

    let tableY = doc.y;
    drawTableHeader(tableY);
    tableY += TH;

    for (let i = 0; i < alerts.length; i++) {
      ensureSpace(TD + 2);
      if (doc.y !== tableY) {
        tableY = doc.y;
        drawTableHeader(tableY);
        tableY += TH;
      }

      const a = alerts[i];
      const rowBg = i % 2 === 0 ? CLR_WHITE : CLR_ROW_ALT;
      doc.rect(MARGIN, tableY, CW, TD).fill(rowBg);
      doc.rect(MARGIN, tableY, CW, TD).strokeColor(CLR_BORDER).lineWidth(0.3).stroke();

      const statusLabel = a.cqStatus === "rejected" ? "Reprovado" : "Quarentena";
      const statusColor = a.cqStatus === "rejected" ? CLR_RED : CLR_ORANGE;

      let tx2 = MARGIN + 4;
      const rowData = [
        { text: a.internalLot ?? "—", color: CLR_TEXT, bold: true },
        { text: a.productName ?? "—", color: CLR_TEXT, bold: false },
        { text: statusLabel, color: statusColor, bold: true },
        { text: a.totalQty != null ? `${a.totalQty}` : "—", color: CLR_TEXT, bold: false },
        { text: fmtDate(a.expirationDate), color: CLR_TEXT, bold: false },
        { text: String(a.opsAffectedCount), color: a.opsAffectedCount > 0 ? CLR_ORANGE : CLR_MUTED, bold: a.opsAffectedCount > 0 },
        { text: String(a.clientsExposedCount), color: a.clientsExposedCount > 0 ? CLR_RED : CLR_MUTED, bold: a.clientsExposedCount > 0 },
      ];

      rowData.forEach((cell, ci) => {
        doc.font(cell.bold ? "Helvetica-Bold" : "Helvetica").fontSize(7.5).fillColor(cell.color)
          .text(cell.text, tx2, tableY + 3.5, { lineBreak: false, width: th[ci].w - 4 });
        tx2 += th[ci].w;
      });

      tableY += TD;
    }

    doc.y = tableY + 8;

    // ── Detailed section per lot ─────────────────────────────────────────────
    sectionTitle("DETALHAMENTO POR LOTE");

    for (const alert of alerts) {
      ensureSpace(60);
      const ay = doc.y;

      // Lot header
      const lotHeaderColor = alert.cqStatus === "rejected" ? "#fee2e2" : "#ffedd5";
      const lotBorderColor = alert.cqStatus === "rejected" ? "#fca5a5" : "#fdba74";
      const lotTextColor   = alert.cqStatus === "rejected" ? CLR_RED : CLR_ORANGE;
      doc.rect(MARGIN, ay, CW, 22).fill(lotHeaderColor);
      doc.rect(MARGIN, ay, CW, 22).strokeColor(lotBorderColor).lineWidth(0.5).stroke();
      doc.rect(MARGIN, ay, 5, 22).fill(lotTextColor);

      doc.font("Helvetica-Bold").fontSize(9).fillColor(lotTextColor)
        .text(alert.internalLot ?? "—", MARGIN + 12, ay + 4, { lineBreak: false });
      doc.font("Helvetica").fontSize(8).fillColor(CLR_TEXT)
        .text(alert.productName ?? "Produto não identificado", MARGIN + 12, ay + 14, { lineBreak: false });

      const statusLbl = alert.cqStatus === "rejected" ? "REPROVADO" : "QUARENTENA";
      doc.font("Helvetica-Bold").fontSize(8).fillColor(lotTextColor)
        .text(statusLbl, MARGIN, ay + 4, { align: "right", lineBreak: false });

      // Lot metadata row
      const metaY = ay + 26;
      const metaCols = [
        { label: "Lote Fornecedor", value: alert.supplierLot ?? "—" },
        { label: "Qtd Total", value: alert.totalQty != null ? `${alert.totalQty} un` : "—" },
        { label: "Qtd Disponível", value: alert.availableQty != null ? `${alert.availableQty} un` : "—" },
        { label: "Validade", value: fmtDate(alert.expirationDate) },
        { label: "Fabricação", value: fmtDate(alert.manufacturingDate) },
      ];
      const mcW = CW / metaCols.length;
      metaCols.forEach((mc, i) => {
        const mx = MARGIN + i * mcW;
        doc.font("Helvetica").fontSize(7).fillColor(CLR_MUTED)
          .text(mc.label, mx + 4, metaY, { lineBreak: false, width: mcW - 4 });
        doc.font("Helvetica-Bold").fontSize(8).fillColor(CLR_TEXT)
          .text(mc.value, mx + 4, metaY + 9, { lineBreak: false, width: mcW - 4 });
      });

      doc.y = metaY + 22;

      // Affected OPs sub-table
      if (alert.affectedOps.length > 0) {
        ensureSpace(12 + alert.affectedOps.length * 13 + 6);
        const opY = doc.y + 2;
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(CLR_MUTED)
          .text(`OPs Afetadas (${alert.affectedOps.length}):`, MARGIN + 4, opY);
        const opListY = opY + 11;
        doc.rect(MARGIN, opListY, CW / 2 - 4, 10).fill(CLR_ACCENT);
        doc.font("Helvetica-Bold").fontSize(7).fillColor(CLR_WHITE)
          .text("Nº da OP", MARGIN + 4, opListY + 2, { lineBreak: false, width: 90 });
        doc.font("Helvetica-Bold").fontSize(7).fillColor(CLR_WHITE)
          .text("Lote PA Gerado", MARGIN + 100, opListY + 2, { lineBreak: false });

        let opRowY = opListY + 10;
        for (let i = 0; i < alert.affectedOps.length; i++) {
          const op = alert.affectedOps[i];
          const rb = i % 2 === 0 ? CLR_WHITE : CLR_ROW_ALT;
          doc.rect(MARGIN, opRowY, CW / 2 - 4, 12).fill(rb);
          doc.rect(MARGIN, opRowY, CW / 2 - 4, 12).strokeColor(CLR_BORDER).lineWidth(0.3).stroke();
          doc.font("Helvetica-Bold").fontSize(7.5).fillColor(CLR_TEXT)
            .text(`OP ${op.number}`, MARGIN + 4, opRowY + 2.5, { lineBreak: false, width: 90 });
          doc.font("Helvetica").fontSize(7.5).fillColor(CLR_MUTED)
            .text(op.batchLot ?? "—", MARGIN + 100, opRowY + 2.5, { lineBreak: false });
          opRowY += 12;
        }
        doc.y = opRowY + 4;
      }

      // Exposed clients sub-table
      if (alert.exposedClients.length > 0) {
        ensureSpace(12 + alert.exposedClients.length * 13 + 6);
        const clY = doc.y + 2;
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(CLR_MUTED)
          .text(`Clientes Potencialmente Expostos (${alert.exposedClients.length}):`, MARGIN + 4, clY);

        const clStartX = MARGIN + CW / 2 + 4;
        const clW = CW / 2 - 4;
        const clListY = clY + 11;
        doc.rect(clStartX, clListY, clW, 10).fill(CLR_ACCENT);
        doc.font("Helvetica-Bold").fontSize(7).fillColor(CLR_WHITE)
          .text("Cliente", clStartX + 4, clListY + 2, { lineBreak: false, width: clW / 2 });
        doc.font("Helvetica-Bold").fontSize(7).fillColor(CLR_WHITE)
          .text("Cidade / Documento", clStartX + clW / 2 + 4, clListY + 2, { lineBreak: false });

        let clRowY = clListY + 10;
        for (let i = 0; i < alert.exposedClients.length; i++) {
          const cl = alert.exposedClients[i];
          const rb = i % 2 === 0 ? CLR_WHITE : CLR_ROW_ALT;
          doc.rect(clStartX, clRowY, clW, 12).fill(rb);
          doc.rect(clStartX, clRowY, clW, 12).strokeColor(CLR_BORDER).lineWidth(0.3).stroke();
          doc.font("Helvetica-Bold").fontSize(7.5).fillColor(CLR_TEXT)
            .text(cl.clientName ?? "—", clStartX + 4, clRowY + 2.5, { lineBreak: false, width: clW / 2 - 4 });
          doc.font("Helvetica").fontSize(7.5).fillColor(CLR_MUTED)
            .text(cl.clientCity ?? cl.clientDocument ?? "—", clStartX + clW / 2 + 4, clRowY + 2.5, { lineBreak: false, width: clW / 2 - 4 });
          clRowY += 12;
        }
        doc.y = Math.max(doc.y, clRowY + 4);
      }

      doc.y += 10;
      // Divider
      doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CW, doc.y)
        .strokeColor(CLR_BORDER).lineWidth(0.5).stroke();
      doc.y += 8;
    }
  }

  // ── Signature area (last page) ─────────────────────────────────────────────
  ensureSpace(90);
  const sigY = doc.y + 10;
  sectionTitle("ASSINATURAS E VALIDAÇÃO");
  const sigBoxY = doc.y;
  const sigW = (CW - 16) / 3;

  const sigLabels = ["Responsável Técnico / CQ", "Gerente de Produção", "Diretoria"];
  sigLabels.forEach((label, i) => {
    const sx = MARGIN + i * (sigW + 8);
    doc.rect(sx, sigBoxY, sigW, 52).fill(CLR_ROW_ALT);
    doc.rect(sx, sigBoxY, sigW, 52).strokeColor(CLR_BORDER).lineWidth(0.5).stroke();
    // Signature line
    doc.moveTo(sx + 8, sigBoxY + 36).lineTo(sx + sigW - 8, sigBoxY + 36)
      .strokeColor(CLR_BORDER).lineWidth(1).stroke();
    doc.font("Helvetica").fontSize(7).fillColor(CLR_MUTED)
      .text("Assinatura", sx + sigW / 2 - 16, sigBoxY + 38, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(CLR_TEXT)
      .text(label, sx + 4, sigBoxY + 44, { lineBreak: false, width: sigW - 8 });
    doc.font("Helvetica").fontSize(7).fillColor(CLR_MUTED)
      .text(`Data: ___/___/______`, sx + 4, sigBoxY + 4, { lineBreak: false });
  });

  doc.y = sigBoxY + 60;

  // Legal notice
  ensureSpace(30);
  const legalY = doc.y + 4;
  doc.rect(MARGIN, legalY, CW, 24).fill("#fef9c3");
  doc.rect(MARGIN, legalY, CW, 24).strokeColor("#fde68a").lineWidth(0.5).stroke();
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#92400e")
    .text("⚠  AVISO LEGAL:", MARGIN + 8, legalY + 5, { lineBreak: false });
  doc.font("Helvetica").fontSize(7.5).fillColor("#92400e")
    .text(
      "Este documento é de uso restrito. A divulgação não autorizada é proibida. " +
      "Em caso de ação de recall, notifique imediatamente a ANVISA conforme RDC 204/2017.",
      MARGIN + 8, legalY + 14, { width: CW - 16, lineBreak: false }
    );

  // ── Finalize pages & add footers ───────────────────────────────────────────
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    drawPageFooter(i + 1, totalPages);
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);
  });

  const pdfBuffer = Buffer.concat(chunks);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="laudo-recall-${docNum}.pdf"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  res.send(pdfBuffer);
});

export default router;
