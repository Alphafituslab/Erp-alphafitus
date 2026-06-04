import { Router, type IRouter, type Request, type Response } from "express";
import { spawn } from "child_process";
import { createGzip } from "zlib";
import { desc } from "drizzle-orm";
import { db, usersTable, backupLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

  // Parse DATABASE_URL
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

  // Build filename: nexus-erp-backup-YYYY-MM-DD-HHmm.sql.gz
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const filename = `nexus-erp-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.sql.gz`;

  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");

  const env: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: password };

  const pgdump = spawn(
    "pg_dump",
    [
      "-h", host,
      "-p", port,
      "-U", user,
      "-d", database,
      "--no-password",
    ],
    { env }
  );

  const gzip = createGzip();

  // Buffer chunks to measure size after completion
  const chunks: Buffer[] = [];

  pgdump.stdout.pipe(gzip);

  gzip.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
    res.write(chunk);
  });

  let pgDumpError = "";
  pgdump.stderr.on("data", (data: Buffer) => {
    pgDumpError += data.toString();
  });

  pgdump.on("error", (err) => {
    req.log.error({ err }, "pg_dump spawn error");
    if (!res.headersSent) {
      res.status(500).json({ error: "pg_dump não encontrado ou falhou ao iniciar." });
    } else {
      res.end();
    }
  });

  gzip.on("end", async () => {
    res.end();

    // Record backup log
    const fileSizeBytes = chunks.reduce((acc, b) => acc + b.length, 0);
    try {
      await db.insert(backupLogsTable).values({
        userId: req.session.userId!,
        filename,
        fileSizeBytes,
      });
    } catch (logErr) {
      req.log.error({ logErr }, "Failed to insert backup log");
    }
  });

  pgdump.on("close", (code) => {
    if (code !== 0) {
      req.log.error({ code, pgDumpError }, "pg_dump exited with non-zero code");
      gzip.end();
    }
  });

  gzip.on("error", (err) => {
    req.log.error({ err }, "gzip stream error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao comprimir backup." });
    } else {
      res.end();
    }
  });
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
    createdAt: l.createdAt.toISOString(),
  })));
});

export default router;
