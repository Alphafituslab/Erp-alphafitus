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
  status: text("status").notNull().default("open"), // open | in_progress | resolved | closed
  rootCause: text("root_cause"),
  correctiveAction: text("corrective_action"),
  reportedBy: text("reported_by"),
  assignedTo: text("assigned_to"),
  dueDate: text("due_date"), // YYYY-MM-DD
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
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

// ─── Relations ────────────────────────────────────────────────────────────────

export const qualityInspectionsRelations = relations(qualityInspectionsTable, ({ one, many }) => ({
  product: one(productsTable, {
    fields: [qualityInspectionsTable.productId],
    references: [productsTable.id],
  }),
  ncrs: many(qualityNcrsTable),
}));

export const qualityNcrsRelations = relations(qualityNcrsTable, ({ one }) => ({
  inspection: one(qualityInspectionsTable, {
    fields: [qualityNcrsTable.inspectionId],
    references: [qualityInspectionsTable.id],
  }),
  product: one(productsTable, {
    fields: [qualityNcrsTable.productId],
    references: [productsTable.id],
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

export const insertQualityAnalysisSchema = createInsertSchema(qualityAnalysesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQualityAnalysis = z.infer<typeof insertQualityAnalysisSchema>;
export type QualityAnalysis = typeof qualityAnalysesTable.$inferSelect;

export const insertAnalysisParameterSchema = createInsertSchema(analysisParametersTable).omit({ id: true, createdAt: true });
export type InsertAnalysisParameter = z.infer<typeof insertAnalysisParameterSchema>;
export type AnalysisParameter = typeof analysisParametersTable.$inferSelect;
