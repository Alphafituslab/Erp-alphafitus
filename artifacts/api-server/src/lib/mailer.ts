import nodemailer from "nodemailer";
import { logger } from "./logger";

export interface SendReportEmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const from = process.env.SMTP_FROM ?? user;
  return { host, port, user, pass, from };
}

export async function sendEmail(opts: SendReportEmailOptions, config?: SmtpConfig): Promise<void> {
  const cfg = config ?? getSmtpConfig();
  if (!cfg) {
    throw new Error("SMTP não configurado (SMTP_HOST, SMTP_USER, SMTP_PASS obrigatórios)");
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const to = Array.isArray(opts.to) ? opts.to.join(", ") : opts.to;

  await transporter.sendMail({
    from: cfg.from,
    to,
    subject: opts.subject,
    text: opts.text,
    attachments: opts.attachments,
  });

  logger.info({ to, subject: opts.subject }, "Email sent successfully");
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}
