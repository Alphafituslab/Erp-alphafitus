import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  document: text("document"), // CPF or CNPJ
  stateRegistration: text("state_registration"),
  email: text("email"),
  phone: text("phone"),
  // Billing address
  billingZipCode: text("billing_zip_code"),
  billingStreet: text("billing_street"),
  billingNumber: text("billing_number"),
  billingComplement: text("billing_complement"),
  billingNeighborhood: text("billing_neighborhood"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  // Shipping address
  shippingZipCode: text("shipping_zip_code"),
  shippingStreet: text("shipping_street"),
  shippingNumber: text("shipping_number"),
  shippingComplement: text("shipping_complement"),
  shippingNeighborhood: text("shipping_neighborhood"),
  shippingCity: text("shipping_city"),
  shippingState: text("shipping_state"),
  // Contact
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  // Commercial
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }),
  defaultDiscountPct: numeric("default_discount_pct", { precision: 5, scale: 2 }),
  taxRegime: text("tax_regime"), // simples | presumido | real | mei
  // Preferred price table (shared or exclusive) and payment term for this client.
  // Plain FK (no cross-file .references()) to avoid a circular import with price-tables.ts / payment-terms.ts.
  defaultPriceTableId: integer("default_price_table_id"),
  defaultPaymentTermId: integer("default_payment_term_id"),
  // Legacy / misc
  address: text("address"),
  city: text("city"),
  state: text("state"),
  notes: text("notes"),
  active: text("active").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
