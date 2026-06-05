import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateUsuarioBody, UpdateUsuarioBody } from "@workspace/api-zod";

const router: IRouter = Router();

const VALID_SECTORS = ["vendas", "financeiro", "producao", "separacao", "faturamento", "logistica"] as const;
type Sector = typeof VALID_SECTORS[number];

async function requireAdminAsync(req: Request, res: Response): Promise<boolean> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  let role = req.session.role;
  if (!role) {
    const [u] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
    if (!u) { res.status(401).json({ error: "Não autenticado" }); return false; }
    role = u.role;
    req.session.role = role;
  }
  if (role !== "admin") {
    res.status(403).json({ error: "Acesso negado. Apenas administradores." });
    return false;
  }
  return true;
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    sector: u.sector ?? null,
    active: u.active === "true",
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/usuarios", async (req, res): Promise<void> => {
  if (!await requireAdminAsync(req, res)) return;
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json({ users: users.map(formatUser) });
});

router.post("/usuarios", async (req, res): Promise<void> => {
  if (!await requireAdminAsync(req, res)) return;
  const parsed = CreateUsuarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos: " + parsed.error.issues.map((i) => i.message).join(", ") });
    return;
  }
  const { name, email, password, role } = parsed.data;
  const sector = (req.body.sector as string | undefined) ?? null;
  if (sector && !VALID_SECTORS.includes(sector as Sector)) {
    res.status(400).json({ error: "Setor inválido." });
    return;
  }
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Já existe um usuário com este e-mail." });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const roleValue = (role as "admin" | "manager" | "employee" | undefined) ?? "employee";
  const [created] = await db.insert(usersTable).values({
    name, email: email.toLowerCase(), passwordHash, role: roleValue, active: "true",
    sector: sector ?? null,
  }).returning();
  res.status(201).json({ user: formatUser(created) });
});

router.put("/usuarios/:id", async (req, res): Promise<void> => {
  if (!await requireAdminAsync(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const parsed = UpdateUsuarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos: " + parsed.error.issues.map((i) => i.message).join(", ") });
    return;
  }
  const { name, email, password, role, active } = parsed.data;
  const sector = req.body.sector !== undefined ? (req.body.sector as string | null) : undefined;
  if (sector && !VALID_SECTORS.includes(sector as Sector)) {
    res.status(400).json({ error: "Setor inválido." });
    return;
  }
  if (active === false && id === req.session.userId) {
    res.status(400).json({ error: "Você não pode desativar sua própria conta." });
    return;
  }
  if (role === undefined && name === undefined && email === undefined && password === undefined && active === undefined && sector === undefined) {
    res.status(400).json({ error: "Nenhum campo para atualizar." });
    return;
  }
  if (email) {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0 && existing[0].id !== id) {
      res.status(409).json({ error: "Já existe um usuário com este e-mail." });
      return;
    }
  }
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email.toLowerCase();
  if (role !== undefined) updates.role = role as "admin" | "manager" | "employee";
  if (active !== undefined) updates.active = active ? "true" : "false";
  if (password !== undefined) updates.passwordHash = await bcrypt.hash(password, 10);
  if (sector !== undefined) updates.sector = sector ?? null;
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Usuário não encontrado." }); return; }
  res.json({ user: formatUser(updated) });
});

router.delete("/usuarios/:id", async (req, res): Promise<void> => {
  if (!await requireAdminAsync(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  if (id === req.session.userId) {
    res.status(400).json({ error: "Você não pode excluir sua própria conta." });
    return;
  }
  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Usuário não encontrado." }); return; }
  res.json({ ok: true });
});

export default router;
