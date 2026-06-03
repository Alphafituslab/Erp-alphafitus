import { pgTable, text, serial, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { productionOrdersTable } from "./production";
import { z } from "zod/v4";

// ─── Centros de Trabalho ──────────────────────────────────────────────────────

export const workCentersTable = pgTable("work_centers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("machine"), // machine | work_center | line
  capacityHoursPerShift: numeric("capacity_hours_per_shift", { precision: 6, scale: 2 }).notNull().default("8"),
  setupTimeMinutes: integer("setup_time_minutes").notNull().default(30),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Turnos por Centro de Trabalho ────────────────────────────────────────────

export const productionShiftsTable = pgTable("production_shifts", {
  id: serial("id").primaryKey(),
  workCenterId: integer("work_center_id").notNull().references(() => workCentersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  shiftName: text("shift_name").notNull().default("Manhã"), // Manhã | Tarde | Noite | Extra
  startTime: text("start_time").notNull().default("07:00"), // HH:MM
  endTime: text("end_time").notNull().default("15:00"), // HH:MM
  availableHours: numeric("available_hours", { precision: 5, scale: 2 }).notNull().default("8"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockReason: text("block_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Programação APS ──────────────────────────────────────────────────────────

export const apsScheduleTable = pgTable("aps_schedule", {
  id: serial("id").primaryKey(),
  productionOrderId: integer("production_order_id").references(() => productionOrdersTable.id, { onDelete: "set null" }),
  workCenterId: integer("work_center_id").notNull().references(() => workCentersTable.id),
  // Order details snapshot (for display without join)
  orderNumber: text("order_number"),
  productName: text("product_name"),
  plannedQty: numeric("planned_qty", { precision: 12, scale: 3 }),
  unit: text("unit").notNull().default("kg"),
  // Scheduling fields
  scheduledStart: text("scheduled_start").notNull(), // ISO date-time YYYY-MM-DDTHH:MM
  scheduledEnd: text("scheduled_end").notNull(),
  estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
  status: text("status").notNull().default("planned"), // planned | in_progress | done | delayed | cancelled
  priority: integer("priority").notNull().default(5), // 1=highest … 10=lowest
  sequenceNumber: integer("sequence_number"),
  notes: text("notes"),
  // Reprogramming audit
  rescheduledAt: timestamp("rescheduled_at", { withTimezone: true }),
  rescheduledBy: text("rescheduled_by"),
  rescheduledReason: text("rescheduled_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const workCentersRelations = relations(workCentersTable, ({ many }) => ({
  shifts: many(productionShiftsTable),
  scheduleEntries: many(apsScheduleTable),
}));

export const productionShiftsRelations = relations(productionShiftsTable, ({ one }) => ({
  workCenter: one(workCentersTable, {
    fields: [productionShiftsTable.workCenterId],
    references: [workCentersTable.id],
  }),
}));

export const apsScheduleRelations = relations(apsScheduleTable, ({ one }) => ({
  workCenter: one(workCentersTable, {
    fields: [apsScheduleTable.workCenterId],
    references: [workCentersTable.id],
  }),
  productionOrder: one(productionOrdersTable, {
    fields: [apsScheduleTable.productionOrderId],
    references: [productionOrdersTable.id],
  }),
}));

// ─── Insert schemas & types ────────────────────────────────────────────────────

export const insertWorkCenterSchema = createInsertSchema(workCentersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkCenter = z.infer<typeof insertWorkCenterSchema>;
export type WorkCenter = typeof workCentersTable.$inferSelect;

export const insertProductionShiftSchema = createInsertSchema(productionShiftsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductionShift = z.infer<typeof insertProductionShiftSchema>;
export type ProductionShift = typeof productionShiftsTable.$inferSelect;

export const insertApsScheduleSchema = createInsertSchema(apsScheduleTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApsSchedule = z.infer<typeof insertApsScheduleSchema>;
export type ApsSchedule = typeof apsScheduleTable.$inferSelect;
