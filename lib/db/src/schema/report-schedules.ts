import {
  pgTable,
  serial,
  timestamp,
  integer,
  text,
  boolean,
} from "drizzle-orm/pg-core";

export const reportSchedulesTable = pgTable("report_schedules", {
  id: serial("id").primaryKey(),
  frequency: text("frequency", { enum: ["weekly", "monthly"] }).notNull(),
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"),
  hour: integer("hour").notNull().default(8),
  minute: integer("minute").notNull().default(0),
  period: text("period", {
    enum: ["this_month", "last_month", "this_quarter", "this_year"],
  })
    .notNull()
    .default("last_month"),
  recipients: text("recipients").notNull(),
  subject: text("subject").notNull(),
  message: text("message"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const reportSendLogsTable = pgTable("report_send_logs", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id").references(() => reportSchedulesTable.id, {
    onDelete: "set null",
  }),
  triggerType: text("trigger_type", { enum: ["manual", "scheduled"] })
    .notNull()
    .default("manual"),
  period: text("period").notNull(),
  periodLabel: text("period_label").notNull(),
  recipients: text("recipients").notNull(),
  status: text("status", { enum: ["success", "error"] }).notNull(),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReportSchedule = typeof reportSchedulesTable.$inferSelect;
export type InsertReportSchedule = typeof reportSchedulesTable.$inferInsert;
export type ReportSendLog = typeof reportSendLogsTable.$inferSelect;
export type InsertReportSendLog = typeof reportSendLogsTable.$inferInsert;
