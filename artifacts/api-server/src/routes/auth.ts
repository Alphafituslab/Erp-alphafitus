import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, userModuleAccessTable } from "@workspace/db";

const router: IRouter = Router();

async function fetchUserModules(userId: number, role: string) {
  if (role === "admin" || role === "manager") return null;
  const rows = await db
    .select({ module: userModuleAccessTable.module, canEdit: userModuleAccessTable.canEdit })
    .from(userModuleAccessTable)
    .where(eq(userModuleAccessTable.userId, userId));
  return rows;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email e senha obrigatórios" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, String(email).toLowerCase()))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  if (user.active !== "true") {
    res.status(401).json({ error: "Usuário inativo. Contate o administrador." });
    return;
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.userName = user.name ?? user.email;
  req.session.save(async (err) => {
    if (err) {
      req.log.error({ err }, "Session save error");
      res.status(500).json({ error: "Erro interno" });
      return;
    }
    const modules = await fetchUserModules(user.id, user.role);
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sector: user.sector ?? null,
      modules,
    });
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Session destroy error");
    }
    res.clearCookie("erp.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId))
    .limit(1);

  if (!user || user.active !== "true") {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const modules = await fetchUserModules(user.id, user.role);
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sector: user.sector ?? null,
    modules,
  });
});

export default router;
