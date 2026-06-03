import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { productsTable } from "./products";
import { productLotsTable } from "./lots";
import { salesOrdersTable } from "./sales-orders";
import { z } from "zod/v4";

// ─── Fórmulas ──────────────────────────────────────────────────────────────────

export const formulasTable = pgTable("formulas", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => productsTable.id),
  productName: text("product_name").notNull(),
  version: text("version").notNull().default("1.0"),
  status: text("status").notNull().default("draft"), // draft | approved | obsolete
  batchYield: numeric("batch_yield", { precision: 12, scale: 3 }).notNull().default("0"),
  unit: text("unit").notNull().default("kg"),
  notes: text("notes"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const formulaItemsTable = pgTable("formula_items", {
  id: serial("id").primaryKey(),
  formulaId: integer("formula_id").notNull().references(() => formulasTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id),
  productName: text("product_name").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
  unit: text("unit").notNull().default("kg"),
  function: text("function"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Ordens de Produção ────────────────────────────────────────────────────────

export const productionOrdersTable = pgTable("production_orders", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  formulaId: integer("formula_id").references(() => formulasTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  productName: text("product_name").notNull(),
  formulaVersion: text("formula_version"),
  batchLot: text("batch_lot"),
  plannedQty: numeric("planned_qty", { precision: 12, scale: 3 }).notNull(),
  actualQty: numeric("actual_qty", { precision: 12, scale: 3 }),
  unit: text("unit").notNull().default("kg"),
  // planned | released | in_production | quality_check | finished | cancelled
  status: text("status").notNull().default("planned"),
  salesOrderId: integer("sales_order_id").references(() => salesOrdersTable.id),
  scheduledStart: text("scheduled_start"),
  scheduledEnd: text("scheduled_end"),
  actualStart: timestamp("actual_start", { withTimezone: true }),
  actualEnd: timestamp("actual_end", { withTimezone: true }),
  releasedBy: text("released_by"),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Etapas de Produção ────────────────────────────────────────────────────────

export const productionStagesTable = pgTable("production_stages", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => productionOrdersTable.id, { onDelete: "cascade" }),
  stageType: text("stage_type").notNull(), // weighing | mixing | production | packaging
  sequence: integer("sequence").notNull().default(1),
  status: text("status").notNull().default("pending"), // pending | in_progress | done
  operatorId: integer("operator_id"),
  operatorName: text("operator_name"),
  equipment: text("equipment"),
  qtyIn: numeric("qty_in", { precision: 12, scale: 3 }),
  qtyOut: numeric("qty_out", { precision: 12, scale: 3 }),
  yieldPct: numeric("yield_pct", { precision: 5, scale: 2 }),
  losses: numeric("losses", { precision: 12, scale: 3 }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Consumo de Matéria-Prima (rastreabilidade real por lote) ─────────────────

export const productionMaterialConsumptionsTable = pgTable("production_material_consumptions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => productionOrdersTable.id, { onDelete: "cascade" }),
  stageId: integer("stage_id").references(() => productionStagesTable.id, { onDelete: "set null" }),
  formulaItemId: integer("formula_item_id").references(() => formulaItemsTable.id, { onDelete: "set null" }),
  productId: integer("product_id").references(() => productsTable.id),
  productName: text("product_name").notNull(),
  lotId: integer("lot_id").references(() => productLotsTable.id),
  internalLot: text("internal_lot"),
  plannedQty: numeric("planned_qty", { precision: 12, scale: 4 }),
  actualQty: numeric("actual_qty", { precision: 12, scale: 4 }).notNull(),
  unit: text("unit").notNull().default("kg"),
  recordedBy: text("recorded_by"),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const formulasRelations = relations(formulasTable, ({ one, many }) => ({
  product: one(productsTable, {
    fields: [formulasTable.productId],
    references: [productsTable.id],
  }),
  items: many(formulaItemsTable),
  productionOrders: many(productionOrdersTable),
}));

export const formulaItemsRelations = relations(formulaItemsTable, ({ one }) => ({
  formula: one(formulasTable, {
    fields: [formulaItemsTable.formulaId],
    references: [formulasTable.id],
  }),
  product: one(productsTable, {
    fields: [formulaItemsTable.productId],
    references: [productsTable.id],
  }),
}));

export const productionOrdersRelations = relations(productionOrdersTable, ({ one, many }) => ({
  formula: one(formulasTable, {
    fields: [productionOrdersTable.formulaId],
    references: [formulasTable.id],
  }),
  product: one(productsTable, {
    fields: [productionOrdersTable.productId],
    references: [productsTable.id],
  }),
  salesOrder: one(salesOrdersTable, {
    fields: [productionOrdersTable.salesOrderId],
    references: [salesOrdersTable.id],
  }),
  stages: many(productionStagesTable),
}));

export const productionStagesRelations = relations(productionStagesTable, ({ one, many }) => ({
  order: one(productionOrdersTable, {
    fields: [productionStagesTable.orderId],
    references: [productionOrdersTable.id],
  }),
  consumptions: many(productionMaterialConsumptionsTable),
}));

export const productionMaterialConsumptionsRelations = relations(productionMaterialConsumptionsTable, ({ one }) => ({
  order: one(productionOrdersTable, {
    fields: [productionMaterialConsumptionsTable.orderId],
    references: [productionOrdersTable.id],
  }),
  stage: one(productionStagesTable, {
    fields: [productionMaterialConsumptionsTable.stageId],
    references: [productionStagesTable.id],
  }),
  formulaItem: one(formulaItemsTable, {
    fields: [productionMaterialConsumptionsTable.formulaItemId],
    references: [formulaItemsTable.id],
  }),
  product: one(productsTable, {
    fields: [productionMaterialConsumptionsTable.productId],
    references: [productsTable.id],
  }),
  lot: one(productLotsTable, {
    fields: [productionMaterialConsumptionsTable.lotId],
    references: [productLotsTable.id],
  }),
}));

// ─── Insert schemas & types ────────────────────────────────────────────────────

export const insertFormulaSchema = createInsertSchema(formulasTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFormula = z.infer<typeof insertFormulaSchema>;
export type Formula = typeof formulasTable.$inferSelect;

export const insertFormulaItemSchema = createInsertSchema(formulaItemsTable).omit({ id: true, createdAt: true });
export type InsertFormulaItem = z.infer<typeof insertFormulaItemSchema>;
export type FormulaItem = typeof formulaItemsTable.$inferSelect;

export const insertProductionOrderSchema = createInsertSchema(productionOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductionOrder = z.infer<typeof insertProductionOrderSchema>;
export type ProductionOrder = typeof productionOrdersTable.$inferSelect;

export const insertProductionStageSchema = createInsertSchema(productionStagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductionStage = z.infer<typeof insertProductionStageSchema>;
export type ProductionStage = typeof productionStagesTable.$inferSelect;

export const insertProductionMaterialConsumptionSchema = createInsertSchema(productionMaterialConsumptionsTable).omit({ id: true, recordedAt: true });
export type InsertProductionMaterialConsumption = z.infer<typeof insertProductionMaterialConsumptionSchema>;
export type ProductionMaterialConsumption = typeof productionMaterialConsumptionsTable.$inferSelect;
