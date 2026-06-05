import { Router, type IRouter } from "express";
import { db, companySettingsTable } from "@workspace/db";
import type { Request, Response } from "express";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  return true;
}

async function requireAdminAsync(req: Request, res: Response): Promise<boolean> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores" });
    return false;
  }
  return true;
}

async function getOrInitCompanySettings() {
  const [existing] = await db.select().from(companySettingsTable).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(companySettingsTable).values({}).returning();
  return created;
}

router.get("/settings/company", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const settings = await getOrInitCompanySettings();
  res.json({
    id: settings.id,
    companyName: settings.companyName,
    logoBase64: settings.logoBase64,
    updatedAt: settings.updatedAt,
  });
});

router.put("/settings/company", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdminAsync(req, res)) return;

  const body = req.body as { companyName?: string; logoBase64?: string | null };
  const { companyName, logoBase64 } = body;

  if (companyName !== undefined && companyName.trim() === "") {
    res.status(400).json({ error: "Nome da empresa não pode ser vazio" });
    return;
  }

  const settings = await getOrInitCompanySettings();

  const [updated] = await db
    .update(companySettingsTable)
    .set({
      ...(companyName !== undefined && { companyName: companyName.trim() }),
      ...(logoBase64 !== undefined && { logoBase64 }),
      updatedAt: new Date(),
    })
    .returning();

  res.json({
    id: updated.id,
    companyName: updated.companyName,
    logoBase64: updated.logoBase64,
    updatedAt: updated.updatedAt,
  });
});

export default router;
