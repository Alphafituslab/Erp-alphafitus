import { Router, type IRouter, type Request, type Response } from "express";
import { spawn } from "child_process";
import { createGzip } from "zlib";
import { desc, eq } from "drizzle-orm";
import { db, usersTable, backupLogsTable, backupSchedulesTable } from "@workspace/db";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  let role = req.session.role;
  if (!role) {
    const [u] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId))
      .limit(1);
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

// ─── POST /admin/backup ───────────────────────────────────────────────────────

router.post("/admin/backup", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdmin(req, res)) return;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    res.status(500).json({ error: "DATABASE_URL não configurada." });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(dbUrl);
  } catch {
    res.status(500).json({ error: "DATABASE_URL inválida." });
    return;
  }

  const host = parsedUrl.hostname;
  const port = parsedUrl.port || "5432";
  const database = parsedUrl.pathname.replace(/^\//, "");
  const user = parsedUrl.username;
  const password = parsedUrl.password;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const filename = `nexus-erp-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.sql.gz`;

  const env: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: password };

  const pgdump = spawn(
    "pg_dump",
    ["-h", host, "-p", port, "-U", user, "-d", database, "--no-password"],
    { env }
  );

  const gzip = createGzip();
  pgdump.stdout.pipe(gzip);

  let pgDumpHadData = false;
  let pgDumpFailed = false;
  let pgDumpStderr = "";
  let fileSizeBytes = 0;

  pgdump.stdout.on("data", () => {
    pgDumpHadData = true;
  });

  pgdump.stderr.on("data", (data: Buffer) => {
    pgDumpStderr += data.toString();
  });

  pgdump.on("error", (err) => {
    pgDumpFailed = true;
    req.log.error({ err }, "pg_dump spawn error");
    gzip.destroy();
    if (!res.headersSent) {
      res.status(500).json({
        error: "pg_dump não encontrado ou falhou ao iniciar. Verifique se o pacote postgresql-client está instalado no servidor.",
      });
    } else {
      res.end();
    }
  });

  pgdump.on("close", (code) => {
    if (code !== 0) {
      pgDumpFailed = true;
      req.log.error({ code, pgDumpStderr }, "pg_dump exited with non-zero code");
      gzip.end();
    }
  });

  gzip.on("data", (chunk: Buffer) => {
    if (!pgDumpHadData) return;
    fileSizeBytes += chunk.length;
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-cache");
    }
    res.write(chunk);
  });

  gzip.on("end", async () => {
    if (pgDumpFailed || !pgDumpHadData) {
      if (!res.headersSent) {
        const errMsg = pgDumpStderr.trim()
          ? `pg_dump falhou: ${pgDumpStderr.slice(0, 300)}`
          : "pg_dump não produziu dados. Verifique se está instalado e se o banco está acessível.";
        res.status(500).json({ error: errMsg });
      } else {
        res.end();
      }
      return;
    }

    res.end();

    try {
      await db.insert(backupLogsTable).values({
        userId: req.session.userId!,
        filename,
        fileSizeBytes,
        source: "manual",
        status: "success",
        errorMessage: null,
      });
    } catch (logErr) {
      req.log.error({ logErr }, "Failed to insert backup log");
    }
  });

  gzip.on("error", (err) => {
    pgDumpFailed = true;
    req.log.error({ err }, "gzip stream error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao comprimir backup." });
    } else {
      res.end();
    }
  });

  const startupTimeout = setTimeout(() => {
    if (!pgDumpHadData) {
      pgDumpFailed = true;
      pgdump.kill();
      if (!res.headersSent) {
        res.status(500).json({ error: "Timeout: pg_dump não produziu dados em 30 segundos." });
      }
    }
  }, 30_000);

  pgdump.stdout.once("data", () => clearTimeout(startupTimeout));
  pgdump.once("error", () => clearTimeout(startupTimeout));
  pgdump.once("close", () => clearTimeout(startupTimeout));
});

// ─── GET /admin/backup/logs ───────────────────────────────────────────────────

router.get("/admin/backup/logs", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdmin(req, res)) return;

  const logs = await db
    .select()
    .from(backupLogsTable)
    .orderBy(desc(backupLogsTable.createdAt))
    .limit(20);

  res.json(logs.map((l) => ({
    id: l.id,
    userId: l.userId,
    filename: l.filename,
    fileSizeBytes: l.fileSizeBytes,
    source: l.source,
    status: l.status,
    errorMessage: l.errorMessage,
    createdAt: l.createdAt.toISOString(),
  })));
});

// ─── GET /admin/backup/schedule ──────────────────────────────────────────────

router.get("/admin/backup/schedule", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdmin(req, res)) return;

  const rows = await db.select().from(backupSchedulesTable).limit(1);

  if (!rows.length) {
    // Return default config (not yet persisted)
    res.json({
      id: 0,
      enabled: false,
      hour: 2,
      minute: 0,
      retentionDays: 7,
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    });
    return;
  }

  const row = rows[0]!;
  res.json({
    id: row.id,
    enabled: row.enabled,
    hour: row.hour,
    minute: row.minute,
    retentionDays: row.retentionDays,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  });
});

// ─── PUT /admin/backup/schedule ──────────────────────────────────────────────

router.put("/admin/backup/schedule", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdmin(req, res)) return;

  const { enabled, hour, minute, retentionDays } = req.body as {
    enabled?: boolean;
    hour?: number;
    minute?: number;
    retentionDays?: number;
  };

  if (
    typeof enabled !== "boolean" ||
    typeof hour !== "number" || hour < 0 || hour > 23 ||
    typeof minute !== "number" || minute < 0 || minute > 59 ||
    typeof retentionDays !== "number" || retentionDays < 1 || retentionDays > 365
  ) {
    res.status(400).json({ error: "Parâmetros inválidos." });
    return;
  }

  const existing = await db.select().from(backupSchedulesTable).limit(1);

  let result;
  if (existing.length === 0) {
    const [inserted] = await db
      .insert(backupSchedulesTable)
      .values({ enabled, hour, minute, retentionDays, updatedBy: req.session.userId!, updatedAt: new Date() })
      .returning();
    result = inserted!;
  } else {
    const [updated] = await db
      .update(backupSchedulesTable)
      .set({ enabled, hour, minute, retentionDays, updatedBy: req.session.userId!, updatedAt: new Date() })
      .where(eq(backupSchedulesTable.id, existing[0]!.id))
      .returning();
    result = updated!;
  }

  res.json({
    id: result.id,
    enabled: result.enabled,
    hour: result.hour,
    minute: result.minute,
    retentionDays: result.retentionDays,
    updatedAt: result.updatedAt.toISOString(),
    updatedBy: result.updatedBy,
  });
});

export default router;
