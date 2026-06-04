import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const backupLogsTable = pgTable("backup_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  filename: text("filename").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BackupLog = typeof backupLogsTable.$inferSelect;
