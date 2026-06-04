import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fiscalDocumentsTable = pgTable("fiscal_documents", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "nfe" | "nfse" | "nf_entrada"
  direction: text("direction").notNull().default("saida"), // "entrada" | "saida"
  number: text("number"),
  emitter: text("emitter").notNull(),
  recipient: text("recipient").notNull(),
  emitterDocument: text("emitter_document"),
  recipientDocument: text("recipient_document"),
  issueDate: timestamp("issue_date", { withTimezone: true }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  cfop: text("cfop"),
  icmsAmount: numeric("icms_amount", { precision: 12, scale: 2 }).default("0"),
  pisAmount: numeric("pis_amount", { precision: 12, scale: 2 }).default("0"),
  cofinsAmount: numeric("cofins_amount", { precision: 12, scale: 2 }).default("0"),
  issAmount: numeric("iss_amount", { precision: 12, scale: 2 }).default("0"),
  status: text("status").notNull().default("issued"), // issued | cancelled
  referenceOrderId: text("reference_order_id"),
  notes: text("notes"),
  accessKey: text("access_key"), // chave de acesso NF-e (44 dígitos)
  xmlContent: text("xml_content"), // XML original da NF-e
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFiscalDocumentSchema = createInsertSchema(fiscalDocumentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFiscalDocument = z.infer<typeof insertFiscalDocumentSchema>;
export type FiscalDocument = typeof fiscalDocumentsTable.$inferSelect;
