import app from "./app";
import { logger } from "./lib/logger";
import { seedUsers } from "./seed";
import { startReportScheduler } from "./lib/report-scheduler";
import { startGoalAlertScheduler } from "./lib/goal-alert-scheduler";
import { startBackupScheduler } from "./lib/backup-scheduler";
import { db, usersTable } from "@workspace/db";
import { count } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function autoSeedIfEmpty(): Promise<void> {
  if (process.env["NODE_ENV"] === "production") return;

  const [row] = await db.select({ total: count() }).from(usersTable);
  if ((row?.total ?? 0) > 0) return;

  logger.info("Banco de dados vazio — executando seed automático...");
  // Dynamic import so the extra pool in seed.ts is only created when needed
  const { seed } = await import("@workspace/db/seed");
  await seed();
  logger.info("Seed automático concluído com sucesso.");
}

async function bootstrap(): Promise<void> {
  await autoSeedIfEmpty();
  await seedUsers();

  startReportScheduler();
  startGoalAlertScheduler();
  startBackupScheduler();

  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err) => {
      if (err) {
        reject(err);
      } else {
        logger.info({ port }, "Server listening");
        resolve();
      }
    });
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Fatal error during server bootstrap");
  process.exit(1);
});
