import { spawn } from "child_process";
import { createGzip } from "zlib";
import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";
import { db, backupLogsTable, backupSchedulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const BACKUP_DIR = "/tmp/nexus-backups";

function ensureBackupDir(): void {
  try {
    mkdirSync(BACKUP_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

async function getScheduleConfig(): Promise<{
  enabled: boolean;
  hour: number;
  minute: number;
} | null> {
  try {
    const rows = await db.select().from(backupSchedulesTable).limit(1);
    if (!rows.length) return null;
    return { enabled: rows[0]!.enabled, hour: rows[0]!.hour, minute: rows[0]!.minute };
  } catch (err) {
    logger.error({ err }, "Failed to read backup schedule config");
    return null;
  }
}

async function runScheduledBackup(): Promise<void> {
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) {
    logger.warn("Scheduled backup skipped: DATABASE_URL not set");
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(dbUrl);
  } catch {
    logger.error("Scheduled backup failed: DATABASE_URL is invalid");
    return;
  }

  ensureBackupDir();

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const filename = `nexus-erp-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}-auto.sql.gz`;
  const filePath = join(BACKUP_DIR, filename);

  const host = parsedUrl.hostname;
  const port = parsedUrl.port || "5432";
  const database = parsedUrl.pathname.replace(/^\//, "");
  const user = parsedUrl.username;
  const password = parsedUrl.password;

  const env: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: password };

  logger.info({ filename }, "Starting scheduled database backup");

  const pgdump = spawn(
    "pg_dump",
    ["-h", host, "-p", port, "-U", user, "-d", database, "--no-password"],
    { env },
  );

  const gzip = createGzip();
  const outStream = createWriteStream(filePath);
  pgdump.stdout.pipe(gzip).pipe(outStream);

  let pgDumpStderr = "";
  let pgDumpHadData = false;
  let fileSizeBytes = 0;

  pgdump.stdout.on("data", () => {
    pgDumpHadData = true;
  });

  pgdump.stderr.on("data", (data: Buffer) => {
    pgDumpStderr += data.toString();
  });

  await new Promise<void>((resolve) => {
    pgdump.on("error", async (err) => {
      logger.error({ err }, "Scheduled backup: pg_dump spawn error");
      gzip.destroy();
      outStream.destroy();
      await logBackupResult(filename, 0, "error", String(err));
      resolve();
    });

    outStream.on("finish", async () => {
      const { statSync } = await import("fs");
      try {
        fileSizeBytes = statSync(filePath).size;
      } catch {
        fileSizeBytes = 0;
      }

      if (!pgDumpHadData) {
        const errMsg = pgDumpStderr.trim()
          ? `pg_dump não produziu dados: ${pgDumpStderr.slice(0, 300)}`
          : "pg_dump não produziu dados";
        logger.error({ errMsg }, "Scheduled backup failed");
        await logBackupResult(filename, 0, "error", errMsg);
      } else {
        logger.info({ filename, fileSizeBytes }, "Scheduled backup completed successfully");
        await logBackupResult(filename, fileSizeBytes, "success", null);
      }
      resolve();
    });

    outStream.on("error", async (err) => {
      logger.error({ err }, "Scheduled backup: write stream error");
      await logBackupResult(filename, 0, "error", String(err));
      resolve();
    });
  });
}

async function logBackupResult(
  filename: string,
  fileSizeBytes: number,
  status: "success" | "error",
  errorMessage: string | null,
): Promise<void> {
  try {
    await db.insert(backupLogsTable).values({
      userId: null,
      filename,
      fileSizeBytes,
      source: "scheduled",
      status,
      errorMessage,
    });
  } catch (err) {
    logger.error({ err }, "Failed to insert scheduled backup log");
  }
}

const firedThisMinute = new Set<string>();

async function checkAndFireBackup(): Promise<void> {
  const config = await getScheduleConfig();
  if (!config || !config.enabled) return;

  const now = new Date();
  if (now.getHours() !== config.hour || now.getMinutes() !== config.minute) return;

  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  if (firedThisMinute.has(minuteKey)) return;

  firedThisMinute.add(minuteKey);
  if (firedThisMinute.size > 1440) {
    const oldest = [...firedThisMinute].slice(0, 720);
    oldest.forEach((k) => firedThisMinute.delete(k));
  }

  void runScheduledBackup();
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startBackupScheduler(): void {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(() => {
    void checkAndFireBackup();
  }, 60_000);
  logger.info("Backup scheduler started");
}

export function stopBackupScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
