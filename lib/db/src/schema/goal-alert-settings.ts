import { pgTable, serial, boolean, integer, timestamp, text } from "drizzle-orm/pg-core";

export const goalAlertSettingsTable = pgTable("goal_alert_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  notifyHour: integer("notify_hour").notNull().default(8),
  notifyMinute: integer("notify_minute").notNull().default(0),
  progressThreshold: integer("progress_threshold").notNull().default(70),
  daysRemainingThreshold: integer("days_remaining_threshold").notNull().default(15),
  lastSentDate: text("last_sent_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type GoalAlertSettings = typeof goalAlertSettingsTable.$inferSelect;
export type InsertGoalAlertSettings = typeof goalAlertSettingsTable.$inferInsert;
