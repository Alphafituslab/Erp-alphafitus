---
name: Orval TS2308 collision pattern
description: When an OpenAPI endpoint has both a path param ({id}) AND query params, Orval generates the same name in two places causing TS2308.
---

## The rule
Endpoints with **both path parameters AND query parameters** cause Orval to generate the same `Get{OperationId}Params` TypeScript type in two locations:
1. `lib/api-zod/src/generated/types/<operationId>Params.ts` (TS type)
2. `lib/api-zod/src/generated/api.ts` (Zod schema with same export name)

Both are re-exported from `lib/api-zod/src/index.ts` via `export *`, causing TS2308.

**Why:** Orval uses the operationId to derive the params type name, and generates it independently in the types directory AND as a Zod validation schema in api.ts. When both exist and are barrel-exported, TypeScript throws TS2308.

**How to apply:**
- If a GET endpoint has a path param (e.g. `{id}`) and you want to add query params, either:
  - **Remove the query params** and use server-side defaults (cleanest fix)
  - Or add the query param as an additional path segment instead
- Endpoints with ONLY query params (no path params) are safe — Orval only generates in `types/`.
- Endpoints with ONLY path params (no query params) are safe — no Params type generated at all.
- Renaming the operationId does NOT fix this — the collision pattern is structural.
