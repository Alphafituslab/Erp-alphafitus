import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const smtpSettingsTable = pgTable("smtp_settings", {
  id: serial("id").primaryKey(),
  host: text("host"),
  port: integer("port").default(587),
  user: text("user"),
  pass: text("pass"),
  from: text("from"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type SmtpSettings = typeof smtpSettingsTable.$inferSelect;
export type InsertSmtpSettings = typeof smtpSettingsTable.$inferInsert;
