import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  document: text("document"), // CNPJ
  stateRegistration: text("state_registration"),
  municipalRegistration: text("municipal_registration"),
  email: text("email"),
  phone: text("phone"),
  // Address (legacy single-line, kept for backward compat)
  address: text("address"),
  // Address (structured)
  zipCode: text("zip_code"),
  street: text("street"),
  addressNumber: text("address_number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  // Contact person
  contactName: text("contact_name"),
  contactRole: text("contact_role"),
  contactPhone: text("contact_phone"),
  // Banking
  bankName: text("bank_name"),
  bankAgency: text("bank_agency"),
  bankAccount: text("bank_account"),
  bankAccountType: text("bank_account_type"), // corrente | poupanca
  // Legacy/misc
  category: text("category"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  active: text("active").notNull().default("true"),
  approvalStatus: text("approval_status").notNull().default("approved"), // approved | pending | blocked
  qualificationStatus: text("qualification_status"), // qualified | in_process | not_qualified
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
