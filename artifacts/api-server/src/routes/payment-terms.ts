import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, paymentTermsTable } from "@workspace/db";

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

router.get("/payment-terms", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { active } = req.query as Record<string, string>;
  const filters = [];
  if (active !== undefined) filters.push(eq(paymentTermsTable.active, active));

  const rows = await db
    .select()
    .from(paymentTermsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(paymentTermsTable.name);

  res.json({ items: rows });
});

router.post("/payment-terms", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, description } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [term] = await db
    .insert(paymentTermsTable)
    .values({ name, description: description || null, active: "true" })
    .returning();

  res.status(201).json(term);
});

router.put("/payment-terms/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const { name, description, active } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [term] = await db
    .update(paymentTermsTable)
    .set({
      name,
      description: description || null,
      ...(active !== undefined ? { active } : {}),
    })
    .where(eq(paymentTermsTable.id, id))
    .returning();

  if (!term) {
    res.status(404).json({ error: "Condição de pagamento não encontrada" });
    return;
  }

  res.json(term);
});

router.delete("/payment-terms/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const [deleted] = await db.delete(paymentTermsTable).where(eq(paymentTermsTable.id, id)).returning();

  if (!deleted) {
    res.status(404).json({ error: "Condição de pagamento não encontrada" });
    return;
  }

  res.json({ ok: true });
});

export default router;
