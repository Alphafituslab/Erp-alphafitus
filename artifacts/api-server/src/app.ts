import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import fs from "fs";

const app: Express = express();

// Disable automatic ETag generation — prevents browsers from caching 401
// responses and replaying them (as 304) after the user logs in.
app.set("etag", false);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Trust the Replit reverse proxy so req.ip / req.protocol are correct.
app.set("trust proxy", 1);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

// Create session table manually — avoids connect-pg-simple's table.sql
// file lookup which breaks when bundled with esbuild.
pgPool
  .query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid"    varchar      NOT NULL COLLATE "default",
      "sess"   json         NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    );
    CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");
  `)
  .catch((err) => logger.error({ err }, "Failed to create user_sessions table"));

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),
    name: "erp.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Do NOT set secure:true — Replit terminates SSL at the edge and
      // forwards plain HTTP internally. express-session's issecure() check
      // would fail and silently suppress the Set-Cookie header.
      // The replit.app domain always enforces HTTPS at the CDN level, so
      // omitting the Secure flag is safe for this internal ERP.
      secure: false,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

app.use("/api", router);

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

export default app;
