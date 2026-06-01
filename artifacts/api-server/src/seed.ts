import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "./lib/logger";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: "admin" | "manager" | "employee";
}

const SEED_USERS: SeedUser[] = [
  {
    name: "Administrador",
    email: "admin@empresa.com.br",
    password: "Admin@2025",
    role: "admin",
  },
  {
    name: "Clayton Borges",
    email: "claytonborges@alphafitus.com.br",
    password: "240682cla@",
    role: "manager",
  },
];

export async function seedUsers(): Promise<void> {
  for (const u of SEED_USERS) {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, u.email))
      .limit(1);

    if (existing) continue;

    const passwordHash = await bcrypt.hash(u.password, 10);
    await db.insert(usersTable).values({
      name: u.name,
      email: u.email,
      passwordHash,
      role: u.role,
      active: "true",
    });

    logger.info({ email: u.email, role: u.role }, "Seeded user");
  }
}
