import { Router, type IRouter } from "express";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db, fiscalDocumentsTable, suppliersTable, productsTable, stockMovementsTable } from "@workspace/db";
import type { Request, Response } from "express";
import multer from "multer";
import { XMLParser } from "fast-xml-parser";

const router: IRouter = Router();

// ─── Multer (memory storage — XML files are small) ────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── NF-e XML Parser ──────────────────────────────────────────────────────────

interface NFeItem {
  itemNumber: number;
  supplierCode: string;
  ean: string | null;
  description: string;
  ncm: string;
  cfop: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  icmsValue: string | null;
  icmsRate: string | null;
  pisValue: string | null;
  cofinsValue: string | null;
  existingProductId: number | null;
  existingProductName: string | null;
  importAs: "existing" | "create" | "skip";
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseNFeXmlContent(xmlStr: string): {
  accessKey: string;
  issueDate: string;
  number: string;
  serie: string;
  naturalOperation: string;
  tpNF: number;
  emitterName: string;
  emitterTradeName: string | null;
  emitterDocument: string;
  emitterStreet: string | null;
  emitterNumber: string | null;
  emitterCity: string | null;
  emitterState: string | null;
  emitterZip: string | null;
  recipientName: string;
  recipientDocument: string;
  items: NFeItem[];
  totalNF: string;
  totalICMS: string;
  totalPIS: string;
  totalCOFINS: string;
  // cobr — billing/payment summary
  fatNumber: string | null;
  fatOriginalValue: string | null;
  fatNetValue: string | null;
  installments: Array<{ number: string; dueDate: string; value: string }>;
  // infAdic — additional information
  additionalInfo: string | null;
  fiscalInfo: string | null;
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => name === "det",
    ignoreDeclaration: true,
    ignorePiTags: true,
    trimValues: true,
    numberParseOptions: { leadingZeros: false, hex: false, skipLike: /.*/ },
    parseTagValue: false,
  });

  const doc = parser.parse(xmlStr);

  // Support nfeProc wrapper or bare NFe
  const proc = doc.nfeProc ?? doc;
  const nfeNode = proc.NFe ?? proc;
  const infNFe = nfeNode.infNFe;

  if (!infNFe) {
    throw new Error("Estrutura XML inválida: elemento infNFe não encontrado");
  }

  // Access key: prefer protNFe, fallback to @Id attribute (remove "NFe" prefix)
  let accessKey = str(proc.protNFe?.infProt?.chNFe);
  if (!accessKey) {
    const attrId = str(infNFe["@_Id"]);
    accessKey = attrId.startsWith("NFe") ? attrId.slice(3) : attrId;
  }

  const ide = infNFe.ide ?? {};
  const emit = infNFe.emit ?? {};
  const dest = infNFe.dest ?? {};
  const total = infNFe.total?.ICMSTot ?? {};

  const emitterCNPJ = str(emit.CNPJ || emit.CPF);
  const recipientCNPJ = str(dest.CNPJ || dest.CPF);

  const ender = emit.enderEmit ?? {};

  // Parse items
  const detList: unknown[] = Array.isArray(infNFe.det) ? infNFe.det : infNFe.det ? [infNFe.det] : [];

  const items: NFeItem[] = detList.map((det: unknown) => {
    const d = det as Record<string, unknown>;
    const prod = (d.prod ?? {}) as Record<string, unknown>;
    const imposto = (d.imposto ?? {}) as Record<string, unknown>;

    // Extract ICMS value — can be nested under ICMS00, ICMS10, ICMS20, etc.
    const icmsGroup = (imposto.ICMS ?? {}) as Record<string, unknown>;
    let icmsValue: string | null = null;
    let icmsRate: string | null = null;
    for (const key of Object.keys(icmsGroup)) {
      const g = icmsGroup[key] as Record<string, unknown>;
      if (g && typeof g === "object") {
        if (g.vICMS != null) icmsValue = str(g.vICMS);
        if (g.pICMS != null) icmsRate = str(g.pICMS);
        break;
      }
    }

    const pisGroup = (imposto.PIS ?? {}) as Record<string, unknown>;
    let pisValue: string | null = null;
    for (const key of Object.keys(pisGroup)) {
      const g = pisGroup[key] as Record<string, unknown>;
      if (g && typeof g === "object" && g.vPIS != null) { pisValue = str(g.vPIS); break; }
    }

    const cofinsGroup = (imposto.COFINS ?? {}) as Record<string, unknown>;
    let cofinsValue: string | null = null;
    for (const key of Object.keys(cofinsGroup)) {
      const g = cofinsGroup[key] as Record<string, unknown>;
      if (g && typeof g === "object" && g.vCOFINS != null) { cofinsValue = str(g.vCOFINS); break; }
    }

    const ean = str(prod.cEAN);

    return {
      itemNumber: parseInt(str(d["@_nItem"] ?? "0"), 10),
      supplierCode: str(prod.cProd),
      ean: ean && ean !== "SEM GTIN" && ean !== "SEM GTIN " ? ean : null,
      description: str(prod.xProd),
      ncm: str(prod.NCM),
      cfop: str(prod.CFOP),
      unit: str(prod.uCom),
      quantity: str(prod.qCom),
      unitPrice: str(prod.vUnCom),
      totalPrice: str(prod.vProd),
      icmsValue,
      icmsRate,
      pisValue,
      cofinsValue,
      existingProductId: null,
      existingProductName: null,
      importAs: "create" as const,
    };
  });

  // Parse issue date from dEmi (format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  const dEmi = str(ide.dEmi || ide.dhEmi);

  // Parse cobr (billing/payment)
  const cobr = (infNFe.cobr ?? {}) as Record<string, unknown>;
  const fat = (cobr.fat ?? {}) as Record<string, unknown>;
  const dupRaw = cobr.dup;
  const dupList: Array<{ number: string; dueDate: string; value: string }> = [];
  if (dupRaw) {
    const dups = Array.isArray(dupRaw) ? dupRaw : [dupRaw];
    for (const dup of dups) {
      const d = dup as Record<string, unknown>;
      dupList.push({
        number: str(d.nDup),
        dueDate: str(d.dVenc),
        value: str(d.vDup),
      });
    }
  }

  // Parse infAdic (additional info)
  const infAdic = (infNFe.infAdic ?? {}) as Record<string, unknown>;

  return {
    accessKey,
    issueDate: dEmi,
    number: str(ide.nNF),
    serie: str(ide.serie),
    naturalOperation: str(ide.natOp),
    tpNF: parseInt(str(ide.tpNF || "0"), 10),
    emitterName: str(emit.xNome),
    emitterTradeName: str(emit.xFant) || null,
    emitterDocument: emitterCNPJ,
    emitterStreet: str(ender.xLgr) || null,
    emitterNumber: str(ender.nro) || null,
    emitterCity: str(ender.xMun) || null,
    emitterState: str(ender.UF) || null,
    emitterZip: str(ender.CEP) || null,
    recipientName: str(dest.xNome),
    recipientDocument: recipientCNPJ,
    items,
    totalNF: str(total.vNF || "0"),
    totalICMS: str(total.vICMS || "0"),
    totalPIS: str(total.vPIS || "0"),
    totalCOFINS: str(total.vCOFINS || "0"),
    fatNumber: str(fat.nFat) || null,
    fatOriginalValue: str(fat.vOrig) || null,
    fatNetValue: str(fat.vLiq) || null,
    installments: dupList,
    additionalInfo: str(infAdic.infCpl) || null,
    fiscalInfo: str(infAdic.infAdFisco) || null,
  };
}

// ─── POST /fiscal/import-xml ──────────────────────────────────────────────────

router.post(
  "/fiscal/import-xml",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.session.userId) { res.status(401).json({ error: "Não autenticado" }); return; }

    if (!req.file) { res.status(400).json({ error: "Arquivo XML não enviado" }); return; }

    const xmlStr = req.file.buffer.toString("utf-8");

    let parsed;
    try {
      parsed = parseNFeXmlContent(xmlStr);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao processar XML";
      res.status(400).json({ error: msg }); return;
    }

    // Check for duplicate access key
    let duplicateAccessKey = false;
    if (parsed.accessKey) {
      const [existing] = await db
        .select({ id: fiscalDocumentsTable.id })
        .from(fiscalDocumentsTable)
        .where(eq(fiscalDocumentsTable.accessKey, parsed.accessKey));
      duplicateAccessKey = !!existing;
    }

    // Lookup existing supplier by CNPJ
    let existingSupplierId: number | null = null;
    if (parsed.emitterDocument) {
      const cnpjClean = parsed.emitterDocument.replace(/\D/g, "");
      const [supplier] = await db
        .select({ id: suppliersTable.id })
        .from(suppliersTable)
        .where(
          or(
            eq(suppliersTable.document, parsed.emitterDocument),
            eq(suppliersTable.document, cnpjClean)
          ) ?? eq(suppliersTable.document, parsed.emitterDocument)
        );
      existingSupplierId = supplier?.id ?? null;
    }

    // Lookup existing products by EAN or supplierCode
    const itemsWithLookup = await Promise.all(
      parsed.items.map(async (item) => {
        // Try EAN first, then name similarity (by NCM+description)
        let existingProductId: number | null = null;
        let existingProductName: string | null = null;

        // Match priority: EAN → supplier code (cProd) → none
        if (item.ean) {
          const [prod] = await db
            .select({ id: productsTable.id, name: productsTable.name })
            .from(productsTable)
            .where(eq(productsTable.sku, item.ean));
          if (prod) { existingProductId = prod.id; existingProductName = prod.name; }
        }

        if (!existingProductId && item.supplierCode) {
          const [prod] = await db
            .select({ id: productsTable.id, name: productsTable.name })
            .from(productsTable)
            .where(eq(productsTable.sku, item.supplierCode));
          if (prod) { existingProductId = prod.id; existingProductName = prod.name; }
        }

        return {
          ...item,
          existingProductId,
          existingProductName,
          importAs: existingProductId ? ("existing" as const) : ("create" as const),
        };
      })
    );

    res.json({
      ...parsed,
      items: itemsWithLookup,
      xmlContent: xmlStr,
      existingSupplierId,
      duplicateAccessKey,
    });
  }
);

// ─── POST /fiscal/import-xml/confirm ─────────────────────────────────────────

router.post("/fiscal/import-xml/confirm", async (req: Request, res: Response): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Não autenticado" }); return; }

  const {
    accessKey, issueDate, number, cfop, tpNF,
    emitterName, emitterDocument, emitterTradeName,
    emitterStreet, emitterNumber: emitterNum, emitterCity, emitterState, emitterZip,
    recipientName, recipientDocument,
    totalNF, totalICMS, totalPIS, totalCOFINS,
    xmlContent, existingSupplierId, createSupplier,
    notes, items,
  } = req.body;

  if (!emitterName || !recipientName || !issueDate || !totalNF || !xmlContent) {
    res.status(400).json({ error: "Dados obrigatórios ausentes" }); return;
  }

  // Duplicate key check
  if (accessKey) {
    const [dup] = await db
      .select({ id: fiscalDocumentsTable.id })
      .from(fiscalDocumentsTable)
      .where(eq(fiscalDocumentsTable.accessKey, accessKey));
    if (dup) { res.status(409).json({ error: "Chave de acesso já importada (NF-e duplicada)" }); return; }
  }

  // Determine direction from tpNF (0=entrada, 1=saída)
  const direction = tpNF === 0 ? "entrada" : "saida";

  // Compute primary CFOP from first item if not set
  const firstCfop = cfop || (Array.isArray(items) && items.length > 0 ? items[0].cfop : null) || null;

  const result = await db.transaction(async (tx) => {
    // 1. Supplier upsert
    let supplierId: number | null = existingSupplierId ?? null;
    if (!supplierId && createSupplier && emitterDocument) {
      const cnpj = emitterDocument;
      const [existingSup] = await tx
        .select({ id: suppliersTable.id })
        .from(suppliersTable)
        .where(eq(suppliersTable.document, cnpj));

      if (existingSup) {
        supplierId = existingSup.id;
      } else {
        const [newSup] = await tx
          .insert(suppliersTable)
          .values({
            name: emitterName,
            tradeName: emitterTradeName || null,
            document: cnpj,
            street: emitterStreet || null,
            addressNumber: emitterNum || null,
            city: emitterCity || null,
            state: emitterState || null,
            zipCode: emitterZip || null,
            active: "true",
          })
          .returning({ id: suppliersTable.id });
        supplierId = newSup.id;
      }
    }

    // 2. Products upsert + stock movements
    const itemArray: Array<{
      importAs: string; existingProductId: number | null;
      description: string; ncm: string; unit: string; supplierCode: string;
      quantity: string; totalPrice: string; category?: string | null;
    }> = Array.isArray(items) ? items : [];

    for (const item of itemArray) {
      if (item.importAs === "skip") continue;

      let productId: number | null = item.existingProductId ?? null;

      if (item.importAs === "create") {
        const [newProd] = await tx
          .insert(productsTable)
          .values({
            name: item.description,
            sku: item.supplierCode || null,
            unit: item.unit || "un",
            ncm: item.ncm || null,
            category: item.category || null,
            defaultSupplierId: supplierId,
            currentStock: "0",
            minStock: 0,
          })
          .returning({ id: productsTable.id });
        productId = newProd.id;
      }

      if (productId && parseFloat(item.quantity) > 0) {
        const qty = parseFloat(item.quantity);
        const unitCost = parseFloat(item.totalPrice) / qty;
        const movType = direction === "entrada" ? "input" : "output";

        await tx.insert(stockMovementsTable).values({
          productId,
          type: movType,
          quantity: String(qty),
          reason: `NF-e ${number || ""} - ${emitterName}`,
          notes: accessKey ? `Chave: ${accessKey}` : null,
          referenceType: "nfe_import",
        });

        // Increment for entrada, decrement for saída
        const stockDelta = direction === "entrada" ? qty : -qty;
        await tx
          .update(productsTable)
          .set({
            currentStock: sql`${productsTable.currentStock} + ${stockDelta}`,
            ...(direction === "entrada" ? { costPrice: String(unitCost.toFixed(2)) } : {}),
          })
          .where(eq(productsTable.id, productId));
      }
    }

    // 3. Fiscal document
    const [doc] = await tx
      .insert(fiscalDocumentsTable)
      .values({
        type: direction === "entrada" ? "nf_entrada" : "nfe",
        direction,
        number: number || null,
        emitter: emitterName,
        recipient: recipientName,
        emitterDocument: emitterDocument || null,
        recipientDocument: recipientDocument || null,
        issueDate: new Date(issueDate),
        totalAmount: String(totalNF),
        cfop: firstCfop,
        icmsAmount: String(totalICMS || "0"),
        pisAmount: String(totalPIS || "0"),
        cofinsAmount: String(totalCOFINS || "0"),
        issAmount: "0",
        status: "issued",
        notes: notes || null,
        accessKey: accessKey || null,
        xmlContent: xmlContent || null,
      })
      .returning();

    return doc;
  });

  res.status(201).json(result);
});

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  return true;
}

function parseId(param: string | string[], res: Response): number | null {
  const raw = Array.isArray(param) ? param[0] : param;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return null;
  }
  return id;
}

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

// ─── List documents ────────────────────────────────────────────────────────────

router.get("/fiscal/documents", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { type, direction, status, startDate, endDate, search } = req.query as Record<string, string>;

  const conditions = [];

  if (type) conditions.push(eq(fiscalDocumentsTable.type, type));
  if (direction) conditions.push(eq(fiscalDocumentsTable.direction, direction));
  if (status) conditions.push(eq(fiscalDocumentsTable.status, status));
  if (startDate) conditions.push(gte(fiscalDocumentsTable.issueDate, new Date(startDate)));
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(fiscalDocumentsTable.issueDate, end));
  }
  if (search) {
    conditions.push(
      or(
        ilike(fiscalDocumentsTable.number, `%${search}%`),
        ilike(fiscalDocumentsTable.emitter, `%${search}%`),
        ilike(fiscalDocumentsTable.recipient, `%${search}%`),
        ilike(fiscalDocumentsTable.emitterDocument, `%${search}%`),
        ilike(fiscalDocumentsTable.recipientDocument, `%${search}%`)
      )
    );
  }

  const docs = await db
    .select()
    .from(fiscalDocumentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(fiscalDocumentsTable.issueDate));

  res.json(docs);
});

// ─── Create document ───────────────────────────────────────────────────────────

router.post("/fiscal/documents", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const {
    type, direction, number, emitter, recipient,
    emitterDocument, recipientDocument, issueDate, totalAmount,
    cfop, icmsAmount, pisAmount, cofinsAmount, issAmount,
    status, referenceOrderId, notes,
  } = req.body;

  if (!type || !emitter || !recipient || !issueDate || !totalAmount || !status) {
    res.status(400).json({ error: "Campos obrigatórios ausentes" });
    return;
  }

  const [doc] = await db
    .insert(fiscalDocumentsTable)
    .values({
      type,
      direction: direction ?? "saida",
      number: number || null,
      emitter,
      recipient,
      emitterDocument: emitterDocument || null,
      recipientDocument: recipientDocument || null,
      issueDate: new Date(issueDate),
      totalAmount: String(totalAmount),
      cfop: cfop || null,
      icmsAmount: icmsAmount != null ? String(icmsAmount) : "0",
      pisAmount: pisAmount != null ? String(pisAmount) : "0",
      cofinsAmount: cofinsAmount != null ? String(cofinsAmount) : "0",
      issAmount: issAmount != null ? String(issAmount) : "0",
      status,
      referenceOrderId: referenceOrderId || null,
      notes: notes || null,
    })
    .returning();

  res.status(201).json(doc);
});

// ─── Update document ───────────────────────────────────────────────────────────

router.put("/fiscal/documents/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const {
    type, direction, number, emitter, recipient,
    emitterDocument, recipientDocument, issueDate, totalAmount,
    cfop, icmsAmount, pisAmount, cofinsAmount, issAmount,
    status, referenceOrderId, notes,
  } = req.body;

  const [existing] = await db
    .select({ id: fiscalDocumentsTable.id })
    .from(fiscalDocumentsTable)
    .where(eq(fiscalDocumentsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Documento não encontrado" });
    return;
  }

  const [updated] = await db
    .update(fiscalDocumentsTable)
    .set({
      type,
      direction,
      number: number || null,
      emitter,
      recipient,
      emitterDocument: emitterDocument || null,
      recipientDocument: recipientDocument || null,
      issueDate: new Date(issueDate),
      totalAmount: String(totalAmount),
      cfop: cfop || null,
      icmsAmount: icmsAmount != null ? String(icmsAmount) : "0",
      pisAmount: pisAmount != null ? String(pisAmount) : "0",
      cofinsAmount: cofinsAmount != null ? String(cofinsAmount) : "0",
      issAmount: issAmount != null ? String(issAmount) : "0",
      status,
      referenceOrderId: referenceOrderId || null,
      notes: notes || null,
    })
    .where(eq(fiscalDocumentsTable.id, id))
    .returning();

  res.json(updated);
});

// ─── Delete document ───────────────────────────────────────────────────────────

router.delete("/fiscal/documents/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select({ id: fiscalDocumentsTable.id })
    .from(fiscalDocumentsTable)
    .where(eq(fiscalDocumentsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Documento não encontrado" });
    return;
  }

  await db.delete(fiscalDocumentsTable).where(eq(fiscalDocumentsTable.id, id));
  res.json({ ok: true });
});

// ─── Tax summary ───────────────────────────────────────────────────────────────

router.get("/fiscal/tax-summary", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const year = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getFullYear();

  const rows = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${fiscalDocumentsTable.issueDate})::int`,
      totalAmount: sql<string>`COALESCE(SUM(${fiscalDocumentsTable.totalAmount}), 0)::text`,
      icmsTotal: sql<string>`COALESCE(SUM(${fiscalDocumentsTable.icmsAmount}), 0)::text`,
      pisTotal: sql<string>`COALESCE(SUM(${fiscalDocumentsTable.pisAmount}), 0)::text`,
      cofinsTotal: sql<string>`COALESCE(SUM(${fiscalDocumentsTable.cofinsAmount}), 0)::text`,
      issTotal: sql<string>`COALESCE(SUM(${fiscalDocumentsTable.issAmount}), 0)::text`,
      documentCount: sql<number>`COUNT(*)::int`,
    })
    .from(fiscalDocumentsTable)
    .where(
      and(
        sql`EXTRACT(YEAR FROM ${fiscalDocumentsTable.issueDate}) = ${year}`,
        eq(fiscalDocumentsTable.status, "issued")
      )
    )
    .groupBy(sql`EXTRACT(MONTH FROM ${fiscalDocumentsTable.issueDate})`)
    .orderBy(sql`EXTRACT(MONTH FROM ${fiscalDocumentsTable.issueDate})`);

  // Fill all 12 months
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const result = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const row = byMonth.get(m);
    return {
      year,
      month: m,
      monthLabel: MONTH_LABELS[i],
      totalAmount: row?.totalAmount ?? "0",
      icmsTotal: row?.icmsTotal ?? "0",
      pisTotal: row?.pisTotal ?? "0",
      cofinsTotal: row?.cofinsTotal ?? "0",
      issTotal: row?.issTotal ?? "0",
      documentCount: row?.documentCount ?? 0,
    };
  });

  res.json(result);
});

// ─── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/fiscal/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const [totals] = await db
    .select({
      totalDocuments: sql<number>`COUNT(*)::int`,
      issuedCount: sql<number>`COUNT(*) FILTER (WHERE ${fiscalDocumentsTable.status} = 'issued')::int`,
      cancelledCount: sql<number>`COUNT(*) FILTER (WHERE ${fiscalDocumentsTable.status} = 'cancelled')::int`,
      totalAmount: sql<string>`COALESCE(SUM(${fiscalDocumentsTable.totalAmount}) FILTER (WHERE ${fiscalDocumentsTable.status} = 'issued'), 0)::text`,
      totalIcms: sql<string>`COALESCE(SUM(${fiscalDocumentsTable.icmsAmount}) FILTER (WHERE ${fiscalDocumentsTable.status} = 'issued'), 0)::text`,
      totalPis: sql<string>`COALESCE(SUM(${fiscalDocumentsTable.pisAmount}) FILTER (WHERE ${fiscalDocumentsTable.status} = 'issued'), 0)::text`,
      totalCofins: sql<string>`COALESCE(SUM(${fiscalDocumentsTable.cofinsAmount}) FILTER (WHERE ${fiscalDocumentsTable.status} = 'issued'), 0)::text`,
      totalIss: sql<string>`COALESCE(SUM(${fiscalDocumentsTable.issAmount}) FILTER (WHERE ${fiscalDocumentsTable.status} = 'issued'), 0)::text`,
    })
    .from(fiscalDocumentsTable);

  const byTypeRows = await db
    .select({
      type: fiscalDocumentsTable.type,
      count: sql<number>`COUNT(*)::int`,
      totalAmount: sql<string>`COALESCE(SUM(${fiscalDocumentsTable.totalAmount}), 0)::text`,
    })
    .from(fiscalDocumentsTable)
    .where(eq(fiscalDocumentsTable.status, "issued"))
    .groupBy(fiscalDocumentsTable.type);

  res.json({
    totalDocuments: totals?.totalDocuments ?? 0,
    issuedCount: totals?.issuedCount ?? 0,
    cancelledCount: totals?.cancelledCount ?? 0,
    totalAmount: totals?.totalAmount ?? "0",
    totalIcms: totals?.totalIcms ?? "0",
    totalPis: totals?.totalPis ?? "0",
    totalCofins: totals?.totalCofins ?? "0",
    totalIss: totals?.totalIss ?? "0",
    byType: byTypeRows,
  });
});

// ─── CSV Export ────────────────────────────────────────────────────────────────

router.get("/fiscal/export-csv", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { type, direction, status, startDate, endDate, search } = req.query as Record<string, string>;

  const conditions = [];
  if (type) conditions.push(eq(fiscalDocumentsTable.type, type));
  if (direction) conditions.push(eq(fiscalDocumentsTable.direction, direction));
  if (status) conditions.push(eq(fiscalDocumentsTable.status, status));
  if (startDate) conditions.push(gte(fiscalDocumentsTable.issueDate, new Date(startDate)));
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(fiscalDocumentsTable.issueDate, end));
  }
  if (search) {
    conditions.push(
      or(
        ilike(fiscalDocumentsTable.number, `%${search}%`),
        ilike(fiscalDocumentsTable.emitter, `%${search}%`),
        ilike(fiscalDocumentsTable.recipient, `%${search}%`)
      )
    );
  }

  const docs = await db
    .select()
    .from(fiscalDocumentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(fiscalDocumentsTable.issueDate));

  const header = [
    "ID", "Tipo", "Direção", "Número", "Emitente", "Destinatário",
    "CPF/CNPJ Emitente", "CPF/CNPJ Destinatário", "Data Emissão",
    "Valor Total", "CFOP", "ICMS", "PIS", "COFINS", "ISS",
    "Status", "Pedido Referência", "Observações",
  ].join(";");

  const escape = (v: string | null | undefined) => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(";") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const TYPE_LABELS: Record<string, string> = { nfe: "NF-e", nfse: "NFS-e", nf_entrada: "NF Entrada" };

  const rows = docs.map((d) =>
    [
      d.id,
      TYPE_LABELS[d.type] ?? d.type,
      d.direction === "saida" ? "Saída" : "Entrada",
      escape(d.number),
      escape(d.emitter),
      escape(d.recipient),
      escape(d.emitterDocument),
      escape(d.recipientDocument),
      d.issueDate.toLocaleDateString("pt-BR"),
      d.totalAmount,
      escape(d.cfop),
      d.icmsAmount ?? "0",
      d.pisAmount ?? "0",
      d.cofinsAmount ?? "0",
      d.issAmount ?? "0",
      d.status === "issued" ? "Emitida" : "Cancelada",
      escape(d.referenceOrderId),
      escape(d.notes),
    ].join(";")
  );

  const csv = [header, ...rows].join("\n");
  const bom = "\uFEFF"; // UTF-8 BOM for Excel

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="documentos-fiscais.csv"`);
  res.send(bom + csv);
});

export default router;
