import { Router, type IRouter } from "express";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db, fiscalDocumentsTable } from "@workspace/db";
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
