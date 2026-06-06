import { db, smtpSettingsTable } from "@workspace/db";
import { getSmtpConfig } from "./mailer";
import type { SmtpConfig } from "./mailer";

export async function getEffectiveSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const [row] = await db.select().from(smtpSettingsTable).limit(1);
    if (row?.host && row?.user && row?.pass) {
      return {
        host: row.host,
        port: row.port ?? 587,
        user: row.user,
        pass: row.pass,
        from: row.from ?? row.user,
      };
    }
  } catch {
    // fall through to env vars
  }
  return getSmtpConfig();
}

export async function isSmtpConfiguredAsync(): Promise<boolean> {
  return (await getEffectiveSmtpConfig()) !== null;
}
