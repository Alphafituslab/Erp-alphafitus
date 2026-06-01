import { Router, type IRouter } from "express";
import { and, eq, gte, lte, sql, desc, like } from "drizzle-orm";
import { db, productsTable, stockMovementsTable } from "@workspace/db";
import type { Request, Response } from "express";

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
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido" });
    return null;
  }
  return id;
}

// ─── Products ─────────────────────────────────────────────────────────────────

router.get("/estoque/products", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { search, category, active, lowStock } = req.query as Record<string, string>;

  const filters = [];

  // Default to active only unless explicitly queried
  if (active !== undefined) {
    filters.push(eq(productsTable.active, active));
  } else {
    filters.push(eq(productsTable.active, "true"));
  }

  if (search) {
    filters.push(
      sql`(${productsTable.name} ILIKE ${"%" + search + "%"} OR ${productsTable.sku} ILIKE ${"%" + search + "%"} OR ${productsTable.category} ILIKE ${"%" + search + "%"})`
    );
  }

  if (category) {
    filters.push(eq(productsTable.category, category));
  }

  if (lowStock === "true") {
    filters.push(sql`${productsTable.currentStock} <= ${productsTable.minStock}`);
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(and(...filters))
    .orderBy(productsTable.name);

  res.json(products);
});

router.post("/estoque/products", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, sku, description, category, unit, costPrice, salePrice, minStock, currentStock } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [product] = await db
    .insert(productsTable)
    .values({
      name: name.trim(),
      sku: sku || null,
      description: description || null,
      category: category || null,
      unit: unit || "un",
      costPrice: costPrice ? String(costPrice) : null,
      salePrice: salePrice ? String(salePrice) : null,
      minStock: minStock ? parseInt(minStock) : 0,
      currentStock: currentStock ? parseInt(currentStock) : 0,
      active: "true",
    })
    .returning();

  res.status(201).json(product);
});

router.put("/estoque/products/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { name, sku, description, category, unit, costPrice, salePrice, minStock } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [product] = await db
    .update(productsTable)
    .set({
      name: name.trim(),
      sku: sku || null,
      description: description || null,
      category: category || null,
      unit: unit || "un",
      costPrice: costPrice ? String(costPrice) : null,
      salePrice: salePrice ? String(salePrice) : null,
      minStock: minStock !== undefined ? parseInt(minStock) : 0,
    })
    .where(eq(productsTable.id, id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  res.json(product);
});

router.delete("/estoque/products/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [product] = await db
    .update(productsTable)
    .set({ active: "false" })
    .where(eq(productsTable.id, id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  res.json({ ok: true });
});

// ─── Stock Movements ──────────────────────────────────────────────────────────

router.get("/estoque/movements", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { productId, type, startDate, endDate } = req.query as Record<string, string>;

  const filters = [];

  if (productId) {
    const pid = parseInt(productId);
    if (!isNaN(pid)) filters.push(eq(stockMovementsTable.productId, pid));
  }
  if (type) filters.push(eq(stockMovementsTable.type, type));
  if (startDate) filters.push(gte(stockMovementsTable.createdAt, new Date(startDate)));
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filters.push(lte(stockMovementsTable.createdAt, end));
  }

  const movements = await db
    .select({
      id: stockMovementsTable.id,
      productId: stockMovementsTable.productId,
      productName: productsTable.name,
      type: stockMovementsTable.type,
      quantity: stockMovementsTable.quantity,
      reason: stockMovementsTable.reason,
      referenceId: stockMovementsTable.referenceId,
      referenceType: stockMovementsTable.referenceType,
      notes: stockMovementsTable.notes,
      createdAt: stockMovementsTable.createdAt,
    })
    .from(stockMovementsTable)
    .leftJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(stockMovementsTable.createdAt))
    .limit(200);

  res.json(movements);
});

router.post("/estoque/movements", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { productId, type, quantity, reason, notes } = req.body;

  if (!productId || isNaN(parseInt(productId))) {
    res.status(400).json({ error: "Produto é obrigatório" });
    return;
  }
  if (!type || !["input", "output"].includes(type)) {
    res.status(400).json({ error: "Tipo deve ser 'input' ou 'output'" });
    return;
  }
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    res.status(400).json({ error: "Quantidade deve ser maior que zero" });
    return;
  }

  const pid = parseInt(productId);

  let resultMovement: typeof stockMovementsTable.$inferSelect | undefined;
  let productName: string | undefined;

  try {
    await db.transaction(async (tx) => {
      // Lock the row and read current state inside the transaction
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, pid))
        .for("update");

      if (!product) {
        throw Object.assign(new Error("Produto não encontrado"), { status: 404 });
      }

      productName = product.name;

      if (type === "output") {
        if (product.currentStock < qty) {
          throw Object.assign(
            new Error(`Estoque insuficiente. Disponível: ${product.currentStock}`),
            { status: 400 }
          );
        }
        // Conditional update: only succeed if stock is still sufficient
        const [updated] = await tx
          .update(productsTable)
          .set({ currentStock: sql`${productsTable.currentStock} - ${qty}` })
          .where(
            and(
              eq(productsTable.id, pid),
              sql`${productsTable.currentStock} >= ${qty}`
            )
          )
          .returning({ currentStock: productsTable.currentStock });

        if (!updated) {
          throw Object.assign(
            new Error("Estoque insuficiente (atualizado por outra operação simultânea)"),
            { status: 400 }
          );
        }
      } else {
        await tx
          .update(productsTable)
          .set({ currentStock: sql`${productsTable.currentStock} + ${qty}` })
          .where(eq(productsTable.id, pid));
      }

      const [movement] = await tx
        .insert(stockMovementsTable)
        .values({
          productId: pid,
          type,
          quantity: qty,
          reason: reason || null,
          referenceType: "manual",
          notes: notes || null,
        })
        .returning();

      resultMovement = movement;
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    const message = err?.message ?? "Erro interno";
    res.status(status).json({ error: message });
    return;
  }

  res.status(201).json({ ...resultMovement, productName });
});

// ─── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/estoque/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  // Total active products
  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(productsTable)
    .where(eq(productsTable.active, "true"));

  // Low stock (currentStock <= minStock, above zero)
  const [lowRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.active, "true"),
        sql`${productsTable.currentStock} <= ${productsTable.minStock}`,
        sql`${productsTable.currentStock} > 0`,
      )
    );

  // Out of stock
  const [outRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.active, "true"),
        sql`${productsTable.currentStock} = 0`,
      )
    );

  // Total stock value (costPrice * currentStock)
  const [valueRow] = await db
    .select({
      value: sql<number>`COALESCE(SUM(cost_price::numeric * current_stock), 0)`,
    })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.active, "true"),
        sql`cost_price IS NOT NULL`,
      )
    );

  // Low stock products list
  const lowStockProducts = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.active, "true"),
        sql`${productsTable.currentStock} <= ${productsTable.minStock}`,
      )
    )
    .orderBy(productsTable.currentStock)
    .limit(10);

  // Recent movements
  const recentMovements = await db
    .select({
      id: stockMovementsTable.id,
      productId: stockMovementsTable.productId,
      productName: productsTable.name,
      type: stockMovementsTable.type,
      quantity: stockMovementsTable.quantity,
      reason: stockMovementsTable.reason,
      referenceId: stockMovementsTable.referenceId,
      referenceType: stockMovementsTable.referenceType,
      notes: stockMovementsTable.notes,
      createdAt: stockMovementsTable.createdAt,
    })
    .from(stockMovementsTable)
    .leftJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .orderBy(desc(stockMovementsTable.createdAt))
    .limit(5);

  res.json({
    totalProducts: Number(totalRow?.count ?? 0),
    lowStockCount: Number(lowRow?.count ?? 0),
    outOfStockCount: Number(outRow?.count ?? 0),
    totalStockValue: Number(valueRow?.value ?? 0),
    lowStockProducts,
    recentMovements,
  });
});

export default router;
