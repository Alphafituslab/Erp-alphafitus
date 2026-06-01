import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { productsTable } from "./products";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Depósitos / Warehouses ────────────────────────────────────────────────────

export const warehousesTable = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  active: text("active").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWarehouseSchema = createInsertSchema(warehousesTable).omit({ id: true, createdAt: true });
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type Warehouse = typeof warehousesTable.$inferSelect;

// ─── Lotes de Produto / Product Lots ──────────────────────────────────────────

export const productLotsTable = pgTable("product_lots", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  internalLot: text("internal_lot").notNull().unique(), // gerado pelo ERP
  supplierLot: text("supplier_lot"),                    // lote do fornecedor (NF)
  warehouseId: integer("warehouse_id").references(() => warehousesTable.id),
  manufacturingDate: text("manufacturing_date"),        // ISO date string yyyy-mm-dd
  expirationDate: text("expiration_date"),              // ISO date string yyyy-mm-dd
  // CQ Status: quarantine (default on entry), approved, rejected, blocked
  cqStatus: text("cq_status").notNull().default("quarantine"),
  totalQty: integer("total_qty").notNull().default(0),
  availableQty: integer("available_qty").notNull().default(0),
  reservedQty: integer("reserved_qty").notNull().default(0),
  blockedQty: integer("blocked_qty").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const productLotsRelations = relations(productLotsTable, ({ one, many }) => ({
  product: one(productsTable, {
    fields: [productLotsTable.productId],
    references: [productsTable.id],
  }),
  warehouse: one(warehousesTable, {
    fields: [productLotsTable.warehouseId],
    references: [warehousesTable.id],
  }),
  movements: many(lotMovementsTable),
}));

export const insertProductLotSchema = createInsertSchema(productLotsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductLot = z.infer<typeof insertProductLotSchema>;
export type ProductLot = typeof productLotsTable.$inferSelect;

// ─── Movimentações de Lote / Lot Movements (rastreabilidade) ──────────────────

export const lotMovementsTable = pgTable("lot_movements", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull().references(() => productLotsTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  warehouseId: integer("warehouse_id").references(() => warehousesTable.id),
  toWarehouseId: integer("to_warehouse_id").references(() => warehousesTable.id),
  // type: input | output | transfer | adjustment
  type: text("type").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  notes: text("notes"),
  userId: integer("user_id"),
  referenceId: integer("reference_id"),
  referenceType: text("reference_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lotMovementsRelations = relations(lotMovementsTable, ({ one }) => ({
  lot: one(productLotsTable, {
    fields: [lotMovementsTable.lotId],
    references: [productLotsTable.id],
  }),
  product: one(productsTable, {
    fields: [lotMovementsTable.productId],
    references: [productsTable.id],
  }),
  warehouse: one(warehousesTable, {
    fields: [lotMovementsTable.warehouseId],
    references: [warehousesTable.id],
  }),
}));

export const insertLotMovementSchema = createInsertSchema(lotMovementsTable).omit({ id: true, createdAt: true });
export type InsertLotMovement = z.infer<typeof insertLotMovementSchema>;
export type LotMovement = typeof lotMovementsTable.$inferSelect;
