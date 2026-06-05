import { pgTable, serial, integer, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userModuleAccessTable = pgTable("user_module_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  canEdit: boolean("can_edit").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("uq_user_module").on(table.userId, table.module)]);
