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

// ─── GET /admin/backup ────────────────────────────────────────────────────────

router.get("/admin/backup", async (req: Request, res: Response): Promise<void> => {
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

  // State ─────────────────────────────────────────────────────────────────────
  // pgDumpHadData: true only after pgdump.stdout emits real SQL bytes.
  // This is the correct signal for "pg_dump is working". It fires BEFORE the
  // corresponding gzip.on("data") chunk, since piping is synchronous per tick.
  // gzip emits ~20 bytes of empty-stream header even with zero pg_dump output,
  // so we cannot rely on gzip output to detect success.
  let pgDumpHadData = false;
  let pgDumpFailed = false;
  let pgDumpStderr = "";
  let fileSizeBytes = 0; // running counter — never buffer full backup in memory

  pgdump.stdout.on("data", () => {
    pgDumpHadData = true;
  });

  pgdump.stderr.on("data", (data: Buffer) => {
    pgDumpStderr += data.toString();
  });

  // pg_dump spawn error (binary not found)
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

  // pg_dump process exit
  pgdump.on("close", (code) => {
    if (code !== 0) {
      pgDumpFailed = true;
      req.log.error({ code, pgDumpStderr }, "pg_dump exited with non-zero code");
      gzip.end(); // flush any remaining gzip bytes, gzip.on("end") handles response
    }
    // On code === 0, gzip ends naturally when pgdump.stdout closes
  });

  // Stream compressed bytes to response.
  // Only write to res AFTER pgDumpHadData is true — this prevents the ~20-byte
  // empty gzip wrapper from being sent as a 200 OK response on failure.
  gzip.on("data", (chunk: Buffer) => {
    if (!pgDumpHadData) return; // discard gzip wrapper bytes from empty input
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
      // pg_dump did not produce any data or exited with error
      if (!res.headersSent) {
        const errMsg = pgDumpStderr.trim()
          ? `pg_dump falhou: ${pgDumpStderr.slice(0, 300)}`
          : "pg_dump não produziu dados. Verifique se está instalado e se o banco está acessível.";
        res.status(500).json({ error: errMsg });
      } else {
        // Headers already sent — can't send JSON; just close the connection
        res.end();
      }
      return;
    }

    res.end();

    // Insert success log
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

  gzip.on("error", (err) => {
    pgDumpFailed = true;
    req.log.error({ err }, "gzip stream error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao comprimir backup." });
    } else {
      res.end();
    }
  });

  // Kill pg_dump and respond with error if no output starts within 30 s
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
    createdAt: l.createdAt.toISOString(),
  })));
});

export default router;
