import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { productsTable } from "./products";
import { productLotsTable } from "./lots";
import { z } from "zod/v4";

export const qualityInspectionsTable = pgTable("quality_inspections", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => productsTable.id),
  productName: text("product_name"), // denormalized snapshot for history
  batchNumber: text("batch_number"),
  inspectionDate: text("inspection_date").notNull(), // YYYY-MM-DD
  inspector: text("inspector").notNull(),
  result: text("result").notNull().default("approved"), // approved | rejected | conditional
  quantityInspected: integer("quantity_inspected").notNull().default(0),
  quantityFailed: integer("quantity_failed").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const qualityNcrsTable = pgTable("quality_ncrs", {
  id: serial("id").primaryKey(),
  inspectionId: integer("inspection_id").references(() => qualityInspectionsTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  productName: text("product_name"),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"), // low | medium | high | critical
  // CAPA workflow status: open | investigation | action_plan | execution | effectiveness_check | closed | in_progress | resolved
  status: text("status").notNull().default("open"),
  rootCause: text("root_cause"),
  correctiveAction: text("corrective_action"),
  reportedBy: text("reported_by"),
  assignedTo: text("assigned_to"),
  dueDate: text("due_date"), // YYYY-MM-DD
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  // CAPA-specific fields
  ncType: text("nc_type"), // receiving | production | finished_goods | customer | other
  origin: text("origin"), // free-text module origin
  whyAnalysis: text("why_analysis"), // JSON: string[] — 5-porquês
  ishikawaCategories: text("ishikawa_categories"), // JSON: {mao_de_obra, maquina, metodo, material, meio_ambiente, medicao}
  investigatedBy: text("investigated_by"),
  investigatedAt: timestamp("investigated_at", { withTimezone: true }),
  actionPlanApprovedAt: timestamp("action_plan_approved_at", { withTimezone: true }),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verificationNotes: text("verification_notes"),
  closedBy: text("closed_by"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const capaActionsTable = pgTable("capa_actions", {
  id: serial("id").primaryKey(),
  ncrId: integer("ncr_id").notNull().references(() => qualityNcrsTable.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull().default("corrective"), // corrective | preventive
  description: text("description").notNull(),
  responsible: text("responsible"),
  dueDate: text("due_date"), // YYYY-MM-DD
  completedAt: timestamp("completed_at", { withTimezone: true }),
  evidence: text("evidence"), // description of evidence / link
  status: text("status").notNull().default("pending"), // pending | in_progress | done | overdue
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const capaEvidencesTable = pgTable("capa_evidences", {
  id: serial("id").primaryKey(),
  capaActionId: integer("capa_action_id").notNull().references(() => capaActionsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  fileSizeBytes: integer("file_size_bytes"),
  fileData: text("file_data").notNull(), // base64-encoded content
  uploadedBy: text("uploaded_by"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Quality Analyses ──────────────────────────────────────────────────────────

export const qualityAnalysesTable = pgTable("quality_analyses", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").references(() => productLotsTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  productName: text("product_name"), // snapshot
  internalLot: text("internal_lot"), // snapshot of lot.internalLot
  sampleCode: text("sample_code").notNull(),
  analysisType: text("analysis_type").notNull().default("physical_chemical"), // physical_chemical | microbiological | organoleptic | full
  analystName: text("analyst_name").notNull(),
  reviewerName: text("reviewer_name"),
  status: text("status").notNull().default("pending"), // pending | in_analysis | approved | rejected
  notes: text("notes"),
  justification: text("justification"), // filled on approve/reject
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const analysisParametersTable = pgTable("analysis_parameters", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull().references(() => qualityAnalysesTable.id, { onDelete: "cascade" }),
  parameterName: text("parameter_name").notNull(),
  specification: text("specification"), // e.g. "97.0% - 103.0%"
  minValue: text("min_value"),
  maxValue: text("max_value"),
  resultValue: text("result_value"),
  unit: text("unit"), // e.g. "%", "mg/g", "UFC/g"
  isConforming: boolean("is_conforming"), // null=pending, true=ok, false=fail
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const qualityCertificatesTable = pgTable("quality_certificates", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").references(() => qualityAnalysesTable.id),
  certificateNumber: text("certificate_number").notNull(),
  sampleCode: text("sample_code").notNull(),
  productId: integer("product_id").references(() => productsTable.id),
  productName: text("product_name"),
  internalLot: text("internal_lot"),
  analysisType: text("analysis_type").notNull(),
  result: text("result").notNull(), // 'approved' | 'rejected'
  analystName: text("analyst_name").notNull(),
  reviewerName: text("reviewer_name"),
  justification: text("justification"),
  parametersSnapshot: text("parameters_snapshot"), // JSON string snapshot
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const qualityInspectionsRelations = relations(qualityInspectionsTable, ({ one, many }) => ({
  product: one(productsTable, {
    fields: [qualityInspectionsTable.productId],
    references: [productsTable.id],
  }),
  ncrs: many(qualityNcrsTable),
}));

export const qualityNcrsRelations = relations(qualityNcrsTable, ({ one, many }) => ({
  inspection: one(qualityInspectionsTable, {
    fields: [qualityNcrsTable.inspectionId],
    references: [qualityInspectionsTable.id],
  }),
  product: one(productsTable, {
    fields: [qualityNcrsTable.productId],
    references: [productsTable.id],
  }),
  capaActions: many(capaActionsTable),
}));

export const capaActionsRelations = relations(capaActionsTable, ({ one, many }) => ({
  ncr: one(qualityNcrsTable, {
    fields: [capaActionsTable.ncrId],
    references: [qualityNcrsTable.id],
  }),
  evidences: many(capaEvidencesTable),
}));

export const capaEvidencesRelations = relations(capaEvidencesTable, ({ one }) => ({
  capaAction: one(capaActionsTable, {
    fields: [capaEvidencesTable.capaActionId],
    references: [capaActionsTable.id],
  }),
}));

export const qualityAnalysesRelations = relations(qualityAnalysesTable, ({ one, many }) => ({
  lot: one(productLotsTable, {
    fields: [qualityAnalysesTable.lotId],
    references: [productLotsTable.id],
  }),
  product: one(productsTable, {
    fields: [qualityAnalysesTable.productId],
    references: [productsTable.id],
  }),
  parameters: many(analysisParametersTable),
}));

export const analysisParametersRelations = relations(analysisParametersTable, ({ one }) => ({
  analysis: one(qualityAnalysesTable, {
    fields: [analysisParametersTable.analysisId],
    references: [qualityAnalysesTable.id],
  }),
}));

// ─── Insert schemas & types ────────────────────────────────────────────────────

export const insertQualityInspectionSchema = createInsertSchema(qualityInspectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQualityInspection = z.infer<typeof insertQualityInspectionSchema>;
export type QualityInspection = typeof qualityInspectionsTable.$inferSelect;

export const insertQualityNcrSchema = createInsertSchema(qualityNcrsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQualityNcr = z.infer<typeof insertQualityNcrSchema>;
export type QualityNcr = typeof qualityNcrsTable.$inferSelect;

export const insertCapaActionSchema = createInsertSchema(capaActionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCapaAction = z.infer<typeof insertCapaActionSchema>;
export type CapaAction = typeof capaActionsTable.$inferSelect;

export const insertCapaEvidenceSchema = createInsertSchema(capaEvidencesTable).omit({ id: true, uploadedAt: true });
export type InsertCapaEvidence = z.infer<typeof insertCapaEvidenceSchema>;
export type CapaEvidence = typeof capaEvidencesTable.$inferSelect;

export const insertQualityAnalysisSchema = createInsertSchema(qualityAnalysesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQualityAnalysis = z.infer<typeof insertQualityAnalysisSchema>;
export type QualityAnalysis = typeof qualityAnalysesTable.$inferSelect;

export const insertAnalysisParameterSchema = createInsertSchema(analysisParametersTable).omit({ id: true, createdAt: true });
export type InsertAnalysisParameter = z.infer<typeof insertAnalysisParameterSchema>;
export type AnalysisParameter = typeof analysisParametersTable.$inferSelect;

export const insertQualityCertificateSchema = createInsertSchema(qualityCertificatesTable).omit({ id: true, createdAt: true });
export type InsertQualityCertificate = z.infer<typeof insertQualityCertificateSchema>;
export type QualityCertificate = typeof qualityCertificatesTable.$inferSelect;
