import { Router, type IRouter } from "express";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import {
  db, notificationsTable,
  productLotsTable, productionMaterialConsumptionsTable,
} from "@workspace/db";
import type { Request, Response } from "express";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  return true;
}

router.get("/notifications", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const userId = req.session.userId!;

  const [rows, unreadResult] = await Promise.all([
    db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50),
    db
      .select({ total: count() })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false))),
  ]);

  const unreadCount = unreadResult[0]?.total ?? 0;

  res.json({ notifications: rows, unreadCount });
});

router.get("/notifications/active-recall-count", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const criticalLots = await db
    .selectDistinct({ lotId: productionMaterialConsumptionsTable.lotId })
    .from(productionMaterialConsumptionsTable)
    .innerJoin(
      productLotsTable,
      eq(productionMaterialConsumptionsTable.lotId, productLotsTable.id)
    )
    .where(
      and(
        inArray(productLotsTable.cqStatus, ["rejected", "quarantine"]),
      )
    );

  res.json({ count: criticalLots.length });
});

router.patch("/notifications/:id/read", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
  const id = parseInt(rawId);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "ID inválido" }); return; }

  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.session.userId!)));

  res.json({ ok: true });
});

router.patch("/notifications/read-all", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.userId, req.session.userId!), eq(notificationsTable.read, false)));

  res.json({ ok: true });
});

export default router;
