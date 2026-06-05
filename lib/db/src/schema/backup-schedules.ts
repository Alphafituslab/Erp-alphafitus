import { pgTable, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const backupSchedulesTable = pgTable("backup_schedules", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  hour: integer("hour").notNull().default(2),
  minute: integer("minute").notNull().default(0),
  retentionDays: integer("retention_days").notNull().default(7),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => usersTable.id),
});

export type BackupSchedule = typeof backupSchedulesTable.$inferSelect;
