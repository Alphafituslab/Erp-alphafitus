/**
 * Seed script — dados de demonstração para todos os módulos do ERP NEXUS.
 *
 * Cadeia de rastreabilidade completa:
 *   Lote MP → Consumo em OP → Lote PA → Pedido de Venda → NF-e
 *
 * Execute: pnpm --filter @workspace/db run seed
 * Seguro para re-executar: apaga dados anteriores antes de re-inserir.
 */

import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── cleanup (reverse FK order, preserves users) ──────────────────────────────

async function cleanup() {
  console.log("🧹  Limpando dados anteriores...");
  await db.delete(schema.capaEvidencesTable);
  await db.delete(schema.capaActionsTable);
  await db.delete(schema.qualityCertificatesTable);
  await db.delete(schema.analysisParametersTable);
  await db.delete(schema.qualityAnalysesTable);
  await db.delete(schema.qualityNcrsTable);
  await db.delete(schema.qualityInspectionsTable);
  await db.delete(schema.apsScheduleTable);
  await db.delete(schema.productionShiftsTable);
  await db.delete(schema.workCentersTable);
  await db.delete(schema.productionMaterialConsumptionsTable);
  await db.delete(schema.productionStagesTable);
  await db.delete(schema.productionOrdersTable);
  await db.delete(schema.formulaItemsTable);
  await db.delete(schema.formulasTable);
  await db.delete(schema.lotMovementsTable);
  await db.delete(schema.productLotsTable);
  await db.delete(schema.warehousesTable);
  await db.delete(schema.salesOrderLogsTable);
  await db.delete(schema.salesOrderItemsTable);
  await db.delete(schema.salesOrdersTable);
  await db.delete(schema.purchaseOrderItemsTable);
  await db.delete(schema.purchaseOrdersTable);
  await db.delete(schema.quotationItemsTable);
  await db.delete(schema.quotationsTable);
  await db.delete(schema.purchaseRequestsTable);
  await db.delete(schema.stockMovementsTable);
  await db.delete(schema.financialEntriesTable);
  await db.delete(schema.fiscalDocumentsTable);
  await db.delete(schema.projectTasksTable);
  await db.delete(schema.projectsTable);
  await db.delete(schema.employeeTrainingsTable);
  await db.delete(schema.trainingsTable);
  await db.delete(schema.attendanceLogsTable);
  await db.delete(schema.employeesTable);
  await db.delete(schema.departmentsTable);
  await db.delete(schema.productsTable);
  await db.delete(schema.clientsTable);
  await db.delete(schema.suppliersTable);
  await db.delete(schema.dashboardGoalsTable);
  // usersTable is intentionally preserved — system users must survive re-seed
}

// ─── main ─────────────────────────────────────────────────────────────────────

export async function seed() {
  console.log("🌱  Iniciando seed do banco de dados...\n");

  await cleanup();

  // ── 1. USERS ────────────────────────────────────────────────────────────────
  console.log("👤  Inserindo usuários...");
  const passwordHash = await bcrypt.hash("Admin@2025", 10);

  const [admin] = await db
    .insert(schema.usersTable)
    .values([
      {
        name: "Administrador",
        email: "admin@empresa.com.br",
        passwordHash,
        role: "admin",
        active: "true",
      },
      {
        name: "João Silva",
        email: "joao@empresa.com.br",
        passwordHash,
        role: "employee",
        active: "true",
      },
      {
        name: "Carla Mendes",
        email: "carla@empresa.com.br",
        passwordHash,
        role: "manager",
        active: "true",
      },
    ])
    .onConflictDoNothing()
    .returning();

  // ── 2. DEPARTMENTS ──────────────────────────────────────────────────────────
  console.log("🏢  Inserindo departamentos...");
  const [deptProd, deptQual, deptComercial, deptAdmin] = await db
    .insert(schema.departmentsTable)
    .values([
      { name: "Produção", description: "Operações de fabricação e manufatura" },
      { name: "Controle de Qualidade", description: "Análises, inspeções e CAPA" },
      { name: "Comercial", description: "Vendas e atendimento ao cliente" },
      { name: "Administração", description: "Financeiro, compras e RH" },
    ])
    .onConflictDoNothing()
    .returning();

  // ── 3. EMPLOYEES ────────────────────────────────────────────────────────────
  console.log("👷  Inserindo funcionários...");
  const [empMaria, empCarlos, empAna, empRoberto, empFernanda] = await db
    .insert(schema.employeesTable)
    .values([
      {
        name: "Maria Santos",
        cpf: "123.456.789-01",
        email: "maria.santos@empresa.com.br",
        phone: "(11) 91234-5678",
        role: "Supervisora de Produção",
        department: deptProd?.name ?? "Produção",
        hireDate: daysAgo(730),
        salary: "5800.00",
        status: "active",
      },
      {
        name: "Carlos Ferreira",
        cpf: "234.567.890-12",
        email: "carlos.ferreira@empresa.com.br",
        phone: "(11) 92345-6789",
        role: "Operador de Produção",
        department: deptProd?.name ?? "Produção",
        hireDate: daysAgo(540),
        salary: "3200.00",
        status: "active",
      },
      {
        name: "Ana Lima",
        cpf: "345.678.901-23",
        email: "ana.lima@empresa.com.br",
        phone: "(11) 93456-7890",
        role: "Analista de Qualidade",
        department: deptQual?.name ?? "Controle de Qualidade",
        hireDate: daysAgo(365),
        salary: "4500.00",
        status: "active",
      },
      {
        name: "Roberto Costa",
        cpf: "456.789.012-34",
        email: "roberto.costa@empresa.com.br",
        phone: "(11) 94567-8901",
        role: "Comprador",
        department: deptAdmin?.name ?? "Administração",
        hireDate: daysAgo(910),
        salary: "4200.00",
        status: "active",
      },
      {
        name: "Fernanda Oliveira",
        cpf: "567.890.123-45",
        email: "fernanda.oliveira@empresa.com.br",
        phone: "(11) 95678-9012",
        role: "Executiva de Vendas",
        department: deptComercial?.name ?? "Comercial",
        hireDate: daysAgo(480),
        salary: "3800.00",
        status: "active",
      },
    ])
    .onConflictDoNothing()
    .returning();

  // ── 4. ATTENDANCE LOGS ──────────────────────────────────────────────────────
  console.log("📅  Inserindo registros de ponto...");
  const employees = [empMaria, empCarlos, empAna, empRoberto, empFernanda].filter(Boolean);
  const attendanceRows: schema.InsertAttendanceLog[] = [];
  for (const emp of employees) {
    if (!emp) continue;
    for (let i = 1; i <= 10; i++) {
      const d = daysAgo(i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      attendanceRows.push({
        employeeId: String(emp.id),
        date: isoDate(d),
        checkIn: "08:00",
        checkOut: "17:00",
        status: i === 3 ? "late" : "present",
        notes: i === 3 ? "Atraso por transporte" : undefined,
      });
    }
  }
  if (attendanceRows.length > 0) {
    await db.insert(schema.attendanceLogsTable).values(attendanceRows).onConflictDoNothing();
  }

  // ── 5. TRAININGS ────────────────────────────────────────────────────────────
  console.log("📚  Inserindo treinamentos...");
  const [trainBPF, trainNR12, trainISO] = await db
    .insert(schema.trainingsTable)
    .values([
      {
        name: "Boas Práticas de Fabricação (BPF)",
        description: "Treinamento obrigatório em BPF conforme RDC 658/2022",
        type: "mandatory",
        validityMonths: 12,
        durationHours: 8,
        targetRole: null,
      },
      {
        name: "NR-12 — Segurança em Máquinas",
        description: "Norma regulamentadora de segurança em máquinas e equipamentos",
        type: "mandatory",
        validityMonths: 24,
        durationHours: 16,
        targetRole: "Operador de Produção",
      },
      {
        name: "ISO 9001 — Sistemas de Gestão da Qualidade",
        description: "Conscientização sobre os requisitos da ISO 9001:2015",
        type: "optional",
        validityMonths: null,
        durationHours: 4,
        targetRole: null,
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (trainBPF && empMaria) {
    await db.insert(schema.employeeTrainingsTable).values([
      {
        employeeId: empMaria.id,
        trainingId: trainBPF.id,
        completedAt: daysAgo(180),
        expiresAt: daysFromNow(185),
        status: "up_to_date",
        notes: "Certificado emitido pela ANVISA",
      },
      ...(trainNR12 && empCarlos ? [{
        employeeId: empCarlos.id,
        trainingId: trainNR12.id,
        completedAt: daysAgo(400),
        expiresAt: daysAgo(40),
        status: "expired" as const,
        notes: "Renovação pendente",
      }] : []),
      ...(trainISO && empAna ? [{
        employeeId: empAna.id,
        trainingId: trainISO.id,
        completedAt: daysAgo(90),
        expiresAt: undefined,
        status: "up_to_date" as const,
        notes: "Concluído na auditoria interna",
      }] : []),
    ]).onConflictDoNothing();
  }

  // ── 6. CLIENTS ──────────────────────────────────────────────────────────────
  console.log("🤝  Inserindo clientes...");
  const [client1, client2, client3] = await db
    .insert(schema.clientsTable)
    .values([
      {
        name: "Farmácia Central SP Ltda",
        document: "12.345.678/0001-90",
        email: "compras@farmaciacentral.com.br",
        phone: "(11) 3456-7890",
        address: "Av. Paulista, 1500, Sala 801",
        city: "São Paulo",
        state: "SP",
        notes: "Cliente VIP — pagamento a prazo 30/60/90",
        active: "true",
      },
      {
        name: "Distribuidora MedFar S.A.",
        document: "23.456.789/0001-01",
        email: "pedidos@medfar.com.br",
        phone: "(11) 4567-8901",
        address: "Rua das Indústrias, 250",
        city: "Guarulhos",
        state: "SP",
        notes: "Distribuidora regional — grande volume",
        active: "true",
      },
      {
        name: "Grupo Saúde & Vida",
        document: "34.567.890/0001-12",
        email: "suprimentos@saudevida.com.br",
        phone: "(21) 5678-9012",
        address: "Rua do Comércio, 750",
        city: "Rio de Janeiro",
        state: "RJ",
        notes: "Rede de farmácias",
        active: "true",
      },
    ])
    .onConflictDoNothing()
    .returning();

  // ── 7. SUPPLIERS ────────────────────────────────────────────────────────────
  console.log("🏭  Inserindo fornecedores...");
  const [supQuimica, supEmbalagem, supVitaminex] = await db
    .insert(schema.suppliersTable)
    .values([
      {
        name: "Química Brasil Importação Ltda",
        document: "45.678.901/0001-23",
        email: "vendas@quimicabrasil.com.br",
        phone: "(11) 2345-6789",
        street: "Rod. Anchieta, km 12",
        city: "São Bernardo do Campo",
        state: "SP",
        category: "Matéria-Prima",
        paymentTerms: "28 DDL",
        notes: "Fornecedor homologado ANVISA — IFA importados",
        active: "true",
        approvalStatus: "approved",
      },
      {
        name: "TopPack Embalagens S.A.",
        document: "56.789.012/0001-34",
        email: "comercial@toppack.com.br",
        phone: "(19) 3456-7890",
        street: "Dist. Industrial, Q.5 L.10",
        city: "Campinas",
        state: "SP",
        category: "Embalagens",
        paymentTerms: "21 DDL",
        notes: "Frascos e tampas PET farmacêutico",
        active: "true",
        approvalStatus: "approved",
      },
      {
        name: "Vitaminex Ingredientes",
        document: "67.890.123/0001-45",
        email: "vendas@vitaminex.com.br",
        phone: "(11) 6789-0123",
        street: "Rua Lab, 300",
        city: "Santo André",
        state: "SP",
        category: "Matéria-Prima",
        paymentTerms: "30 DDL",
        notes: "Vitaminas e minerais grau farmacêutico",
        active: "true",
        approvalStatus: "approved",
      },
    ])
    .onConflictDoNothing()
    .returning();

  // ── 8. PRODUCTS ─────────────────────────────────────────────────────────────
  console.log("📦  Inserindo produtos...");
  const [pAA, pMD, pVD, pEMB, pVCA, pCVD] = await db
    .insert(schema.productsTable)
    .values([
      {
        sku: "MP-AA-001",
        name: "Ácido Ascórbico USP",
        description: "Vitamina C em pó, grau farmacêutico, pureza ≥99%",
        category: "Matéria-Prima",
        unit: "kg",
        costPrice: "45.00",
        salePrice: null,
        currentStock: "695.000",
        minStock: 100,
        isCritical: "true",
        active: "true",
      },
      {
        sku: "MP-MD-001",
        name: "Maltodextrina DE10",
        description: "Excipiente — maltodextrina dextrosa equivalente 10",
        category: "Matéria-Prima",
        unit: "kg",
        costPrice: "8.50",
        salePrice: null,
        currentStock: "620.000",
        minStock: 200,
        isCritical: "false",
        active: "true",
      },
      {
        sku: "MP-VD-001",
        name: "Vitamina D3 (Colecalciferol) 100.000 UI/g",
        description: "Cholecalciferol em pó, grau farmacêutico",
        category: "Matéria-Prima",
        unit: "g",
        costPrice: "185.00",
        salePrice: null,
        currentStock: "15.000",
        minStock: 10,
        isCritical: "true",
        active: "true",
      },
      {
        sku: "MP-EMB-001",
        name: "Frasco PET 500mL Âmbar",
        description: "Embalagem primária para sólidos orais",
        category: "Embalagem",
        unit: "un",
        costPrice: "0.85",
        salePrice: null,
        currentStock: "1850.000",
        minStock: 500,
        isCritical: "false",
        active: "true",
      },
      {
        sku: "PA-VCA-001",
        name: "Vitamina C 500mg — 60 Comprimidos",
        description: "Vitamina C 500mg — embalagem hospitalar 60 comprimidos",
        category: "Produto Acabado",
        unit: "cx",
        costPrice: "8.20",
        salePrice: "18.50",
        currentStock: "920.000",
        minStock: 200,
        isCritical: "false",
        active: "true",
      },
      {
        sku: "PA-CVD-001",
        name: "Complexo Vitamínico D — 30 Cápsulas",
        description: "Vitaminas C + D3 em cápsulas gelatinosas moles",
        category: "Produto Acabado",
        unit: "cx",
        costPrice: "12.40",
        salePrice: "24.00",
        currentStock: "480.000",
        minStock: 100,
        isCritical: "false",
        active: "true",
      },
    ])
    .onConflictDoNothing()
    .returning();

  // ── 9. WAREHOUSES ───────────────────────────────────────────────────────────
  console.log("🏗️   Inserindo depósitos...");
  const [wMP, wPA, wProd] = await db
    .insert(schema.warehousesTable)
    .values([
      { name: "Almoxarifado Matéria-Prima", code: "ALM-MP", description: "Armazenagem controlada de IFA e excipientes", active: "true" },
      { name: "Almoxarifado Produto Acabado", code: "ALM-PA", description: "Produtos acabados em quarentena e aprovados", active: "true" },
      { name: "Linha de Produção", code: "PROD", description: "Área de pesagem, mistura e envase", active: "true" },
    ])
    .onConflictDoNothing()
    .returning();

  // ── 10. PRODUCT LOTS (MP) ───────────────────────────────────────────────────
  console.log("🏷️   Inserindo lotes de matéria-prima...");
  const mpLots = await db
    .insert(schema.productLotsTable)
    .values([
      {
        productId: pAA!.id,
        internalLot: "LOT-AA-2024-001",
        supplierLot: "QB-2024-0451",
        warehouseId: wMP?.id,
        manufacturingDate: isoDate(daysAgo(90)),
        expirationDate: isoDate(daysFromNow(640)),
        cqStatus: "approved",
        totalQty: "500.000",
        availableQty: "395.000",
        reservedQty: "0.000",
        blockedQty: "0.000",
        notes: "Lote aprovado pelo CQ em " + isoDate(daysAgo(85)),
      },
      {
        productId: pAA!.id,
        internalLot: "LOT-AA-2024-002",
        supplierLot: "QB-2024-0612",
        warehouseId: wMP?.id,
        manufacturingDate: isoDate(daysAgo(30)),
        expirationDate: isoDate(daysFromNow(700)),
        cqStatus: "approved",
        totalQty: "300.000",
        availableQty: "300.000",
        reservedQty: "0.000",
        blockedQty: "0.000",
        notes: "Lote aprovado pelo CQ",
      },
      {
        productId: pMD!.id,
        internalLot: "LOT-MD-2024-001",
        supplierLot: "QB-2024-0380",
        warehouseId: wMP?.id,
        manufacturingDate: isoDate(daysAgo(60)),
        expirationDate: isoDate(daysFromNow(730)),
        cqStatus: "approved",
        totalQty: "800.000",
        availableQty: "710.000",
        reservedQty: "0.000",
        blockedQty: "0.000",
        notes: "Lote liberado — teor DE10 confirmado",
      },
      {
        productId: pVD!.id,
        internalLot: "LOT-VD-2024-001",
        supplierLot: "VX-2024-0089",
        warehouseId: wMP?.id,
        manufacturingDate: isoDate(daysAgo(45)),
        expirationDate: isoDate(daysFromNow(680)),
        cqStatus: "approved",
        totalQty: "50.000",
        availableQty: "15.000",
        reservedQty: "0.000",
        blockedQty: "0.000",
        notes: "IFA controlado — armazenar 2–8°C",
      },
      {
        productId: pEMB!.id,
        internalLot: "LOT-EMB-2024-001",
        supplierLot: "TP-2024-1101",
        warehouseId: wMP?.id,
        manufacturingDate: isoDate(daysAgo(20)),
        expirationDate: isoDate(daysFromNow(1800)),
        cqStatus: "approved",
        totalQty: "2000.000",
        availableQty: "1850.000",
        reservedQty: "0.000",
        blockedQty: "0.000",
        notes: "Dimensões conferidas e aprovadas",
      },
    ])
    .onConflictDoNothing()
    .returning();

  const [lotAA1, lotAA2, lotMD1, lotVD1, lotEMB1] = mpLots;

  // ── 11. LOT MOVEMENTS — recebimento de MP ───────────────────────────────────
  console.log("🔄  Inserindo movimentações de lote...");
  if (lotAA1 && pAA && wMP) {
    await db.insert(schema.lotMovementsTable).values([
      {
        lotId: lotAA1.id,
        productId: pAA.id,
        warehouseId: wMP.id,
        type: "input",
        quantity: "500.000",
        reason: "Recebimento NF",
        notes: "NF 000101 — PC-2024-001",
        referenceType: "purchase_order",
      },
      {
        lotId: lotAA2.id,
        productId: pAA.id,
        warehouseId: wMP.id,
        type: "input",
        quantity: "300.000",
        reason: "Recebimento NF",
        notes: "NF 000115 — PC-2024-002",
        referenceType: "purchase_order",
      },
    ]).onConflictDoNothing();
  }
  if (lotMD1 && pMD && wMP) {
    await db.insert(schema.lotMovementsTable).values({
      lotId: lotMD1.id,
      productId: pMD.id,
      warehouseId: wMP.id,
      type: "input",
      quantity: "800.000",
      reason: "Recebimento NF",
      notes: "NF 000102 — PC-2024-002",
      referenceType: "purchase_order",
    }).onConflictDoNothing();
  }
  if (lotEMB1 && pEMB && wMP) {
    await db.insert(schema.lotMovementsTable).values([
      {
        lotId: lotEMB1.id,
        productId: pEMB.id,
        warehouseId: wMP.id,
        type: "input",
        quantity: "2000.000",
        reason: "Recebimento NF",
        notes: "NF 000103 — PC-2024-003",
        referenceType: "purchase_order",
      },
      {
        lotId: lotEMB1.id,
        productId: pEMB.id,
        warehouseId: wMP.id,
        type: "output",
        quantity: "987.000",
        reason: "Consumo em envase",
        notes: "OP-2024-001 — etapa packaging",
        referenceType: "production_order",
      },
    ]).onConflictDoNothing();
  }

  // ── 12. FORMULAS ────────────────────────────────────────────────────────────
  console.log("🧪  Inserindo fórmulas...");
  const [form1, form2] = await db
    .insert(schema.formulasTable)
    .values([
      {
        productId: pVCA?.id ?? null,
        productName: "Vitamina C 500mg",
        version: "1.0",
        status: "approved",
        batchYield: "200.000",
        unit: "kg",
        notes: "Fórmula mestre aprovada ANVISA",
        approvedBy: "Ana Lima",
        approvedAt: daysAgo(120),
      },
      {
        productId: pCVD?.id ?? null,
        productName: "Complexo Vitamínico D",
        version: "1.0",
        status: "approved",
        batchYield: "150.000",
        unit: "kg",
        notes: "Fórmula aprovada para lançamento",
        approvedBy: "Ana Lima",
        approvedAt: daysAgo(60),
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (form1 && pAA && pMD && pVD) {
    await db.insert(schema.formulaItemsTable).values([
      {
        formulaId: form1.id,
        productId: pAA.id,
        productName: pAA.name,
        quantity: "0.5250",
        unit: "kg",
        function: "IFA principal",
        notes: "Ácido Ascórbico — 525g por kg de produto",
      },
      {
        formulaId: form1.id,
        productId: pMD.id,
        productName: pMD.name,
        quantity: "0.4500",
        unit: "kg",
        function: "Excipiente",
        notes: "Maltodextrina — 450g por kg de produto",
      },
      {
        formulaId: form1.id,
        productId: pVD.id,
        productName: pVD.name,
        quantity: "0.0250",
        unit: "g",
        function: "IFA secundário",
        notes: "Vitamina D3 — 25mg por kg de produto",
      },
    ]).onConflictDoNothing();
  }

  if (form2 && pAA && pMD && pVD) {
    await db.insert(schema.formulaItemsTable).values([
      {
        formulaId: form2.id,
        productId: pAA.id,
        productName: pAA.name,
        quantity: "0.2000",
        unit: "kg",
        function: "IFA Vitamina C",
      },
      {
        formulaId: form2.id,
        productId: pMD.id,
        productName: pMD.name,
        quantity: "0.6000",
        unit: "kg",
        function: "Excipiente base",
      },
      {
        formulaId: form2.id,
        productId: pVD.id,
        productName: pVD.name,
        quantity: "0.2000",
        unit: "g",
        function: "IFA Vitamina D3",
      },
    ]).onConflictDoNothing();
  }

  // ── 13. SALES ORDERS ────────────────────────────────────────────────────────
  console.log("🛒  Inserindo pedidos de venda...");
  const [so1, so2, so3] = await db
    .insert(schema.salesOrdersTable)
    .values([
      {
        clientId: client1?.id ?? null,
        type: "order",
        status: "delivered",
        totalAmount: "18500.00",
        deliveryDate: daysAgo(15),
        paymentTerms: "30/60/90 DDL",
        formula: "Vitamina C 500mg",
        formulaVersion: "1.0",
        packagingType: "Frasco PET 500mL",
        notes: "Pedido urgente — atendimento hospitalar",
      },
      {
        clientId: client2?.id ?? null,
        type: "order",
        status: "in_production",
        totalAmount: "12000.00",
        deliveryDate: daysFromNow(20),
        paymentTerms: "28 DDL",
        formula: "Complexo Vitamínico D",
        formulaVersion: "1.0",
        packagingType: "Cápsula gelatinosa 30ct",
        notes: "Lote piloto para contrato anual",
      },
      {
        clientId: client3?.id ?? null,
        type: "quote",
        status: "draft",
        totalAmount: "9250.00",
        validUntil: daysFromNow(30),
        paymentTerms: "28 DDL",
        formula: "Vitamina C 500mg",
        formulaVersion: "1.0",
        notes: "Orçamento inicial — aguardando aprovação cliente",
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (so1 && pVCA) {
    await db.insert(schema.salesOrderItemsTable).values({
      salesOrderId: so1.id,
      productId: pVCA.id,
      description: "Vitamina C 500mg — 60 Comprimidos",
      quantity: "1000.000",
      unitPrice: "18.50",
      totalPrice: "18500.00",
    }).onConflictDoNothing();
    await db.insert(schema.salesOrderLogsTable).values([
      { salesOrderId: so1.id, fromStatus: null, toStatus: "draft", userName: "Fernanda Oliveira", notes: "Pedido criado" },
      { salesOrderId: so1.id, fromStatus: "draft", toStatus: "confirmed", userName: "Fernanda Oliveira", notes: "Aprovado pelo cliente" },
      { salesOrderId: so1.id, fromStatus: "confirmed", toStatus: "in_production", userName: "Maria Santos", notes: "OP-2024-001 aberta" },
      { salesOrderId: so1.id, fromStatus: "in_production", toStatus: "quality_check", userName: "Ana Lima", notes: "Lote PA liberado para CQ" },
      { salesOrderId: so1.id, fromStatus: "quality_check", toStatus: "delivered", userName: "Fernanda Oliveira", notes: "NF emitida e entregue" },
    ]).onConflictDoNothing();
  }

  if (so2 && pCVD) {
    await db.insert(schema.salesOrderItemsTable).values({
      salesOrderId: so2.id,
      productId: pCVD.id,
      description: "Complexo Vitamínico D — 30 Cápsulas",
      quantity: "500.000",
      unitPrice: "24.00",
      totalPrice: "12000.00",
    }).onConflictDoNothing();
    await db.insert(schema.salesOrderLogsTable).values([
      { salesOrderId: so2.id, fromStatus: null, toStatus: "draft", userName: "Fernanda Oliveira" },
      { salesOrderId: so2.id, fromStatus: "draft", toStatus: "confirmed", userName: "Fernanda Oliveira", notes: "Cliente confirmou" },
      { salesOrderId: so2.id, fromStatus: "confirmed", toStatus: "in_production", userName: "Maria Santos", notes: "OP-2024-002 aberta" },
    ]).onConflictDoNothing();
  }

  if (so3 && pVCA) {
    await db.insert(schema.salesOrderItemsTable).values({
      salesOrderId: so3.id,
      productId: pVCA.id,
      description: "Vitamina C 500mg — 60 Comprimidos",
      quantity: "500.000",
      unitPrice: "18.50",
      totalPrice: "9250.00",
    }).onConflictDoNothing();
  }

  // ── 14. PRODUCTION ORDERS ───────────────────────────────────────────────────
  console.log("⚙️   Inserindo ordens de produção...");
  const [op1, op2] = await db
    .insert(schema.productionOrdersTable)
    .values([
      {
        number: "OP-2024-001",
        formulaId: form1?.id ?? null,
        productId: pVCA?.id ?? null,
        productName: "Vitamina C 500mg",
        formulaVersion: "1.0",
        batchLot: "LOT-VCA-2024-001",
        plannedQty: "200.000",
        actualQty: "197.500",
        unit: "kg",
        status: "finished",
        salesOrderId: so1?.id ?? null,
        scheduledStart: isoDate(daysAgo(30)),
        scheduledEnd: isoDate(daysAgo(28)),
        actualStart: daysAgo(30),
        actualEnd: daysAgo(28),
        releasedBy: "Maria Santos",
        releasedAt: daysAgo(31),
        notes: "Produção concluída dentro do prazo. Rendimento 98,75%.",
      },
      {
        number: "OP-2024-002",
        formulaId: form2?.id ?? null,
        productId: pCVD?.id ?? null,
        productName: "Complexo Vitamínico D",
        formulaVersion: "1.0",
        batchLot: "LOT-CVD-2024-001",
        plannedQty: "150.000",
        actualQty: null,
        unit: "kg",
        status: "in_production",
        salesOrderId: so2?.id ?? null,
        scheduledStart: isoDate(daysAgo(3)),
        scheduledEnd: isoDate(daysFromNow(4)),
        actualStart: daysAgo(3),
        actualEnd: null,
        releasedBy: "Maria Santos",
        releasedAt: daysAgo(4),
        notes: "Em andamento — etapa de mistura concluída, envase em progresso.",
      },
    ])
    .onConflictDoNothing()
    .returning();

  // ── 15. PRODUCTION STAGES ───────────────────────────────────────────────────
  console.log("🔩  Inserindo etapas de produção...");
  let stage1Pesagem: typeof schema.productionStagesTable.$inferSelect | undefined;
  let stage1Packaging: typeof schema.productionStagesTable.$inferSelect | undefined;
  if (op1) {
    const stages1 = await db.insert(schema.productionStagesTable).values([
      {
        orderId: op1.id,
        stageType: "weighing",
        sequence: 1,
        status: "done",
        operatorName: "Carlos Ferreira",
        equipment: "Balança Industrial BI-500",
        qtyIn: "200.000",
        qtyOut: "200.000",
        yieldPct: "100.00",
        losses: "0.000",
        startedAt: daysAgo(30),
        finishedAt: daysAgo(30),
      },
      {
        orderId: op1.id,
        stageType: "mixing",
        sequence: 2,
        status: "done",
        operatorName: "Carlos Ferreira",
        equipment: "Misturador M-2000",
        qtyIn: "200.000",
        qtyOut: "198.500",
        yieldPct: "99.25",
        losses: "1.500",
        startedAt: daysAgo(29),
        finishedAt: daysAgo(29),
      },
      {
        orderId: op1.id,
        stageType: "packaging",
        sequence: 3,
        status: "done",
        operatorName: "Carlos Ferreira",
        equipment: "Linha de Envase LE-01",
        qtyIn: "198.500",
        qtyOut: "197.500",
        yieldPct: "99.50",
        losses: "1.000",
        startedAt: daysAgo(28),
        finishedAt: daysAgo(28),
      },
    ]).onConflictDoNothing().returning();
    stage1Pesagem = stages1[0];
    stage1Packaging = stages1[2];
  }

  let stage2Pesagem: typeof schema.productionStagesTable.$inferSelect | undefined;
  let stage2Packaging: typeof schema.productionStagesTable.$inferSelect | undefined;
  if (op2) {
    const stages2 = await db.insert(schema.productionStagesTable).values([
      {
        orderId: op2.id,
        stageType: "weighing",
        sequence: 1,
        status: "done",
        operatorName: "Carlos Ferreira",
        equipment: "Balança Industrial BI-500",
        qtyIn: "150.000",
        qtyOut: "150.000",
        yieldPct: "100.00",
        losses: "0.000",
        startedAt: daysAgo(3),
        finishedAt: daysAgo(3),
      },
      {
        orderId: op2.id,
        stageType: "mixing",
        sequence: 2,
        status: "done",
        operatorName: "Carlos Ferreira",
        equipment: "Misturador M-2000",
        qtyIn: "150.000",
        qtyOut: "149.200",
        yieldPct: "99.47",
        losses: "0.800",
        startedAt: daysAgo(2),
        finishedAt: daysAgo(2),
      },
      {
        orderId: op2.id,
        stageType: "packaging",
        sequence: 3,
        status: "in_progress",
        operatorName: "Carlos Ferreira",
        equipment: "Linha de Envase LE-01",
        qtyIn: "149.200",
        qtyOut: null,
        yieldPct: null,
        losses: null,
        startedAt: daysAgo(1),
        finishedAt: null,
      },
    ]).onConflictDoNothing().returning();
    stage2Pesagem = stages2[0];
    stage2Packaging = stages2[2];
  }

  // ── 16. MATERIAL CONSUMPTIONS (rastreabilidade MP→OP) ───────────────────────
  console.log("🔗  Inserindo consumos de MP (rastreabilidade)...");
  if (op1 && lotAA1 && lotMD1 && lotVD1 && lotEMB1 && pAA && pMD && pVD && pEMB) {
    await db.insert(schema.productionMaterialConsumptionsTable).values([
      {
        orderId: op1.id,
        stageId: stage1Pesagem?.id ?? null,
        productId: pAA.id,
        productName: pAA.name,
        lotId: lotAA1.id,
        internalLot: lotAA1.internalLot,
        plannedQty: "105.0000",
        actualQty: "105.0000",
        unit: "kg",
        recordedBy: "Carlos Ferreira",
        notes: "Pesagem conferida",
      },
      {
        orderId: op1.id,
        stageId: stage1Pesagem?.id ?? null,
        productId: pMD.id,
        productName: pMD.name,
        lotId: lotMD1.id,
        internalLot: lotMD1.internalLot,
        plannedQty: "90.0000",
        actualQty: "90.0000",
        unit: "kg",
        recordedBy: "Carlos Ferreira",
      },
      {
        orderId: op1.id,
        stageId: stage1Pesagem?.id ?? null,
        productId: pVD.id,
        productName: pVD.name,
        lotId: lotVD1.id,
        internalLot: lotVD1.internalLot,
        plannedQty: "5.0000",
        actualQty: "5.0000",
        unit: "g",
        recordedBy: "Carlos Ferreira",
      },
      {
        orderId: op1.id,
        stageId: stage1Packaging?.id ?? null,
        productId: pEMB.id,
        productName: pEMB.name,
        lotId: lotEMB1.id,
        internalLot: lotEMB1.internalLot,
        plannedQty: "1000.0000",
        actualQty: "987.0000",
        unit: "un",
        recordedBy: "Carlos Ferreira",
        notes: "Frascos PET consumidos no envase — OP-2024-001",
      },
    ]).onConflictDoNothing();
  }

  if (op2 && lotAA2 && lotMD1 && lotVD1 && lotEMB1 && pAA && pMD && pVD && pEMB) {
    await db.insert(schema.productionMaterialConsumptionsTable).values([
      {
        orderId: op2.id,
        stageId: stage2Pesagem?.id ?? null,
        productId: pAA.id,
        productName: pAA.name,
        lotId: lotAA2.id,
        internalLot: lotAA2.internalLot,
        plannedQty: "30.0000",
        actualQty: "30.0000",
        unit: "kg",
        recordedBy: "Carlos Ferreira",
      },
      {
        orderId: op2.id,
        stageId: stage2Pesagem?.id ?? null,
        productId: pMD.id,
        productName: pMD.name,
        lotId: lotMD1.id,
        internalLot: lotMD1.internalLot,
        plannedQty: "90.0000",
        actualQty: "90.0000",
        unit: "kg",
        recordedBy: "Carlos Ferreira",
      },
      {
        orderId: op2.id,
        stageId: stage2Pesagem?.id ?? null,
        productId: pVD.id,
        productName: pVD.name,
        lotId: lotVD1.id,
        internalLot: lotVD1.internalLot,
        plannedQty: "30.0000",
        actualQty: "30.0000",
        unit: "g",
        recordedBy: "Carlos Ferreira",
      },
      {
        orderId: op2.id,
        stageId: stage2Packaging?.id ?? null,
        productId: pEMB.id,
        productName: pEMB.name,
        lotId: lotEMB1.id,
        internalLot: lotEMB1.internalLot,
        plannedQty: "500.0000",
        actualQty: "0.0000",
        unit: "un",
        recordedBy: "Carlos Ferreira",
        notes: "Frascos PET planejados para envase — OP-2024-002 em andamento",
      },
    ]).onConflictDoNothing();
  }

  // ── 17. PRODUCT LOTS (PA) — output from OPs ─────────────────────────────────
  console.log("🏷️   Inserindo lotes de produto acabado...");
  const paLots = await db
    .insert(schema.productLotsTable)
    .values([
      {
        productId: pVCA!.id,
        internalLot: "LOT-VCA-2024-001",
        supplierLot: null,
        warehouseId: wPA?.id,
        manufacturingDate: isoDate(daysAgo(28)),
        expirationDate: isoDate(daysFromNow(700)),
        cqStatus: "approved",
        totalQty: "1000.000",
        availableQty: "920.000",
        reservedQty: "0.000",
        blockedQty: "0.000",
        notes: "Produzido em OP-2024-001 — CQ aprovado em " + isoDate(daysAgo(25)),
      },
      {
        productId: pCVD!.id,
        internalLot: "LOT-CVD-2024-001",
        supplierLot: null,
        warehouseId: wProd?.id,
        manufacturingDate: isoDate(daysAgo(1)),
        expirationDate: isoDate(daysFromNow(730)),
        cqStatus: "quarantine",
        totalQty: "500.000",
        availableQty: "0.000",
        reservedQty: "500.000",
        blockedQty: "0.000",
        notes: "Produzido em OP-2024-002 — aguardando análise CQ",
      },
    ])
    .onConflictDoNothing()
    .returning();

  const [lotVCA1, lotCVD1] = paLots;

  // PA lot movements
  if (lotVCA1 && pVCA && wPA) {
    await db.insert(schema.lotMovementsTable).values({
      lotId: lotVCA1.id,
      productId: pVCA.id,
      warehouseId: wPA.id,
      type: "input",
      quantity: "1000.000",
      reason: "Entrada PA — OP concluída",
      notes: "OP-2024-001 finalizada",
      referenceType: "production_order",
    }).onConflictDoNothing();
    // output for sales
    await db.insert(schema.lotMovementsTable).values({
      lotId: lotVCA1.id,
      productId: pVCA.id,
      warehouseId: wPA.id,
      type: "output",
      quantity: "80.000",
      reason: "Saída por venda",
      notes: "PV-2024-001 — entregue",
      referenceType: "sales_order",
    }).onConflictDoNothing();
  }

  // ── 18. STOCK MOVEMENTS ─────────────────────────────────────────────────────
  console.log("📊  Inserindo movimentações de estoque...");
  if (pAA && pMD && pVD && pEMB && pVCA && pCVD) {
    await db.insert(schema.stockMovementsTable).values([
      {
        productId: pAA.id,
        type: "input",
        quantity: "500.000",
        reason: "Recebimento de compra",
        referenceType: "purchase_order",
        notes: "PC-2024-001 — NF 000101",
      },
      {
        productId: pAA.id,
        type: "input",
        quantity: "300.000",
        reason: "Recebimento de compra",
        referenceType: "purchase_order",
        notes: "PC-2024-002 — NF 000115",
      },
      {
        productId: pAA.id,
        type: "output",
        quantity: "105.000",
        reason: "Consumo em OP",
        referenceType: "production_order",
        notes: "OP-2024-001",
      },
      {
        productId: pMD.id,
        type: "input",
        quantity: "800.000",
        reason: "Recebimento de compra",
        referenceType: "purchase_order",
      },
      {
        productId: pMD.id,
        type: "output",
        quantity: "90.000",
        reason: "Consumo em OP",
        referenceType: "production_order",
        notes: "OP-2024-001",
      },
      {
        productId: pVD.id,
        type: "input",
        quantity: "50.000",
        reason: "Recebimento de compra",
        referenceType: "purchase_order",
      },
      {
        productId: pVD.id,
        type: "output",
        quantity: "5.000",
        reason: "Consumo em OP",
        referenceType: "production_order",
        notes: "OP-2024-001",
      },
      {
        productId: pEMB.id,
        type: "input",
        quantity: "2000.000",
        reason: "Recebimento de compra",
        referenceType: "purchase_order",
      },
      {
        productId: pEMB.id,
        type: "output",
        quantity: "150.000",
        reason: "Consumo em envase",
        referenceType: "production_order",
        notes: "OP-2024-001",
      },
      {
        productId: pVCA.id,
        type: "input",
        quantity: "1000.000",
        reason: "Produção concluída",
        referenceType: "production_order",
        notes: "OP-2024-001",
      },
      {
        productId: pVCA.id,
        type: "output",
        quantity: "80.000",
        reason: "Venda entregue",
        referenceType: "sales_order",
        notes: "PV-2024-001",
      },
    ]).onConflictDoNothing();
  }

  // ── 19. PURCHASE ORDERS ─────────────────────────────────────────────────────
  console.log("🛍️   Inserindo pedidos de compra...");
  const [po1, po2, po3] = await db
    .insert(schema.purchaseOrdersTable)
    .values([
      {
        supplierId: supQuimica!.id,
        status: "received",
        totalAmount: "22500.00",
        expectedDeliveryDate: daysAgo(88),
        receivedAt: daysAgo(87),
        freightCost: "350.00",
        carrier: "Rapidão Cometa",
        nfNumber: "000101",
        notes: "Recebimento conferido sem divergências",
      },
      {
        supplierId: supVitaminex!.id,
        status: "received",
        totalAmount: "38125.00",
        expectedDeliveryDate: daysAgo(28),
        receivedAt: daysAgo(27),
        freightCost: "180.00",
        carrier: "Jadlog",
        nfNumber: "000115",
        notes: "Maltodextrina e Vitamina D3 — recebidos",
      },
      {
        supplierId: supEmbalagem!.id,
        status: "sent",
        totalAmount: "1700.00",
        expectedDeliveryDate: daysFromNow(5),
        freightCost: "120.00",
        carrier: "Correios",
        notes: "Aguardando entrega",
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (po1 && pAA) {
    await db.insert(schema.purchaseOrderItemsTable).values({
      purchaseOrderId: po1.id,
      productId: pAA.id,
      description: "Ácido Ascórbico USP — 500kg",
      quantity: "500.000",
      receivedQty: "500.000",
      unitPrice: "45.00",
      totalPrice: "22500.00",
    }).onConflictDoNothing();
  }
  if (po2 && pMD && pVD) {
    await db.insert(schema.purchaseOrderItemsTable).values([
      {
        purchaseOrderId: po2.id,
        productId: pMD.id,
        description: "Maltodextrina DE10 — 800kg",
        quantity: "800.000",
        receivedQty: "800.000",
        unitPrice: "8.50",
        totalPrice: "6800.00",
      },
      {
        purchaseOrderId: po2.id,
        productId: pVD.id,
        description: "Vitamina D3 100.000UI/g — 50g",
        quantity: "50.000",
        receivedQty: "50.000",
        unitPrice: "185.00",
        totalPrice: "9250.00",
      },
    ]).onConflictDoNothing();
  }
  if (po3 && pEMB) {
    await db.insert(schema.purchaseOrderItemsTable).values({
      purchaseOrderId: po3.id,
      productId: pEMB.id,
      description: "Frasco PET 500mL Âmbar — 2000un",
      quantity: "2000.000",
      receivedQty: "0.000",
      unitPrice: "0.85",
      totalPrice: "1700.00",
    }).onConflictDoNothing();
  }

  // ── 20. PURCHASE REQUESTS & QUOTATIONS ──────────────────────────────────────
  console.log("📋  Inserindo solicitações de compra e cotações...");
  const [pr1, pr2] = await db
    .insert(schema.purchaseRequestsTable)
    .values([
      {
        productId: pAA?.id ?? null,
        description: "Reposição Ácido Ascórbico — estoque abaixo do ponto de pedido",
        quantity: "500.000",
        unit: "kg",
        priority: "normal",
        status: "converted",
        purchaseOrderId: po1?.id ?? null,
        notes: "Aprovado pela gerência",
      },
      {
        productId: pEMB?.id ?? null,
        description: "Reposição frascos PET — previsão de consumo próximas 4 semanas",
        quantity: "5000.000",
        unit: "un",
        priority: "urgent",
        status: "approved",
        notes: "Solicitação urgente — estoque crítico",
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (pr2) {
    const [quot1] = await db
      .insert(schema.quotationsTable)
      .values({
        purchaseRequestId: pr2.id,
        title: "Cotação frascos PET 500mL — 3 fornecedores",
        status: "open",
        notes: "Aguardando resposta dos fornecedores",
      })
      .onConflictDoNothing()
      .returning();

    if (quot1 && supEmbalagem) {
      await db.insert(schema.quotationItemsTable).values([
        {
          quotationId: quot1.id,
          supplierId: supEmbalagem.id,
          productId: pEMB?.id ?? null,
          description: "Frasco PET 500mL Âmbar — lote 5000un",
          quantity: "5000.000",
          unitPrice: "0.82",
          totalPrice: "4100.00",
          deliveryDays: 7,
          selected: "true",
          notes: "Melhor preço + prazo",
        },
      ]).onConflictDoNothing();
    }
  }

  // ── 21. FINANCIAL ENTRIES ───────────────────────────────────────────────────
  console.log("💰  Inserindo lançamentos financeiros...");
  await db.insert(schema.financialEntriesTable).values([
    {
      description: "Recebimento PV-2024-001 — Farmácia Central SP",
      type: "income",
      category: "Vendas",
      amount: "6166.67",
      dueDate: daysAgo(5),
      paidAt: daysAgo(4),
      status: "paid",
      referenceType: "sales_order",
      notes: "1ª parcela 30 DDL",
    },
    {
      description: "Recebimento PV-2024-001 — Farmácia Central SP",
      type: "income",
      category: "Vendas",
      amount: "6166.67",
      dueDate: daysFromNow(25),
      paidAt: null,
      status: "pending",
      referenceType: "sales_order",
      notes: "2ª parcela 60 DDL",
    },
    {
      description: "Recebimento PV-2024-001 — Farmácia Central SP",
      type: "income",
      category: "Vendas",
      amount: "6166.66",
      dueDate: daysFromNow(55),
      paidAt: null,
      status: "pending",
      referenceType: "sales_order",
      notes: "3ª parcela 90 DDL",
    },
    {
      description: "Recebimento PV-2024-002 — Distribuidora MedFar",
      type: "income",
      category: "Vendas",
      amount: "12000.00",
      dueDate: daysFromNow(35),
      paidAt: null,
      status: "pending",
      referenceType: "sales_order",
      notes: "28 DDL após entrega",
    },
    {
      description: "Pagamento PC-2024-001 — Química Brasil",
      type: "expense",
      category: "Matéria-Prima",
      amount: "22850.00",
      dueDate: daysAgo(60),
      paidAt: daysAgo(60),
      status: "paid",
      referenceType: "purchase_order",
      notes: "Ácido Ascórbico + frete",
    },
    {
      description: "Pagamento PC-2024-002 — Vitaminex Ingredientes",
      type: "expense",
      category: "Matéria-Prima",
      amount: "38305.00",
      dueDate: daysFromNow(3),
      paidAt: null,
      status: "pending",
      referenceType: "purchase_order",
      notes: "Maltodextrina + Vitamina D3 + frete",
    },
    {
      description: "Salários — Folha Junho 2024",
      type: "expense",
      category: "Pessoal",
      amount: "21500.00",
      dueDate: daysFromNow(5),
      paidAt: null,
      status: "pending",
      notes: "Folha de pagamento mensal",
    },
    {
      description: "Aluguel Galpão Industrial",
      type: "expense",
      category: "Instalações",
      amount: "8500.00",
      dueDate: daysAgo(10),
      paidAt: daysAgo(9),
      status: "paid",
      notes: "Mês de referência",
    },
    {
      description: "Energia Elétrica — Industrial",
      type: "expense",
      category: "Utilities",
      amount: "3240.00",
      dueDate: daysAgo(20),
      paidAt: daysAgo(19),
      status: "paid",
    },
    {
      description: "Serviços de Laboratório Terceirizado",
      type: "expense",
      category: "Qualidade",
      amount: "1850.00",
      dueDate: daysFromNow(15),
      paidAt: null,
      status: "pending",
      notes: "Análise microbiológica terceirizada",
    },
  ]).onConflictDoNothing();

  // ── 22. FISCAL DOCUMENTS ────────────────────────────────────────────────────
  console.log("📄  Inserindo documentos fiscais...");
  await db.insert(schema.fiscalDocumentsTable).values([
    {
      type: "nfe",
      direction: "saida",
      number: "000001",
      emitter: "NEXUS Indústria Farmacêutica Ltda",
      recipient: "Farmácia Central SP Ltda",
      emitterDocument: "98.765.432/0001-10",
      recipientDocument: client1?.document ?? "12.345.678/0001-90",
      issueDate: daysAgo(15),
      totalAmount: "18500.00",
      cfop: "6102",
      icmsAmount: "1665.00",
      pisAmount: "120.25",
      cofinsAmount: "555.00",
      issAmount: "0.00",
      status: "issued",
      referenceOrderId: so1 ? String(so1.id) : undefined,
      notes: "NF-e referente PV-2024-001",
    },
    {
      type: "nf_entrada",
      direction: "entrada",
      number: "000101",
      emitter: "Química Brasil Importação Ltda",
      recipient: "NEXUS Indústria Farmacêutica Ltda",
      emitterDocument: supQuimica?.document ?? "45.678.901/0001-23",
      recipientDocument: "98.765.432/0001-10",
      issueDate: daysAgo(87),
      totalAmount: "22500.00",
      cfop: "1101",
      icmsAmount: "0.00",
      pisAmount: "0.00",
      cofinsAmount: "0.00",
      issAmount: "0.00",
      status: "issued",
      referenceOrderId: po1 ? String(po1.id) : undefined,
      notes: "NF entrada — Ácido Ascórbico PC-2024-001",
    },
    {
      type: "nf_entrada",
      direction: "entrada",
      number: "000115",
      emitter: "Vitaminex Ingredientes",
      recipient: "NEXUS Indústria Farmacêutica Ltda",
      emitterDocument: supVitaminex?.document ?? "67.890.123/0001-45",
      recipientDocument: "98.765.432/0001-10",
      issueDate: daysAgo(27),
      totalAmount: "38125.00",
      cfop: "1101",
      icmsAmount: "0.00",
      pisAmount: "0.00",
      cofinsAmount: "0.00",
      issAmount: "0.00",
      status: "issued",
      referenceOrderId: po2 ? String(po2.id) : undefined,
      notes: "NF entrada — Maltodextrina + Vitamina D3",
    },
    {
      type: "nfse",
      direction: "saida",
      number: "000002",
      emitter: "NEXUS Indústria Farmacêutica Ltda",
      recipient: "Distribuidora MedFar S.A.",
      emitterDocument: "98.765.432/0001-10",
      recipientDocument: client2?.document ?? "23.456.789/0001-01",
      issueDate: daysAgo(2),
      totalAmount: "12000.00",
      cfop: "6102",
      icmsAmount: "1080.00",
      pisAmount: "78.00",
      cofinsAmount: "360.00",
      issAmount: "0.00",
      status: "issued",
      referenceOrderId: so2 ? String(so2.id) : undefined,
      notes: "NFS-e referente PV-2024-002 (antecipada)",
    },
  ]).onConflictDoNothing();

  // ── 23. QUALITY INSPECTIONS ─────────────────────────────────────────────────
  console.log("🔬  Inserindo inspeções de qualidade...");
  const [qi1, qi2] = await db
    .insert(schema.qualityInspectionsTable)
    .values([
      {
        productId: pAA?.id ?? null,
        productName: "Ácido Ascórbico USP",
        batchNumber: "LOT-AA-2024-001",
        inspectionDate: isoDate(daysAgo(85)),
        inspector: "Ana Lima",
        result: "approved",
        quantityInspected: 500,
        quantityFailed: 0,
        notes: "Todos os parâmetros dentro da especificação",
      },
      {
        productId: pVD?.id ?? null,
        productName: "Vitamina D3 100.000UI/g",
        batchNumber: "LOT-VD-2024-001",
        inspectionDate: isoDate(daysAgo(42)),
        inspector: "Ana Lima",
        result: "conditional",
        quantityInspected: 50,
        quantityFailed: 2,
        notes: "2 amostras com potência 98,5% — abaixo do limite inferior 99,0%. Liberado sob supervisão.",
      },
    ])
    .onConflictDoNothing()
    .returning();

  // ── 24. QUALITY NCRS ────────────────────────────────────────────────────────
  console.log("⚠️   Inserindo NCRs e CAPA...");
  const [ncr1] = await db
    .insert(schema.qualityNcrsTable)
    .values([
      {
        inspectionId: qi2?.id ?? null,
        productId: pVD?.id ?? null,
        productName: "Vitamina D3 100.000UI/g",
        title: "Potência de Vitamina D3 abaixo do limite inferior",
        description: "2 de 10 amostras do lote LOT-VD-2024-001 apresentaram potência 98,5% (espéc: 99,0–101,5%)",
        severity: "medium",
        status: "action_plan",
        rootCause: "Possível degradação durante transporte refrigerado",
        correctiveAction: "Revalidação do processo de transporte + aumento de amostras para liberação",
        reportedBy: "Ana Lima",
        assignedTo: "Maria Santos",
        dueDate: isoDate(daysFromNow(14)),
        ncType: "receiving",
        origin: "Inspeção de Recebimento",
        whyAnalysis: JSON.stringify([
          "Por quê a potência está abaixo? — Possível degradação do IFA",
          "Por quê houve degradação? — Temperatura durante transporte pode ter variado",
          "Por quê a temperatura variou? — Rastreador de temperatura não acompanhou o lote",
          "Por quê não acompanhou? — Fornecedor não inclui rastreador por padrão",
          "Por quê não foi exigido? — Requisito não estava no contrato de qualificação",
        ]),
        investigatedBy: "Ana Lima",
        investigatedAt: daysAgo(40),
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (ncr1) {
    const [capaAction1] = await db
      .insert(schema.capaActionsTable)
      .values([
        {
          ncrId: ncr1.id,
          actionType: "corrective",
          description: "Incluir rastreador de temperatura em todas as remessas de IFA refrigerado",
          responsible: "Roberto Costa",
          dueDate: isoDate(daysFromNow(7)),
          status: "in_progress",
          notes: "Negociando com fornecedor cláusula contratual",
        },
        {
          ncrId: ncr1.id,
          actionType: "preventive",
          description: "Revisar procedimento de qualificação de fornecedores para incluir requisitos de transporte",
          responsible: "Ana Lima",
          dueDate: isoDate(daysFromNow(21)),
          status: "pending",
        },
      ])
      .onConflictDoNothing()
      .returning();
  }

  // ── 25. QUALITY ANALYSES ────────────────────────────────────────────────────
  console.log("📐  Inserindo análises de qualidade...");
  const [qa1, qa2] = await db
    .insert(schema.qualityAnalysesTable)
    .values([
      {
        lotId: lotVCA1?.id ?? null,
        productId: pVCA?.id ?? null,
        productName: "Vitamina C 500mg — 60 Comprimidos",
        internalLot: "LOT-VCA-2024-001",
        sampleCode: "AM-2024-0201",
        analysisType: "physical_chemical",
        analystName: "Ana Lima",
        reviewerName: "Maria Santos",
        status: "approved",
        notes: "Todas as análises conformes",
        justification: "Produto aprovado para liberação e distribuição",
        startedAt: daysAgo(26),
        completedAt: daysAgo(25),
      },
      {
        lotId: lotCVD1?.id ?? null,
        productId: pCVD?.id ?? null,
        productName: "Complexo Vitamínico D — 30 Cápsulas",
        internalLot: "LOT-CVD-2024-001",
        sampleCode: "AM-2024-0215",
        analysisType: "full",
        analystName: "Ana Lima",
        reviewerName: null,
        status: "in_analysis",
        notes: "Análise em andamento — resultado esperado em 48h",
        startedAt: daysAgo(1),
        completedAt: null,
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (qa1) {
    await db.insert(schema.analysisParametersTable).values([
      {
        analysisId: qa1.id,
        parameterName: "Teor de Ácido Ascórbico",
        specification: "97,0% – 103,0%",
        minValue: "97.0",
        maxValue: "103.0",
        resultValue: "99.2",
        unit: "%",
        isConforming: true,
      },
      {
        analysisId: qa1.id,
        parameterName: "pH (solução 1%)",
        specification: "3,0 – 4,0",
        minValue: "3.0",
        maxValue: "4.0",
        resultValue: "3.5",
        unit: "pH",
        isConforming: true,
      },
      {
        analysisId: qa1.id,
        parameterName: "Umidade",
        specification: "≤ 0,5%",
        minValue: null,
        maxValue: "0.5",
        resultValue: "0.3",
        unit: "%",
        isConforming: true,
      },
      {
        analysisId: qa1.id,
        parameterName: "Contagem microbiológica total",
        specification: "≤ 100 UFC/g",
        minValue: null,
        maxValue: "100",
        resultValue: "18",
        unit: "UFC/g",
        isConforming: true,
      },
    ]).onConflictDoNothing();

    await db.insert(schema.qualityCertificatesTable).values({
      analysisId: qa1.id,
      certificateNumber: "CQ-2024-0201",
      sampleCode: "AM-2024-0201",
      productId: pVCA?.id ?? null,
      productName: "Vitamina C 500mg — 60 Comprimidos",
      internalLot: "LOT-VCA-2024-001",
      analysisType: "physical_chemical",
      result: "approved",
      analystName: "Ana Lima",
      reviewerName: "Maria Santos",
      justification: "Todos os parâmetros físico-químicos e microbiológicos aprovados",
      parametersSnapshot: JSON.stringify([
        { name: "Teor de Ácido Ascórbico", result: "99.2%", conforming: true },
        { name: "pH", result: "3.5", conforming: true },
        { name: "Umidade", result: "0.3%", conforming: true },
        { name: "Contagem microbiológica", result: "18 UFC/g", conforming: true },
      ]),
      issuedAt: daysAgo(25),
    }).onConflictDoNothing();
  }

  if (qa2) {
    await db.insert(schema.analysisParametersTable).values([
      {
        analysisId: qa2.id,
        parameterName: "Teor de Ácido Ascórbico",
        specification: "97,0% – 103,0%",
        minValue: "97.0",
        maxValue: "103.0",
        resultValue: null,
        unit: "%",
        isConforming: null,
      },
      {
        analysisId: qa2.id,
        parameterName: "Teor de Vitamina D3",
        specification: "95,0% – 105,0%",
        minValue: "95.0",
        maxValue: "105.0",
        resultValue: null,
        unit: "%",
        isConforming: null,
      },
    ]).onConflictDoNothing();
  }

  // ── 26. PROJECTS ────────────────────────────────────────────────────────────
  console.log("📁  Inserindo projetos...");
  const [proj1, proj2] = await db
    .insert(schema.projectsTable)
    .values([
      {
        name: "Implantação ERP — Módulo de Produção",
        description: "Configuração e go-live do módulo de ordens de produção, fórmulas e rastreabilidade",
        clientId: null,
        status: "active",
        startDate: daysAgo(60),
        endDate: daysFromNow(30),
      },
      {
        name: "Certificação ISO 9001:2015",
        description: "Projeto de adequação e certificação do SGQ conforme ISO 9001",
        clientId: null,
        status: "planning",
        startDate: daysFromNow(15),
        endDate: daysFromNow(180),
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (proj1) {
    await db.insert(schema.projectTasksTable).values([
      {
        projectId: proj1.id,
        title: "Mapeamento dos processos de produção",
        description: "Levantar fluxogramas e POPs de cada etapa produtiva",
        assigneeName: "Maria Santos",
        priority: "high",
        status: "done",
        dueDate: daysAgo(45),
      },
      {
        projectId: proj1.id,
        title: "Cadastrar fórmulas no ERP",
        description: "Inserir versões aprovadas das fórmulas mestre no sistema",
        assigneeName: "Ana Lima",
        priority: "high",
        status: "done",
        dueDate: daysAgo(30),
      },
      {
        projectId: proj1.id,
        title: "Treinamento de operadores no módulo de produção",
        description: "Capacitar operadores para abertura e execução de OPs no sistema",
        assigneeName: "Carlos Ferreira",
        priority: "medium",
        status: "in_progress",
        dueDate: daysFromNow(7),
      },
      {
        projectId: proj1.id,
        title: "Validação de OPs piloto com rastreabilidade",
        description: "Executar 3 OPs piloto e validar rastreabilidade ponta-a-ponta",
        assigneeName: "Maria Santos",
        priority: "high",
        status: "todo",
        dueDate: daysFromNow(20),
      },
      {
        projectId: proj1.id,
        title: "Go-live módulo produção",
        description: "Liberação para produção em modo live, desativando planilhas",
        assigneeName: "Maria Santos",
        priority: "urgent",
        status: "todo",
        dueDate: daysFromNow(30),
      },
    ]).onConflictDoNothing();
  }

  if (proj2) {
    await db.insert(schema.projectTasksTable).values([
      {
        projectId: proj2.id,
        title: "Diagnóstico inicial — GAP análise ISO 9001",
        description: "Avaliar requisitos atuais vs. requisitos da norma",
        assigneeName: "Ana Lima",
        priority: "high",
        status: "todo",
        dueDate: daysFromNow(30),
      },
      {
        projectId: proj2.id,
        title: "Elaborar Manual da Qualidade",
        description: "Redigir política, objetivos e escopo do SGQ",
        assigneeName: "Ana Lima",
        priority: "medium",
        status: "todo",
        dueDate: daysFromNow(75),
      },
      {
        projectId: proj2.id,
        title: "Contratar auditoria de pré-certificação",
        description: "Selecionar organismo certificador e agendar auditoria",
        assigneeName: "Maria Santos",
        priority: "medium",
        status: "todo",
        dueDate: daysFromNow(120),
      },
    ]).onConflictDoNothing();
  }

  // ── 27. APS — WORK CENTERS, SHIFTS & SCHEDULE ───────────────────────────────
  console.log("📆  Inserindo APS — centros de trabalho e programação...");
  const [wc1, wc2] = await db
    .insert(schema.workCentersTable)
    .values([
      {
        name: "Misturador Industrial M-2000",
        description: "Misturador de alta capacidade para sólidos e semissólidos",
        type: "machine",
        capacityHoursPerShift: "8.00",
        setupTimeMinutes: 45,
        isActive: true,
        notes: "Capacidade máx. 250kg por batelada",
      },
      {
        name: "Linha de Envase LE-01",
        description: "Linha automatizada de envase em frascos PET",
        type: "line",
        capacityHoursPerShift: "8.00",
        setupTimeMinutes: 30,
        isActive: true,
        notes: "Velocidade: 120 frascos/min",
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (wc1 && wc2) {
    const dates = [0, 1, 2, 3, 4].map(i => isoDate(daysFromNow(i)));
    const shiftRows: schema.InsertProductionShift[] = [];
    for (const wc of [wc1, wc2]) {
      for (const date of dates) {
        shiftRows.push({
          workCenterId: wc.id,
          date,
          shiftName: "Manhã",
          startTime: "07:00",
          endTime: "15:00",
          availableHours: "8.00",
          isBlocked: false,
        });
      }
    }
    await db.insert(schema.productionShiftsTable).values(shiftRows).onConflictDoNothing();

    if (op2) {
      await db.insert(schema.apsScheduleTable).values([
        {
          productionOrderId: op2.id,
          workCenterId: wc2.id,
          orderNumber: "OP-2024-002",
          productName: "Complexo Vitamínico D",
          plannedQty: "150.000",
          unit: "kg",
          scheduledStart: isoDate(daysAgo(1)) + "T07:00",
          scheduledEnd: isoDate(daysFromNow(2)) + "T15:00",
          estimatedHours: "16.00",
          status: "in_progress",
          priority: 1,
          sequenceNumber: 1,
          notes: "Envase em andamento",
        },
        ...(op1 ? [{
          productionOrderId: op1.id,
          workCenterId: wc1.id,
          orderNumber: "OP-2024-001",
          productName: "Vitamina C 500mg",
          plannedQty: "200.000",
          unit: "kg",
          scheduledStart: isoDate(daysAgo(30)) + "T07:00",
          scheduledEnd: isoDate(daysAgo(28)) + "T15:00",
          estimatedHours: "16.00",
          status: "done",
          priority: 1,
          sequenceNumber: 1,
          notes: "Concluído",
        }] : []),
      ]).onConflictDoNothing();
    }
  }

  // ── 28. DASHBOARD GOALS ─────────────────────────────────────────────────────
  console.log("🎯  Inserindo metas do dashboard...");
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const prevMonth = thisMonth === 1 ? 12 : thisMonth - 1;
  const prevYear = thisMonth === 1 ? thisYear - 1 : thisYear;
  await db.insert(schema.dashboardGoalsTable).values([
    {
      year: prevYear,
      month: prevMonth,
      revenueGoal: "45000.00",
      expenseGoal: "32000.00",
      salesOrdersGoal: 8,
    },
    {
      year: thisYear,
      month: thisMonth,
      revenueGoal: "55000.00",
      expenseGoal: "38000.00",
      salesOrdersGoal: 10,
    },
  ]).onConflictDoNothing();

  console.log("\n✅  Seed concluído com sucesso!");
  console.log("──────────────────────────────────────────────────────────────");
  console.log("📦  Produtos   : 6  (4 MP + 2 PA)");
  console.log("🏭  Fornecedores: 3");
  console.log("🤝  Clientes   : 3");
  console.log("🏷️  Lotes      : 7  (5 MP + 2 PA)");
  console.log("⚙️   OPs        : 2  (OP-2024-001 finalizada, OP-2024-002 em produção)");
  console.log("🛒  Ped. Venda : 3  (PV-001 entregue, PV-002 em produção, PV-003 orçamento)");
  console.log("🛍️   Ped. Compra: 3  (PC-001/002 recebidos, PC-003 enviado)");
  console.log("💰  Financeiro : 10 lançamentos");
  console.log("📄  Fiscal     : 4  documentos");
  console.log("👷  Funcionários: 5");
  console.log("🔬  Inspeções  : 2  | Análises CQ: 2  | NCR: 1 com CAPA");
  console.log("📁  Projetos   : 2  (8 tarefas)");
  console.log("📆  APS        : 2 centros de trabalho, turnos e programação");
  console.log("──────────────────────────────────────────────────────────────");
  console.log("🔗  Rastreabilidade: LOT-AA-2024-001 → OP-2024-001 → LOT-VCA-2024-001 → PV-2024-001 → NF 000001");
}

// Run automatically only when executed directly (standalone script)
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  seed()
    .catch((err) => {
      console.error("❌  Seed falhou:", err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
