import { Router, type IRouter, type Request, type Response } from "express";
import { spawn } from "child_process";
import { createGzip } from "zlib";
import { randomBytes, createCipheriv, pbkdf2Sync } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, usersTable, backupLogsTable, backupSchedulesTable, smtpSettingsTable } from "@workspace/db";
import { uploadBackupToStorage, generateBackupDownloadUrl } from "../lib/backupStorage.js";
import { sendEmail } from "../lib/mailer";

const router: IRouter = Router();

// ─── OpenSSL-compatible AES-256-CBC + PBKDF2 encryption helpers ───────────────
// Produces a file readable by:
//   openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -in backup.sql.gz.enc | gunzip | psql ...
//
// OpenSSL -pbkdf2 uses: PBKDF2-HMAC-SHA256, 10000 iterations, 8-byte random salt.
// The output format is the standard OpenSSL salted file: magic "Salted__" + 8-byte salt + ciphertext.

const PBKDF2_ITERATIONS = 10000;
const PBKDF2_DIGEST = "sha256";

function encryptOpenSSL(data: Buffer, password: string): Buffer {
  const salt = randomBytes(8);
  const keyIv = pbkdf2Sync(Buffer.from(password, "utf8"), salt, PBKDF2_ITERATIONS, 48, PBKDF2_DIGEST);
  const key = keyIv.subarray(0, 32);
  const iv = keyIv.subarray(32, 48);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  // OpenSSL salted-file format: "Salted__" magic + 8-byte salt + ciphertext
  return Buffer.concat([Buffer.from("Salted__", "ascii"), salt, encrypted]);
}

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

  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY?.trim() || null;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const baseFilename = `nexus-erp-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const filename = encryptionKey ? `${baseFilename}.sql.gz.enc` : `${baseFilename}.sql.gz`;

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
  const chunks: Buffer[] = [];

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
    chunks.push(chunk);
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

    const rawBuffer = Buffer.concat(chunks);
    const finalBuffer = encryptionKey ? encryptOpenSSL(rawBuffer, encryptionKey) : rawBuffer;
    const fileSizeBytes = finalBuffer.length;

    res.setHeader("Content-Type", encryptionKey ? "application/octet-stream" : "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(fileSizeBytes));
    res.setHeader("Cache-Control", "no-cache");
    res.end(finalBuffer);

    let storageUrl: string | null = null;
    try {
      storageUrl = await uploadBackupToStorage(filename, finalBuffer);
      req.log.info({ filename, storageUrl }, "Backup uploaded to object storage");
    } catch (uploadErr) {
      req.log.error({ uploadErr }, "Failed to upload backup to object storage");
    }

    try {
      await db.insert(backupLogsTable).values({
        userId: req.session.userId!,
        filename,
        fileSizeBytes,
        source: "manual",
        status: "success",
        errorMessage: null,
        storageUrl,
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

// ─── GET /admin/backup/config ─────────────────────────────────────────────────

router.get("/admin/backup/config", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdmin(req, res)) return;
  res.json({ encryptionEnabled: !!(process.env.BACKUP_ENCRYPTION_KEY?.trim()) });
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
    storageUrl: l.storageUrl ?? null,
    createdAt: l.createdAt.toISOString(),
  })));
});

// ─── GET /admin/backup/download/:id ──────────────────────────────────────────

router.get("/admin/backup/download/:id", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdmin(req, res)) return;

  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  const [log] = await db
    .select()
    .from(backupLogsTable)
    .where(eq(backupLogsTable.id, id))
    .limit(1);

  if (!log) {
    res.status(404).json({ error: "Log de backup não encontrado." });
    return;
  }

  if (!log.storageUrl) {
    res.status(404).json({ error: "Este backup não possui arquivo no storage externo." });
    return;
  }

  try {
    const signedUrl = await generateBackupDownloadUrl(log.storageUrl, 3600);
    res.redirect(302, signedUrl);
  } catch (err) {
    req.log.error({ err }, "Failed to generate signed download URL");
    res.status(500).json({ error: "Erro ao gerar link de download." });
  }
});

// ─── GET /admin/backup/schedule ──────────────────────────────────────────────

router.get("/admin/backup/schedule", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdmin(req, res)) return;

  const rows = await db.select().from(backupSchedulesTable).limit(1);

  if (!rows.length) {
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

// ─── SMTP Configuration ───────────────────────────────────────────────────────

router.get("/admin/smtp/status", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdmin(req, res)) return;

  const [row] = await db.select().from(smtpSettingsTable).limit(1);
  const envConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const dbConfigured = !!(row?.host && row?.user && row?.pass);

  const effective = dbConfigured
    ? { host: row!.host, port: row!.port ?? 587, user: row!.user, from: row!.from }
    : envConfigured
    ? {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT ?? "587", 10),
        user: process.env.SMTP_USER,
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      }
    : null;

  res.json({
    configured: dbConfigured || envConfigured,
    source: dbConfigured ? "db" : envConfigured ? "env" : null,
    host: effective?.host ?? null,
    port: effective?.port ?? null,
    user: effective?.user ?? null,
    from: effective?.from ?? null,
  });
});

router.put("/admin/smtp/config", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdmin(req, res)) return;

  const { host, port, user, pass, from } = req.body as {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
  };

  if (!host || typeof host !== "string" || host.trim() === "") {
    res.status(400).json({ error: "host é obrigatório" });
    return;
  }
  if (!user || typeof user !== "string" || user.trim() === "") {
    res.status(400).json({ error: "user é obrigatório" });
    return;
  }
  if (!pass || typeof pass !== "string" || pass.trim() === "") {
    res.status(400).json({ error: "pass (senha) é obrigatória" });
    return;
  }

  const portNum = typeof port === "number" ? port : parseInt(String(port ?? "587"), 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    res.status(400).json({ error: "port deve ser um número entre 1 e 65535" });
    return;
  }

  const [existing] = await db.select().from(smtpSettingsTable).limit(1);

  let result;
  if (existing) {
    const [updated] = await db
      .update(smtpSettingsTable)
      .set({ host: host.trim(), port: portNum, user: user.trim(), pass: pass.trim(), from: from?.trim() || user.trim() })
      .where(eq(smtpSettingsTable.id, existing.id))
      .returning();
    result = updated;
  } else {
    const [inserted] = await db
      .insert(smtpSettingsTable)
      .values({ host: host.trim(), port: portNum, user: user.trim(), pass: pass.trim(), from: from?.trim() || user.trim() })
      .returning();
    result = inserted;
  }

  res.json({
    host: result!.host,
    port: result!.port,
    user: result!.user,
    from: result!.from,
    updatedAt: result!.updatedAt.toISOString(),
  });
});

router.delete("/admin/smtp/config", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdmin(req, res)) return;

  await db.delete(smtpSettingsTable);
  res.json({ success: true });
});

router.post("/admin/smtp/test", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdmin(req, res)) return;

  const { to } = req.body as { to?: string };
  if (!to || typeof to !== "string" || to.trim() === "") {
    res.status(400).json({ error: "Informe o e-mail de destino para o teste" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to.trim())) {
    res.status(400).json({ error: "E-mail de destino inválido" });
    return;
  }

  const { getEffectiveSmtpConfig } = await import("../lib/smtp-config.js");
  const cfg = await getEffectiveSmtpConfig();
  if (!cfg) {
    res.status(400).json({ error: "Nenhuma configuração SMTP encontrada. Configure as credenciais antes de testar." });
    return;
  }

  try {
    await sendEmail({
      to: to.trim(),
      subject: "✅ Teste de E-mail — NEXUS ERP",
      text: [
        "Este é um e-mail de teste enviado pelo NEXUS ERP para validar a configuração SMTP.",
        "",
        `Servidor: ${cfg.host}:${cfg.port}`,
        `Remetente: ${cfg.from}`,
        "",
        "Se você recebeu esta mensagem, o envio de e-mails está funcionando corretamente.",
      ].join("\n"),
    }, cfg);
    res.json({ success: true, message: `E-mail de teste enviado para ${to.trim()}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao enviar e-mail";
    req.log.warn({ err }, "SMTP test failed");
    res.status(500).json({ error: message });
  }
});

export default router;

