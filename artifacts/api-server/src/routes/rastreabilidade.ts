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

export default router;
