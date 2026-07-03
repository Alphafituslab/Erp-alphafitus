import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentTermsTable = pgTable("payment_terms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g. "30/60/90 dias"
  description: text("description"),
  active: text("active").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentTermSchema = createInsertSchema(paymentTermsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentTerm = z.infer<typeof insertPaymentTermSchema>;
export type PaymentTerm = typeof paymentTermsTable.$inferSelect;
