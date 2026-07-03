import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const carriersTable = pgTable("carriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document"), // CNPJ/CPF
  phone: text("phone"),
  email: text("email"),
  active: text("active").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCarrierSchema = createInsertSchema(carriersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCarrier = z.infer<typeof insertCarrierSchema>;
export type Carrier = typeof carriersTable.$inferSelect;
