import { pgTable, text, serial, timestamp, integer, numeric, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const priceTablesTable = pgTable("price_tables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  // When set, this table is exclusive to a single client. When null, it's a shared/reusable table.
  clientId: integer("client_id").references(() => clientsTable.id),
  active: text("active").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const priceTableItemsTable = pgTable("price_table_items", {
  id: serial("id").primaryKey(),
  priceTableId: integer("price_table_id").notNull().references(() => priceTablesTable.id),
  productId: integer("product_id").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueProduct: unique().on(t.priceTableId, t.productId),
}));

export const priceTablesRelations = relations(priceTablesTable, ({ one, many }) => ({
  client: one(clientsTable, {
    fields: [priceTablesTable.clientId],
    references: [clientsTable.id],
  }),
  items: many(priceTableItemsTable),
}));

export const priceTableItemsRelations = relations(priceTableItemsTable, ({ one }) => ({
  priceTable: one(priceTablesTable, {
    fields: [priceTableItemsTable.priceTableId],
    references: [priceTablesTable.id],
  }),
}));

export const insertPriceTableSchema = createInsertSchema(priceTablesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPriceTable = z.infer<typeof insertPriceTableSchema>;
export type PriceTable = typeof priceTablesTable.$inferSelect;

export const insertPriceTableItemSchema = createInsertSchema(priceTableItemsTable).omit({ id: true, createdAt: true });
export type InsertPriceTableItem = z.infer<typeof insertPriceTableItemSchema>;
export type PriceTableItem = typeof priceTableItemsTable.$inferSelect;
