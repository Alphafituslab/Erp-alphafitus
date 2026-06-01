# NEXUS ERP

Sistema ERP exclusivo da empresa, unificando todos os módulos de gestão em uma única plataforma com login centralizado.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/erp run dev` — run the ERP frontend (port 18996)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — Secret for express-session cookie signing

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + express-session (cookie-based auth)
- DB: PostgreSQL + Drizzle ORM
- Auth: bcryptjs password hashing, session cookies (`erp.sid`)
- Frontend: React + Vite + Wouter + Shadcn/UI + Tailwind CSS
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/erp/` — ERP frontend (React + Vite), preview at `/erp/`
- `artifacts/api-server/` — Express API server, at `/api`
- `lib/db/src/schema/` — All database table definitions (one file per domain)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — Generated Zod schemas (do not edit)

## Database Schema

Tables defined (all in `lib/db/src/schema/`):
- `users` — authentication, roles (admin/manager/employee)
- `clients` — client registry
- `suppliers` — supplier registry
- `products` — product catalog with stock levels
- `stock_movements` — inventory input/output movements
- `purchase_orders` + `purchase_order_items` — purchasing workflow
- `sales_orders` + `sales_order_items` — sales/quotes workflow
- `employees` + `departments` + `attendance_logs` — HR module
- `financial_entries` — accounts payable/receivable
- `fiscal_documents` — NF-e/NFS-e registry
- `projects` + `project_tasks` — project management

## ERP Modules (all at /erp/)

| Route | Module | Status |
|-------|--------|--------|
| /login | Login | Done |
| /dashboard | Home dashboard | Done |
| /financeiro | Financeiro | Placeholder |
| /vendas | Vendas/Comercial | Placeholder |
| /estoque | Estoque | Placeholder |
| /compras | Compras | Placeholder |
| /rh | RH | Placeholder |
| /projetos | Projetos | Placeholder |
| /fiscal | Fiscal | Placeholder |
| /relatorios | Relatórios | Placeholder |

## Test Users (dev)

- Admin: `admin@empresa.com.br` / `Admin@2025`
- Employee: `joao@empresa.com.br` / `Admin@2025`

## Architecture decisions

- Session-based auth (cookie `erp.sid`) — simpler than JWT for internal ERP, no token refresh needed
- OpenAPI-first: spec in `lib/api-spec/openapi.yaml` gates all codegen; never hand-write hooks or Zod schemas
- `credentials: 'include'` added to `lib/api-client-react/src/custom-fetch.ts` — required for session cookies in same-site fetch
- All 8 ERP modules share one React app at `/erp/` with role-based navigation
- DB schema is split into one file per domain under `lib/db/src/schema/`

## Product

ERP interno com 8 módulos integrados: Financeiro, Vendas, Estoque, Compras, RH, Projetos, Fiscal e Relatórios. Acesso via login com email/senha, sistema de roles (admin, manager, employee), navegação por sidebar persistente após autenticação.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing DB schema, run `pnpm --filter @workspace/db run push` then `pnpm run typecheck:libs` to rebuild declarations before API server typecheck
- After changing OpenAPI spec, run `pnpm --filter @workspace/api-spec run codegen` before using new types
- `credentials: 'include'` is set globally in `lib/api-client-react/src/custom-fetch.ts` — do NOT remove it or session cookies won't be sent
- Body schemas in OpenAPI must be entity-named (`LoginInput` not `LoginBody`) to avoid TS2308 collision with Orval-generated names

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
