import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, carriersTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  return true;
}

function parseId(param: string | string[], res: Response): number | null {
  const id = parseInt(Array.isArray(param) ? param[0]! : param);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return null;
  }
  return id;
}

router.get("/carriers", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { active } = req.query as Record<string, string>;
  const filters = [];
  if (active !== undefined) filters.push(eq(carriersTable.active, active));

  const rows = await db
    .select()
    .from(carriersTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(carriersTable.name);

  res.json({ items: rows });
});

router.post("/carriers", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, document, phone, email } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [carrier] = await db
    .insert(carriersTable)
    .values({ name, document: document || null, phone: phone || null, email: email || null, active: "true" })
    .returning();

  res.status(201).json(carrier);
});

router.put("/carriers/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const { name, document, phone, email, active } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [carrier] = await db
    .update(carriersTable)
    .set({
      name,
      document: document || null,
      phone: phone || null,
      email: email || null,
      ...(active !== undefined ? { active } : {}),
    })
    .where(eq(carriersTable.id, id))
    .returning();

  if (!carrier) {
    res.status(404).json({ error: "Transportadora não encontrada" });
    return;
  }

  res.json(carrier);
});

router.delete("/carriers/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const [deleted] = await db
    .update(carriersTable)
    .set({ active: "false" })
    .where(eq(carriersTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Transportadora não encontrada" });
    return;
  }

  res.json({ ok: true });
});

export default router;
