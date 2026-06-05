import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const companySettingsTable = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default("NEXUS ERP"),
  logoBase64: text("logo_base64"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CompanySettings = typeof companySettingsTable.$inferSelect;
export type InsertCompanySettings = typeof companySettingsTable.$inferInsert;
