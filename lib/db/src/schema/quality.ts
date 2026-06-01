import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { productsTable } from "./products";
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

export const insertQualityInspectionSchema = createInsertSchema(qualityInspectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQualityInspection = z.infer<typeof insertQualityInspectionSchema>;
export type QualityInspection = typeof qualityInspectionsTable.$inferSelect;

export const insertQualityNcrSchema = createInsertSchema(qualityNcrsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQualityNcr = z.infer<typeof insertQualityNcrSchema>;
export type QualityNcr = typeof qualityNcrsTable.$inferSelect;
