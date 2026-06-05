import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  financialEntriesTable,
  salesOrdersTable,
  clientsTable,
  productsTable,
  stockMovementsTable,
  purchaseOrdersTable,
  employeesTable,
  projectsTable,
} from "@workspace/db";
import PDFDocument from "pdfkit";

type Period = "this_month" | "last_month" | "this_quarter" | "this_year";

export const ALL_REPORT_MODULES = ["financeiro", "vendas", "estoque", "compras", "rh", "projetos"] as const;
export type ReportModuleKey = typeof ALL_REPORT_MODULES[number];

export interface PdfOptions {
  companyName?: string;
  logoBase64?: string | null;
  includeHeader?: boolean;
  modules?: string[] | null;
}

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function getDateRange(period: Period): { start: Date; end: Date; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "this_month":
      return { start: new Date(y, m, 1), end: now, label: `${MONTH_LABELS[m]}/${y}` };
    case "last_month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return { start: new Date(ly, lm, 1), end: new Date(y, m, 0, 23, 59, 59, 999), label: `${MONTH_LABELS[lm]}/${ly}` };
    }
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return { start: new Date(y, q * 3, 1), end: now, label: `T${q + 1}/${y}` };
    }
    case "this_year":
      return { start: new Date(y, 0, 1), end: now, label: String(y) };
  }
}

export function getPreviousPeriodRange(
  _period: Period,
  current: { start: Date; end: Date; label: string },
): { start: Date; end: Date; label: string } {
  const diff = current.end.getTime() - current.start.getTime();
  const prevEnd = new Date(current.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  return { start: prevStart, end: prevEnd, label: "" };
}

function fmtBRL(v: string | number | null | undefined): string {
  return parseFloat(String(v ?? "0")).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return "—";
  const pct = ((current - previous) / previous) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

// ─── PDF Layout Constants ────────────────────────────────────────────────────

const PAGE_W = 595.28;
const MARGIN = 45;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 72;
const FOOTER_H = 28;

const CLR_BLUE     = "#1e40af";
const CLR_BLUE_MID = "#3b82f6";
const CLR_ACCENT   = "#dbeafe";
const CLR_TEXT     = "#1e293b";
const CLR_MUTED    = "#64748b";
const CLR_BORDER   = "#e2e8f0";
const CLR_ROW_ALT  = "#f8fafc";
const CLR_WHITE    = "#ffffff";
const CLR_GREEN    = "#059669";
const CLR_RED      = "#dc2626";
const CLR_AMBER    = "#d97706";

export async function buildReportPdf(period: Period, options: PdfOptions = {}): Promise<Buffer> {
  const range = getDateRange(period);
  const prevRange = getPreviousPeriodRange(period, range);
  const now = new Date();

  const companyName = options.companyName?.trim() || "NEXUS ERP";
  const includeHeader = options.includeHeader !== false;

  // Determine active modules — empty/null means all
  const activeModules: Set<string> = (options.modules && options.modules.length > 0)
    ? new Set(options.modules)
    : new Set(ALL_REPORT_MODULES);
  const inc = (m: string) => activeModules.has(m);

  let logoBuffer: Buffer | null = null;
  let logoFormat: string = "PNG";
  if (options.logoBase64) {
    try {
      const raw = options.logoBase64;
      const commaIdx = raw.indexOf(",");
      if (commaIdx !== -1) {
        const base64Data = raw.slice(commaIdx + 1);
        const mimeMatch = raw.slice(0, commaIdx).match(/data:image\/(\w+)/i);
        const ext = mimeMatch?.[1]?.toLowerCase() ?? "png";
        logoFormat = ext === "jpg" || ext === "jpeg" ? "JPEG" : "PNG";
        logoBuffer = Buffer.from(base64Data, "base64");
      }
    } catch {
      logoBuffer = null;
    }
  }

  // ── Fetch all data ─────────────────────────────────────────────────────────

  const [
    revenueRow,
    expenseRow,
    revenuePrevRow,
    expensePrevRow,
    openSalesRow,
    newSalesRow,
    lowStockRow,
    pendingPurchaseRow,
    activeEmployeesRow,
    activeProjectsRow,
  ] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(and(eq(financialEntriesTable.type, "income"), eq(financialEntriesTable.status, "paid"), gte(financialEntriesTable.paidAt, range.start), lte(financialEntriesTable.paidAt, range.end))),
    db.select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(and(eq(financialEntriesTable.type, "expense"), eq(financialEntriesTable.status, "paid"), gte(financialEntriesTable.paidAt, range.start), lte(financialEntriesTable.paidAt, range.end))),
    db.select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(and(eq(financialEntriesTable.type, "income"), eq(financialEntriesTable.status, "paid"), gte(financialEntriesTable.paidAt, prevRange.start), lte(financialEntriesTable.paidAt, prevRange.end))),
    db.select({ total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text` })
      .from(financialEntriesTable)
      .where(and(eq(financialEntriesTable.type, "expense"), eq(financialEntriesTable.status, "paid"), gte(financialEntriesTable.paidAt, prevRange.start), lte(financialEntriesTable.paidAt, prevRange.end))),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(salesOrdersTable).where(sql`${salesOrdersTable.status} IN ('draft', 'confirmed')`),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(salesOrdersTable).where(and(sql`${salesOrdersTable.status} NOT IN ('cancelled')`, gte(salesOrdersTable.createdAt, range.start), lte(salesOrdersTable.createdAt, range.end))),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(productsTable).where(and(eq(productsTable.active, "true"), sql`${productsTable.currentStock} <= ${productsTable.minStock}`)),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(purchaseOrdersTable).where(sql`${purchaseOrdersTable.status} IN ('draft', 'sent')`),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(employeesTable).where(eq(employeesTable.status, "active")),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(projectsTable).where(eq(projectsTable.status, "active")),
  ]);

  const revenueTotal = revenueRow[0]?.total ?? "0";
  const expenseTotal = expenseRow[0]?.total ?? "0";
  const netBalance = (parseFloat(revenueTotal) - parseFloat(expenseTotal)).toFixed(2);
  const revCur = parseFloat(revenueTotal);
  const expCur = parseFloat(expenseTotal);
  const revPrev = parseFloat(revenuePrevRow[0]?.total ?? "0");
  const expPrev = parseFloat(expensePrevRow[0]?.total ?? "0");
  const net = parseFloat(netBalance);

  const trend12Start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [revTrend, expTrend] = await Promise.all([
    db.select({
      year: sql<number>`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})::int`,
      month: sql<number>`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})::int`,
      total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text`,
    }).from(financialEntriesTable)
      .where(and(eq(financialEntriesTable.type, "income"), eq(financialEntriesTable.status, "paid"), gte(financialEntriesTable.paidAt, trend12Start)))
      .groupBy(sql`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})`, sql`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})`),
    db.select({
      year: sql<number>`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})::int`,
      month: sql<number>`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})::int`,
      total: sql<string>`COALESCE(SUM(${financialEntriesTable.amount}), 0)::text`,
    }).from(financialEntriesTable)
      .where(and(eq(financialEntriesTable.type, "expense"), eq(financialEntriesTable.status, "paid"), gte(financialEntriesTable.paidAt, trend12Start)))
      .groupBy(sql`EXTRACT(YEAR FROM ${financialEntriesTable.paidAt})`, sql`EXTRACT(MONTH FROM ${financialEntriesTable.paidAt})`),
  ]);

  const revMap = new Map(revTrend.map((r) => [`${r.year}-${r.month}`, parseFloat(r.total)]));
  const expMap = new Map(expTrend.map((r) => [`${r.year}-${r.month}`, parseFloat(r.total)]));

  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${m}`;
    return {
      label: `${MONTH_LABELS[m - 1]}/${String(y).slice(2)}`,
      revenue: revMap.get(key) ?? 0,
      expense: expMap.get(key) ?? 0,
    };
  });

  const topClientRows = await db
    .select({
      clientName: clientsTable.name,
      totalRevenue: sql<string>`COALESCE(SUM(${salesOrdersTable.totalAmount}), 0)::text`,
      orderCount: sql<number>`COUNT(${salesOrdersTable.id})::int`,
    })
    .from(salesOrdersTable)
    .innerJoin(clientsTable, eq(salesOrdersTable.clientId, clientsTable.id))
    .where(and(sql`${salesOrdersTable.status} IN ('confirmed', 'delivered')`, gte(salesOrdersTable.createdAt, range.start), lte(salesOrdersTable.createdAt, range.end)))
    .groupBy(clientsTable.id, clientsTable.name)
    .orderBy(desc(sql`SUM(${salesOrdersTable.totalAmount})`))
    .limit(5);

  const topProductRows = await db
    .select({
      productName: productsTable.name,
      movementCount: sql<number>`COUNT(${stockMovementsTable.id})::int`,
    })
    .from(stockMovementsTable)
    .innerJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .where(and(gte(stockMovementsTable.createdAt, range.start), lte(stockMovementsTable.createdAt, range.end)))
    .groupBy(productsTable.id, productsTable.name)
    .orderBy(desc(sql`COUNT(${stockMovementsTable.id})`))
    .limit(5);

  // ── Build PDF ──────────────────────────────────────────────────────────────

  const generatedAt = now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", reject);

    // ── Content area helpers ─────────────────────────────────────────────────

    const contentTop = includeHeader ? HEADER_H + 16 : MARGIN;
    const contentBottom = (doc.page.height as number) - (includeHeader ? FOOTER_H + 16 : MARGIN);

    let y = contentTop;

    function checkPageBreak(neededHeight: number) {
      if (y + neededHeight > contentBottom) {
        doc.addPage();
        y = contentTop;
      }
    }

    function sectionTitle(title: string) {
      checkPageBreak(34);
      y += 6;
      doc.rect(MARGIN, y, CONTENT_W, 24).fill(CLR_ACCENT);
      doc.rect(MARGIN, y, 4, 24).fill(CLR_BLUE);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(CLR_BLUE)
        .text(title.toUpperCase(), MARGIN + 12, y + 7, { width: CONTENT_W - 12 });
      y += 30;
    }

    function tableHeader(cols: Array<{ label: string; x: number; w: number; align?: "left" | "right" | "center" }>) {
      const ROW_H = 20;
      doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(CLR_BLUE);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(CLR_WHITE);
      for (const col of cols) {
        doc.text(col.label, col.x, y + 6, { width: col.w, align: col.align ?? "left" });
      }
      y += ROW_H;
    }

    function tableRow(
      cols: Array<{ value: string; x: number; w: number; align?: "left" | "right" | "center"; color?: string }>,
      isEven: boolean,
    ) {
      const ROW_H = 18;
      checkPageBreak(ROW_H);
      if (isEven) doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(CLR_ROW_ALT);
      doc.fontSize(9).font("Helvetica").fillColor(CLR_TEXT);
      for (const col of cols) {
        doc.fillColor(col.color ?? CLR_TEXT)
          .text(col.value, col.x, y + 5, { width: col.w, align: col.align ?? "left" });
      }
      y += ROW_H;
    }

    function kpiBox(x: number, bY: number, label: string, value: string, sub: string, accentColor: string) {
      const W = (CONTENT_W - 8) / 2;
      const H = 52;
      doc.rect(x, bY, W, H).fill(CLR_WHITE).stroke(CLR_BORDER);
      doc.rect(x, bY, W, 3).fill(accentColor);
      doc.fontSize(7.5).font("Helvetica").fillColor(CLR_MUTED).text(label.toUpperCase(), x + 10, bY + 10, { width: W - 20 });
      doc.fontSize(15).font("Helvetica-Bold").fillColor(CLR_TEXT).text(value, x + 10, bY + 20, { width: W - 20 });
      doc.fontSize(7.5).font("Helvetica").fillColor(CLR_MUTED).text(sub, x + 10, bY + 39, { width: W - 20 });
      return H;
    }

    // ── Bar chart helper ──────────────────────────────────────────────────────

    function drawBarChart(data: Array<{ label: string; revenue: number; expense: number }>, chartY: number) {
      const CHART_H = 90;
      const CHART_W = CONTENT_W;
      const barGroupW = CHART_W / data.length;
      const BAR_W = Math.min(18, barGroupW * 0.35);
      const maxVal = Math.max(...data.flatMap((d) => [d.revenue, d.expense]), 1);
      const SCALE = (CHART_H - 20) / maxVal;

      doc.rect(MARGIN, chartY, CHART_W, CHART_H).fill("#f8fafc").stroke(CLR_BORDER);

      data.forEach((d, i) => {
        const groupX = MARGIN + i * barGroupW + barGroupW / 2;

        const revH = Math.max(2, d.revenue * SCALE);
        const expH = Math.max(2, d.expense * SCALE);

        doc.rect(groupX - BAR_W - 1, chartY + CHART_H - 14 - revH, BAR_W, revH).fill(CLR_BLUE_MID);
        doc.rect(groupX + 1, chartY + CHART_H - 14 - expH, BAR_W, expH).fill(CLR_RED);

        doc.fontSize(6.5).font("Helvetica").fillColor(CLR_MUTED)
          .text(d.label, groupX - barGroupW / 2, chartY + CHART_H - 12, { width: barGroupW, align: "center" });
      });

      const legendX = MARGIN + CHART_W - 140;
      const legendY = chartY + 6;
      doc.rect(legendX, legendY, 8, 8).fill(CLR_BLUE_MID);
      doc.fontSize(7).font("Helvetica").fillColor(CLR_MUTED).text("Receita", legendX + 11, legendY + 1);
      doc.rect(legendX + 60, legendY, 8, 8).fill(CLR_RED);
      doc.fontSize(7).font("Helvetica").fillColor(CLR_MUTED).text("Despesas", legendX + 71, legendY + 1);

      return CHART_H + 8;
    }

    // ── Page 1 content ────────────────────────────────────────────────────────

    const col1X = MARGIN;
    const col2X = MARGIN + (CONTENT_W - 8) / 2 + 8;
    const BOX_H = 52;

    // KPI 2-column grid — financial
    if (inc("financeiro")) {
      sectionTitle("Indicadores Financeiros");

      checkPageBreak(BOX_H * 2 + 16);
      kpiBox(col1X, y, "Receita do Período", fmtBRL(revenueTotal), `vs. ant.: ${pctChange(revCur, revPrev)}`, CLR_GREEN);
      kpiBox(col2X, y, "Despesas do Período", fmtBRL(expenseTotal), `vs. ant.: ${pctChange(expCur, expPrev)}`, CLR_RED);
      y += BOX_H + 8;

      const netColor = net >= 0 ? CLR_GREEN : CLR_RED;
      const netLabel = net >= 0 ? "▲ Resultado Positivo" : "▼ Resultado Negativo";
      kpiBox(col1X, y, "Saldo Líquido (Receita – Despesas)", fmtBRL(netBalance), netLabel, netColor);
      y += BOX_H + 14;

      // Trend chart
      sectionTitle("Tendência Financeira — Últimos 6 Meses");
      checkPageBreak(110);
      const chartH = drawBarChart(monthlyTrend, y);
      y += chartH + 6;
    }

    // KPI grid — operational (filter by active modules)
    const opKpis = [
      ...(inc("vendas") ? [
        { label: "Pedidos em Aberto (backlog)", value: String(openSalesRow[0]?.count ?? 0), sub: "status: rascunho ou confirmado", color: CLR_BLUE_MID },
        { label: "Novos Pedidos no Período", value: String(newSalesRow[0]?.count ?? 0), sub: "excluindo cancelados", color: CLR_BLUE },
      ] : []),
      ...(inc("estoque") ? [
        { label: "Produtos com Estoque Baixo", value: String(lowStockRow[0]?.count ?? 0), sub: "abaixo do estoque mínimo", color: lowStockRow[0]?.count ? CLR_AMBER : CLR_GREEN },
      ] : []),
      ...(inc("compras") ? [
        { label: "Compras Pendentes", value: String(pendingPurchaseRow[0]?.count ?? 0), sub: "rascunho ou enviado", color: CLR_AMBER },
      ] : []),
      ...(inc("rh") ? [
        { label: "Funcionários Ativos", value: String(activeEmployeesRow[0]?.count ?? 0), sub: "colaboradores em atividade", color: CLR_BLUE_MID },
      ] : []),
      ...(inc("projetos") ? [
        { label: "Projetos Ativos", value: String(activeProjectsRow[0]?.count ?? 0), sub: "projetos em andamento", color: CLR_BLUE },
      ] : []),
    ];

    if (opKpis.length > 0) {
      sectionTitle("Indicadores Operacionais");
      for (let i = 0; i < opKpis.length; i += 2) {
        checkPageBreak(BOX_H + 8);
        const left = opKpis[i];
        const right = opKpis[i + 1];
        kpiBox(col1X, y, left.label, left.value, left.sub, left.color);
        if (right) {
          kpiBox(col2X, y, right.label, right.value, right.sub, right.color);
        }
        y += BOX_H + 8;
      }
      y += 6;
    }

    // Top 5 Clients table
    if (inc("vendas") && topClientRows.length > 0) {
      sectionTitle("Top 5 Clientes por Receita no Período");

      const colNo   = { label: "#",        x: MARGIN,       w: 22,                  align: "center" as const };
      const colName = { label: "CLIENTE",   x: MARGIN + 26,  w: CONTENT_W - 26 - 100 - 60, align: "left" as const };
      const colOrds = { label: "PEDIDOS",   x: MARGIN + CONTENT_W - 100 - 60, w: 55, align: "center" as const };
      const colRev  = { label: "RECEITA",   x: MARGIN + CONTENT_W - 100,      w: 95, align: "right" as const };

      checkPageBreak(20 + topClientRows.length * 18 + 8);
      tableHeader([colNo, colName, colOrds, colRev]);

      topClientRows.forEach((c, i) => {
        tableRow([
          { value: String(i + 1), x: colNo.x, w: colNo.w, align: "center" },
          { value: c.clientName,  x: colName.x, w: colName.w },
          { value: String(c.orderCount), x: colOrds.x, w: colOrds.w, align: "center" },
          { value: fmtBRL(c.totalRevenue), x: colRev.x, w: colRev.w, align: "right",
            color: CLR_GREEN },
        ], i % 2 === 1);
      });

      y += 8;
    }

    // Top 5 Products table
    if (inc("estoque") && topProductRows.length > 0) {
      sectionTitle("Top 5 Produtos por Movimentação no Período");

      const colNo   = { label: "#",             x: MARGIN,      w: 22,              align: "center" as const };
      const colProd = { label: "PRODUTO",        x: MARGIN + 26, w: CONTENT_W - 26 - 100, align: "left" as const };
      const colMov  = { label: "MOVIMENTAÇÕES",  x: MARGIN + CONTENT_W - 95,        w: 90, align: "right" as const };

      checkPageBreak(20 + topProductRows.length * 18 + 8);
      tableHeader([colNo, colProd, colMov]);

      topProductRows.forEach((p, i) => {
        tableRow([
          { value: String(i + 1),    x: colNo.x,   w: colNo.w,   align: "center" },
          { value: p.productName,    x: colProd.x, w: colProd.w },
          { value: String(p.movementCount), x: colMov.x, w: colMov.w, align: "right" },
        ], i % 2 === 1);
      });
    }

    // ── Draw header + footer on every buffered page ───────────────────────────

    const pageRange = doc.bufferedPageRange();
    const totalPages = pageRange.count;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const pageH = doc.page.height as number;
      const pageNum = i + 1;

      if (includeHeader) {
        // ── Header background ──────────────────────────────────────────────
        doc.rect(0, 0, PAGE_W, HEADER_H).fill(CLR_BLUE);

        // Subtle diagonal accent
        doc.save();
        doc.rect(0, 0, PAGE_W, HEADER_H).clip();
        for (let k = 0; k < 5; k++) {
          doc.moveTo(PAGE_W - 60 + k * 30, 0).lineTo(PAGE_W + k * 30, HEADER_H)
            .strokeColor("rgba(255,255,255,0.04)").lineWidth(18).stroke();
        }
        doc.restore();

        // ── Logo ───────────────────────────────────────────────────────────
        let xCursor = MARGIN;
        const logoSize = 42;
        const logoTop  = (HEADER_H - logoSize) / 2;

        if (logoBuffer) {
          try {
            doc.image(logoBuffer, xCursor, logoTop, {
              width: logoSize,
              height: logoSize,
              fit: [logoSize, logoSize],
            });
            xCursor += logoSize + 12;
          } catch {
            // skip logo if invalid
          }
        } else {
          // Default "N" monogram placeholder
          doc.rect(xCursor, logoTop, logoSize, logoSize).fillAndStroke("#1d4ed8", "rgba(255,255,255,0.2)");
          doc.fontSize(20).font("Helvetica-Bold").fillColor(CLR_WHITE)
            .text("N", xCursor, logoTop + 10, { width: logoSize, align: "center" });
          xCursor += logoSize + 12;
        }

        // ── Company name + subtitle ────────────────────────────────────────
        const nameBlockY = (HEADER_H - 28) / 2;
        doc.fontSize(16).font("Helvetica-Bold").fillColor(CLR_WHITE)
          .text(companyName, xCursor, nameBlockY, { width: 260 });
        doc.fontSize(9).font("Helvetica").fillColor("rgba(255,255,255,0.75)")
          .text("Relatório Executivo", xCursor, nameBlockY + 19, { width: 260 });

        // ── Period + date (right side) ─────────────────────────────────────
        const rightX = PAGE_W - MARGIN - 150;
        doc.fontSize(9).font("Helvetica-Bold").fillColor(CLR_WHITE)
          .text(`Período: ${range.label}`, rightX, (HEADER_H / 2) - 10, { width: 150, align: "right" });
        doc.fontSize(7.5).font("Helvetica").fillColor("rgba(255,255,255,0.70)")
          .text(`Gerado em ${generatedAt}`, rightX, (HEADER_H / 2) + 3, { width: 150, align: "right" });

        // ── Footer ────────────────────────────────────────────────────────
        const footerTop = pageH - FOOTER_H;

        doc.rect(0, footerTop, PAGE_W, FOOTER_H).fill("#f8fafc");
        doc.moveTo(0, footerTop).lineTo(PAGE_W, footerTop).strokeColor(CLR_BORDER).lineWidth(0.5).stroke();

        const footerTextY = footerTop + (FOOTER_H - 8) / 2;
        doc.fontSize(7).font("Helvetica").fillColor(CLR_MUTED)
          .text(`${companyName} — Documento confidencial`, MARGIN, footerTextY, { width: 220 });

        doc.fontSize(7).font("Helvetica").fillColor(CLR_MUTED)
          .text(`Período: ${range.label}`, 0, footerTextY, { width: PAGE_W, align: "center" });

        const pgText = `Página ${pageNum} de ${totalPages}`;
        const pgW = doc.widthOfString(pgText);
        doc.fontSize(7).font("Helvetica-Bold").fillColor(CLR_BLUE)
          .text(pgText, PAGE_W - MARGIN - pgW - 4, footerTextY, { width: pgW + 4, align: "right" });
      }
    }

    doc.flushPages();
    doc.end();

    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
