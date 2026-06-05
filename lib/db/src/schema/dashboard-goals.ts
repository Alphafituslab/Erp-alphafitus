import { pgTable, serial, timestamp, numeric, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dashboardGoalsTable = pgTable(
  "dashboard_goals",
  {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    revenueGoal: numeric("revenue_goal", { precision: 15, scale: 2 }).notNull().default("0"),
    expenseGoal: numeric("expense_goal", { precision: 15, scale: 2 }).notNull().default("0"),
    salesOrdersGoal: integer("sales_orders_goal").notNull().default(0),
    updatedBy: integer("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [unique("dashboard_goals_year_month_unique").on(t.year, t.month)]
);

export const insertDashboardGoalSchema = createInsertSchema(dashboardGoalsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDashboardGoal = z.infer<typeof insertDashboardGoalSchema>;
export type DashboardGoal = typeof dashboardGoalsTable.$inferSelect;
