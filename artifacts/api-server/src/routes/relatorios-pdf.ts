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

export async function buildReportPdf(period: Period): Promise<Buffer> {
  const range = getDateRange(period);
  const prevRange = getPreviousPeriodRange(period, range);
  const now = new Date();

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

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const blue = "#2563eb";
    const gray = "#6b7280";
    const lightGray = "#f3f4f6";
    const green = "#059669";
    const red = "#dc2626";

    doc.rect(0, 0, doc.page.width, 70).fill(blue);
    doc.fillColor("white").fontSize(20).font("Helvetica-Bold")
      .text("NEXUS ERP — Relatório Executivo", 50, 22);
    doc.fontSize(10).font("Helvetica")
      .text(`Período: ${range.label}  |  Gerado em: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, 50, 48);

    doc.fillColor("#1f2937");
    let y = 90;

    function sectionTitle(title: string) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor(blue).text(title, 50, y);
      y += 18;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e5e7eb").lineWidth(1).stroke();
      y += 8;
    }

    function kpiRow(label: string, value: string, sub?: string) {
      doc.fontSize(9).font("Helvetica").fillColor(gray).text(label, 50, y, { width: 200 });
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1f2937").text(value, 260, y, { width: 200 });
      if (sub) {
        doc.fontSize(9).font("Helvetica").fillColor(gray).text(sub, 460, y, { width: 85 });
      }
      y += 18;
    }

    sectionTitle("Indicadores Financeiros");
    const revPrev = parseFloat(revenuePrevRow[0]?.total ?? "0");
    const expPrev = parseFloat(expensePrevRow[0]?.total ?? "0");
    const revCur = parseFloat(revenueTotal);
    const expCur = parseFloat(expenseTotal);

    const revChg = revPrev > 0 ? ((revCur - revPrev) / revPrev * 100).toFixed(1) + "%" : "—";
    const expChg = expPrev > 0 ? ((expCur - expPrev) / expPrev * 100).toFixed(1) + "%" : "—";
    const net = parseFloat(netBalance);

    kpiRow("Receita (período)", fmtBRL(revenueTotal), `vs ant.: ${revChg}`);
    kpiRow("Despesas (período)", fmtBRL(expenseTotal), `vs ant.: ${expChg}`);
    kpiRow("Saldo Líquido", fmtBRL(netBalance));
    doc.fontSize(9).font("Helvetica").fillColor(net >= 0 ? green : red)
      .text(net >= 0 ? "▲ Positivo" : "▼ Negativo", 360, y - 18);

    y += 10;

    sectionTitle("Indicadores Operacionais");
    kpiRow("Pedidos Abertos (backlog)", String(openSalesRow[0]?.count ?? 0));
    kpiRow("Novos Pedidos no Período", String(newSalesRow[0]?.count ?? 0));
    kpiRow("Produtos com Estoque Baixo", String(lowStockRow[0]?.count ?? 0));
    kpiRow("Compras Pendentes", String(pendingPurchaseRow[0]?.count ?? 0));
    kpiRow("Funcionários Ativos", String(activeEmployeesRow[0]?.count ?? 0));
    kpiRow("Projetos Ativos", String(activeProjectsRow[0]?.count ?? 0));

    y += 10;

    if (topClientRows.length > 0) {
      sectionTitle("Top 5 Clientes por Receita");
      doc.rect(50, y, doc.page.width - 100, 16).fill(lightGray);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(gray);
      doc.text("#", 55, y + 4);
      doc.text("Cliente", 75, y + 4, { width: 220 });
      doc.text("Pedidos", 300, y + 4, { width: 80 });
      doc.text("Receita", 390, y + 4, { width: 110 });
      y += 16;

      topClientRows.forEach((c, i) => {
        if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 16).fill("#fafafa");
        doc.fontSize(9).font("Helvetica").fillColor("#1f2937");
        doc.text(String(i + 1), 55, y + 4);
        doc.text(c.clientName, 75, y + 4, { width: 220 });
        doc.text(String(c.orderCount), 300, y + 4, { width: 80 });
        doc.text(fmtBRL(c.totalRevenue), 390, y + 4, { width: 110 });
        y += 16;
      });
      y += 8;
    }

    if (topProductRows.length > 0) {
      if (y > 650) { doc.addPage(); y = 50; }
      sectionTitle("Top 5 Produtos por Movimentação");
      doc.rect(50, y, doc.page.width - 100, 16).fill(lightGray);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(gray);
      doc.text("#", 55, y + 4);
      doc.text("Produto", 75, y + 4, { width: 350 });
      doc.text("Movimentações", 430, y + 4, { width: 100 });
      y += 16;

      topProductRows.forEach((p, i) => {
        if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 16).fill("#fafafa");
        doc.fontSize(9).font("Helvetica").fillColor("#1f2937");
        doc.text(String(i + 1), 55, y + 4);
        doc.text(p.productName, 75, y + 4, { width: 350 });
        doc.text(String(p.movementCount), 430, y + 4, { width: 100 });
        y += 16;
      });
    }

    doc.fontSize(8).font("Helvetica").fillColor(gray)
      .text("Gerado automaticamente pelo NEXUS ERP — uso interno", 50, doc.page.height - 40, { align: "center", width: doc.page.width - 100 });

    doc.end();
  });
}
