import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const departmentsTable = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cpf: text("cpf"),
  email: text("email"),
  phone: text("phone"),
  role: text("role").notNull(),
  department: text("department"),
  hireDate: timestamp("hire_date", { withTimezone: true }),
  salary: numeric("salary", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("active"), // active | inactive
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const attendanceLogsTable = pgTable("attendance_logs", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  checkIn: text("check_in"), // HH:MM
  checkOut: text("check_out"), // HH:MM
  status: text("status").notNull().default("present"), // present | absent | late
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trainingsTable = pgTable("trainings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("mandatory"), // mandatory | optional
  validityMonths: integer("validity_months"), // null = no expiry
  durationHours: integer("duration_hours"), // null = not specified
  targetRole: text("target_role"), // null = all roles
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const employeeTrainingsTable = pgTable("employee_trainings", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  trainingId: integer("training_id").notNull().references(() => trainingsTable.id),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  evidenceUrl: text("evidence_url"),
  status: text("status").notNull().default("not_done"), // up_to_date | expiring_soon | expired | not_done
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit({ id: true, createdAt: true });
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departmentsTable.$inferSelect;

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;

export const insertAttendanceLogSchema = createInsertSchema(attendanceLogsTable).omit({ id: true, createdAt: true });
export type InsertAttendanceLog = z.infer<typeof insertAttendanceLogSchema>;
export type AttendanceLog = typeof attendanceLogsTable.$inferSelect;

export const insertTrainingSchema = createInsertSchema(trainingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTraining = z.infer<typeof insertTrainingSchema>;
export type Training = typeof trainingsTable.$inferSelect;

export const insertEmployeeTrainingSchema = createInsertSchema(employeeTrainingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployeeTraining = z.infer<typeof insertEmployeeTrainingSchema>;
export type EmployeeTraining = typeof employeeTrainingsTable.$inferSelect;
