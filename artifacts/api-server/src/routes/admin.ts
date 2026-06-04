import { Router, type IRouter, type Request, type Response } from "express";
import { spawn } from "child_process";
import { createGzip } from "zlib";
import { desc, eq } from "drizzle-orm";
import { db, usersTable, backupLogsTable } from "@workspace/db";

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

  // Build filename: nexus-erp-backup-YYYY-MM-DD-HHmm.sql.gz
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

  // State tracking — used to decide whether to insert log and whether we can still send JSON errors
  let pgDumpFailed = false;
  let pgDumpExitCode: number | null = null;
  let streamingStarted = false;
  let fileSizeBytes = 0; // running counter — never buffer full backup in memory

  pgdump.stdout.pipe(gzip);

  let pgDumpStderr = "";
  pgdump.stderr.on("data", (data: Buffer) => {
    pgDumpStderr += data.toString();
  });

  // pg_dump spawn error (binary not found, etc.)
  pgdump.on("error", (err) => {
    pgDumpFailed = true;
    req.log.error({ err }, "pg_dump spawn error");
    gzip.destroy();
    if (!streamingStarted) {
      res.status(500).json({ error: "pg_dump não encontrado ou falhou ao iniciar. Verifique se o pacote postgresql-client está instalado." });
    } else {
      res.end();
    }
  });

  // pg_dump process exit — record exit code, trigger gzip finish on non-zero
  pgdump.on("close", (code) => {
    pgDumpExitCode = code;
    if (code !== 0) {
      pgDumpFailed = true;
      req.log.error({ code, pgDumpStderr }, "pg_dump exited with non-zero code");
      // End gzip to flush remaining data, but gzip.on("end") will check pgDumpFailed
      gzip.end();
    }
    // On code === 0, gzip ends naturally when stdout closes
  });

  // Stream each compressed chunk directly to response — count bytes without buffering
  gzip.on("data", (chunk: Buffer) => {
    fileSizeBytes += chunk.length;
    if (!streamingStarted) {
      streamingStarted = true;
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-cache");
    }
    res.write(chunk);
  });

  // gzip stream finished — finalize response and (only on success) insert log.
  // NOTE: pgdump.on("close") may fire AFTER gzip.on("end") in the success path
  // (gzip flushes remaining data before the process close event fires), so we
  // rely only on !pgDumpFailed rather than checking pgDumpExitCode === 0.
  gzip.on("end", async () => {
    res.end();

    if (!pgDumpFailed) {
      try {
        await db.insert(backupLogsTable).values({
          userId: req.session.userId!,
          filename,
          fileSizeBytes,
        });
      } catch (logErr) {
        req.log.error({ logErr }, "Failed to insert backup log");
      }
    } else {
      req.log.warn({ pgDumpExitCode, pgDumpFailed }, "Backup not logged — pg_dump failed");
    }
  });

  gzip.on("error", (err) => {
    pgDumpFailed = true;
    req.log.error({ err }, "gzip stream error");
    if (!streamingStarted) {
      res.status(500).json({ error: "Erro ao comprimir backup." });
    } else {
      res.end();
    }
  });

  // If no data is sent within 30 s, respond with a timeout error
  const timeout = setTimeout(() => {
    if (!streamingStarted) {
      pgDumpFailed = true;
      pgdump.kill();
      res.status(500).json({ error: "Timeout ao gerar backup. pg_dump demorou mais de 30 segundos para iniciar." });
    }
  }, 30_000);
  gzip.once("data", () => clearTimeout(timeout));
  gzip.once("error", () => clearTimeout(timeout));
  pgdump.once("error", () => clearTimeout(timeout));
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
