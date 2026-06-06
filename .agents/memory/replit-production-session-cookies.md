---
name: Replit production session cookies
description: express-session Secure cookie fix for Replit production (SSL terminated at edge)
---

# Replit production session cookies

## The rule

In Replit production, always inject `X-Forwarded-Proto: https` manually before the session middleware.

```typescript
if (isProduction) {
  app.use((_req, _res, next) => {
    _req.headers["x-forwarded-proto"] = "https";
    next();
  });
}
app.set("trust proxy", 1);
```

**Why:** Replit terminates SSL at the edge and forwards requests to Express over plain HTTP. `express-session`'s internal `issecure()` function checks `req.headers['x-forwarded-proto']` directly when trust proxy is set. If that header is missing or not `'https'`, `issecure()` returns false and the session middleware silently skips setting the `Secure` cookie — so the browser never receives the session cookie and every subsequent request appears as unauthenticated.

**How to apply:** Add this middleware in `app.ts` BEFORE the `session()` middleware, gated on `isProduction`. Keep `trust proxy: 1` as well for consistency with Express's own `req.secure` / `req.protocol`.

## Also required for PostgreSQL sessions (esbuild bundles)

`connect-pg-simple` reads a `table.sql` file at runtime using `__dirname`. When bundled with esbuild the file path breaks. Fix: create the session table manually via `pgPool.query(CREATE TABLE IF NOT EXISTS ...)` at startup and use `createTableIfMissing: false`.
