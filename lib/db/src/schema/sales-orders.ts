import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { clientsTable } from "./clients";
import { z } from "zod/v4";

export const salesOrdersTable = pgTable("sales_orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clientsTable.id),
  type: text("type").notNull().default("order"), // "quote" | "order"
  status: text("status").notNull().default("draft"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  deliveryDate: timestamp("delivery_date", { withTimezone: true }),
  notes: text("notes"),
  // Commercial fields
  paymentTerms: text("payment_terms"),
  paymentTermId: integer("payment_term_id"),
  paymentMethod: text("payment_method"), // dinheiro | cartao | boleto | pix | pix_boleto
  priceTableId: integer("price_table_id"),
  salespersonId: integer("salesperson_id"),
  commission: numeric("commission", { precision: 5, scale: 2 }),
  commissionReduced: text("commission_reduced").notNull().default("false"), // "true" when any item sold below price-table price
  freightValue: numeric("freight_value", { precision: 12, scale: 2 }),
  freightType: text("freight_type"), // CIF | FOB
  carrier: text("carrier"),
  carrierId: integer("carrier_id"),
  // Product/formula fields
  formula: text("formula"),
  // Internal notes
  technicalNotes: text("technical_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const salesOrdersRelations = relations(salesOrdersTable, ({ one, many }) => ({
  client: one(clientsTable, {
    fields: [salesOrdersTable.clientId],
    references: [clientsTable.id],
  }),
  logs: many(salesOrderLogsTable),
}));

export const insertSalesOrderSchema = createInsertSchema(salesOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesOrder = z.infer<typeof insertSalesOrderSchema>;
export type SalesOrder = typeof salesOrdersTable.$inferSelect;

export const salesOrderItemsTable = pgTable("sales_order_items", {
  id: serial("id").primaryKey(),
  salesOrderId: integer("sales_order_id").notNull().references(() => salesOrdersTable.id),
  productId: integer("product_id"),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  billedQty: numeric("billed_qty", { precision: 12, scale: 3 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSalesOrderItemSchema = createInsertSchema(salesOrderItemsTable).omit({ id: true, createdAt: true });
export type InsertSalesOrderItem = z.infer<typeof insertSalesOrderItemSchema>;
export type SalesOrderItem = typeof salesOrderItemsTable.$inferSelect;

export const salesOrderLogsTable = pgTable("sales_order_logs", {
  id: serial("id").primaryKey(),
  salesOrderId: integer("sales_order_id").notNull().references(() => salesOrdersTable.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  userId: integer("user_id"),
  userName: text("user_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salesOrderLogsRelations = relations(salesOrderLogsTable, ({ one }) => ({
  order: one(salesOrdersTable, {
    fields: [salesOrderLogsTable.salesOrderId],
    references: [salesOrdersTable.id],
  }),
}));

export type SalesOrderLog = typeof salesOrderLogsTable.$inferSelect;
