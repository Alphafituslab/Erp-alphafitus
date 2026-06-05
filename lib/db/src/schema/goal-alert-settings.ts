import { pgTable, serial, boolean, integer, timestamp, text, json } from "drizzle-orm/pg-core";

export const goalAlertSettingsTable = pgTable("goal_alert_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  notifyHour: integer("notify_hour").notNull().default(8),
  notifyMinute: integer("notify_minute").notNull().default(0),
  progressThreshold: integer("progress_threshold").notNull().default(70),
  daysRemainingThreshold: integer("days_remaining_threshold").notNull().default(15),
  customRecipients: text("custom_recipients"),
  lastSentDate: text("last_sent_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type GoalAlertSettings = typeof goalAlertSettingsTable.$inferSelect;
export type InsertGoalAlertSettings = typeof goalAlertSettingsTable.$inferInsert;

export type GoalAlertLogEntry = {
  kpi: string;
  label: string;
  progress: number;
  daysRemaining: number;
  actual: string;
  goal: string;
};

export const goalAlertLogsTable = pgTable("goal_alert_logs", {
  id: serial("id").primaryKey(),
  monthLabel: text("month_label").notNull(),
  recipients: text("recipients").notNull(),
  alertCount: integer("alert_count").notNull(),
  alerts: json("alerts").$type<GoalAlertLogEntry[]>().notNull(),
  status: text("status", { enum: ["success", "error"] }).notNull(),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GoalAlertLog = typeof goalAlertLogsTable.$inferSelect;
export type InsertGoalAlertLog = typeof goalAlertLogsTable.$inferInsert;
