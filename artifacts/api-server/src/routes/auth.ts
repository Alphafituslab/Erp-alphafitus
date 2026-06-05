import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetMeResponse, LogoutResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
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
  req.session.save((err) => {
    if (err) {
      req.log.error({ err }, "Session save error");
      res.status(500).json({ error: "Erro interno" });
      return;
    }
    res.json(LoginResponse.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sector: user.sector ?? null,
    }));
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Session destroy error");
    }
    res.clearCookie("erp.sid");
    res.json(LogoutResponse.parse({ ok: true }));
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

  res.json(GetMeResponse.parse({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sector: user.sector ?? null,
  }));
});

export default router;
