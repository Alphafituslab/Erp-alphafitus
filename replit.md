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
- `users` — authentication, roles (admin/manager/employee), `employee_id` FK for unified access
- `clients` — client registry (full: razão social, CNPJ, endereços cobrança/entrega, limite crédito)
- `suppliers` — supplier registry (full: CNPJ, endereço, contato, dados bancários, qualificação)
- `products` — product catalog (full: NCM, CEST, shelf life, storage conditions, regulatory info)
- `product_lots` — lot control with CQ status (quarantine/approved/rejected/blocked), FEFO
- `stock_movements` — inventory input/output movements with lot reference
- `warehouses` — depot/warehouse registry for lot transfers
- `purchase_orders` + `purchase_order_items` — purchasing workflow (draft→sent→received)
- `purchase_requests` — purchase requisitions with approval workflow
- `quotations` + `quotation_items` — multi-supplier quoting with winner selection
- `sales_orders` + `sales_order_items` + `sales_order_logs` — full 25-status commercial flow
- `employees` + `departments` + `attendance_logs` — HR module
- `trainings` + `employee_trainings` — training/certification tracking with compliance matrix
- `financial_entries` — accounts payable/receivable with cashflow
- `fiscal_documents` — NF-e/NFS-e registry with XML import
- `projects` + `project_tasks` — project management
- `quality_analyses` + `analysis_parameters` + `quality_certificates` — CQ with PDF laudos
- `quality_inspections` + `quality_ncrs` — inspections and non-conformances
- `formulas` + `formula_items` — product formulas/recipes with versioning
- `production_orders` + `production_stages` + `production_material_consumptions` — full OP flow
- `aps_work_centers` + `aps_shifts` + `aps_schedule` — APS planning with Gantt
- `backup_logs` — admin backup audit trail
- `report_schedules` + `dashboard_goals` + `goal_alert_settings` — reports and KPI goals

## ERP Modules (all at /erp/)

| Route | Module | Status |
|-------|--------|--------|
| /login | Login | Done |
| /dashboard | Painel Executivo (KPIs + alertas + gráfico) | Done |
| /financeiro | Financeiro (CP/CR, fluxo de caixa realizado+projetado) | Done |
| /vendas | Vendas (25 status, pipeline Kanban, timeline, NF) | Done |
| /estoque | Estoque (lotes, FEFO, alertas vencimento, transferências) | Done |
| /compras | Compras (solicitação, cotação multi-fornecedor, recebimento, quarentena) | Done |
| /producao | Produção (fórmulas, OPs, etapas, apontamento, rastreabilidade) | Done |
| /aps | APS (Gantt, centros de trabalho, turnos, simulação, OEE) | Done |
| /qualidade | Qualidade (análises, parâmetros, laudos PDF, NCRs, certificados) | Done |
| /rastreabilidade | Rastreabilidade (forward/backward trace por lote) | Done |
| /rh | RH (funcionários, treinamentos, matriz competências, acesso unificado) | Done |
| /projetos | Projetos (tarefas, Kanban, cronograma) | Done |
| /fiscal | Fiscal (NFs, impostos, importação XML NF-e) | Done |
| /relatorios | Relatórios (dashboard gerencial, metas, agendamento, alertas) | Done |
| /usuarios | Usuários (gestão de usuários, backup banco de dados) | Done |

## Test Users (dev)

- Admin: `admin@empresa.com.br` / `Admin@2025`
- Employee: `joao@empresa.com.br` / `Admin@2025`

## Architecture decisions

- Gerenciamento de Usuários (`/usuarios`): a coluna "Permissões" na tabela principal mostra um badge clicável (resumo: "Total (admin/gerente)" ou "N permissão(ões)"/"Nenhuma") que abre o `PermissoesDialog` diretamente — não há mais ícone de escudo escondido na coluna Ações. O campo `moduleCount` em `UserItem` (OpenAPI) alimenta esse resumo. O Status também virou um `Switch` de toggle rápido na própria linha, em vez de badge estático.


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
