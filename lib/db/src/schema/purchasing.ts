import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { suppliersTable } from "./suppliers";
import { z } from "zod/v4";

export const purchaseRequestsTable = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  productId: integer("product_id"),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
  unit: text("unit").notNull().default("un"),
  priority: text("priority").notNull().default("normal"), // normal | urgent | critical
  status: text("status").notNull().default("pending"), // pending | approved | rejected | converted
  purchaseOrderId: integer("purchase_order_id"),
  requestedById: integer("requested_by_id"),
  approvedById: integer("approved_by_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseRequest = z.infer<typeof insertPurchaseRequestSchema>;
export type PurchaseRequest = typeof purchaseRequestsTable.$inferSelect;

export const quotationsTable = pgTable("quotations", {
  id: serial("id").primaryKey(),
  purchaseRequestId: integer("purchase_request_id"),
  title: text("title").notNull(),
  status: text("status").notNull().default("open"), // open | closed | cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const quotationItemsTable = pgTable("quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => quotationsTable.id),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id),
  productId: integer("product_id"),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  deliveryDays: integer("delivery_days"),
  notes: text("notes"),
  selected: text("selected").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quotationsRelations = relations(quotationsTable, ({ many }) => ({
  items: many(quotationItemsTable),
}));

export const quotationItemsRelations = relations(quotationItemsTable, ({ one }) => ({
  quotation: one(quotationsTable, {
    fields: [quotationItemsTable.quotationId],
    references: [quotationsTable.id],
  }),
  supplier: one(suppliersTable, {
    fields: [quotationItemsTable.supplierId],
    references: [suppliersTable.id],
  }),
}));

export const insertQuotationSchema = createInsertSchema(quotationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type Quotation = typeof quotationsTable.$inferSelect;

export const insertQuotationItemSchema = createInsertSchema(quotationItemsTable).omit({ id: true, createdAt: true });
export type InsertQuotationItem = z.infer<typeof insertQuotationItemSchema>;
export type QuotationItem = typeof quotationItemsTable.$inferSelect;
