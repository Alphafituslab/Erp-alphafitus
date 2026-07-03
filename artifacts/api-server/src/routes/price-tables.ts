import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, priceTablesTable, priceTableItemsTable, productsTable, clientsTable } from "@workspace/db";

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

router.get("/price-tables", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { clientId, active } = req.query as Record<string, string>;
  const filters = [];
  if (clientId !== undefined) filters.push(eq(priceTablesTable.clientId, parseInt(clientId)));
  if (active !== undefined) filters.push(eq(priceTablesTable.active, active));

  const rows = await db
    .select({
      id: priceTablesTable.id,
      name: priceTablesTable.name,
      description: priceTablesTable.description,
      clientId: priceTablesTable.clientId,
      clientName: clientsTable.name,
      active: priceTablesTable.active,
      itemCount: sql<number>`(select count(*)::int from ${priceTableItemsTable} where ${priceTableItemsTable.priceTableId} = ${priceTablesTable.id})`,
      createdAt: priceTablesTable.createdAt,
      updatedAt: priceTablesTable.updatedAt,
    })
    .from(priceTablesTable)
    .leftJoin(clientsTable, eq(priceTablesTable.clientId, clientsTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(priceTablesTable.name);

  res.json({ items: rows });
});

router.post("/price-tables", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, description, clientId } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [table] = await db
    .insert(priceTablesTable)
    .values({
      name,
      description: description || null,
      clientId: clientId ? Number(clientId) : null,
      active: "true",
    })
    .returning();

  res.status(201).json(table);
});

router.put("/price-tables/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const { name, description, clientId, active } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [table] = await db
    .update(priceTablesTable)
    .set({
      name,
      description: description || null,
      clientId: clientId ? Number(clientId) : null,
      ...(active !== undefined ? { active } : {}),
    })
    .where(eq(priceTablesTable.id, id))
    .returning();

  if (!table) {
    res.status(404).json({ error: "Tabela de preço não encontrada" });
    return;
  }

  res.json(table);
});

router.delete("/price-tables/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  await db.delete(priceTableItemsTable).where(eq(priceTableItemsTable.priceTableId, id));
  const [deleted] = await db.delete(priceTablesTable).where(eq(priceTablesTable.id, id)).returning();

  if (!deleted) {
    res.status(404).json({ error: "Tabela de preço não encontrada" });
    return;
  }

  res.json({ ok: true });
});

router.get("/price-tables/:id/items", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const rows = await db
    .select({
      id: priceTableItemsTable.id,
      productId: priceTableItemsTable.productId,
      productName: productsTable.name,
      productSku: productsTable.sku,
      price: priceTableItemsTable.price,
    })
    .from(priceTableItemsTable)
    .leftJoin(productsTable, eq(priceTableItemsTable.productId, productsTable.id))
    .where(eq(priceTableItemsTable.priceTableId, id))
    .orderBy(productsTable.name);

  res.json({ items: rows });
});

// Bulk replace all items for a table (used by the price-table editor UI).
router.put("/price-tables/:id/items", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (!id) return;

  const { items } = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "Lista de itens inválida" });
    return;
  }

  const [table] = await db.select().from(priceTablesTable).where(eq(priceTablesTable.id, id));
  if (!table) {
    res.status(404).json({ error: "Tabela de preço não encontrada" });
    return;
  }

  await db.delete(priceTableItemsTable).where(eq(priceTableItemsTable.priceTableId, id));

  if (items.length > 0) {
    await db.insert(priceTableItemsTable).values(
      items.map((item: any) => ({
        priceTableId: id,
        productId: Number(item.productId),
        price: String(item.price),
      }))
    );
  }

  res.json({ ok: true });
});

export default router;
