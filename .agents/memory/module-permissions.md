---
name: Module permissions system
description: How the granular per-module permission system works for employees in the ERP.
---

## Rule
- `user_module_access` table: userId, module, canEdit, unique(userId, module).
- `auth.tsx` context exposes `canAccessModule(m)` and `canEditModule(m)`.
- admin/manager roles → both helpers always return `true` (no DB lookup needed, modules field is null).
- employee role → explicit DB grants only; modules field is an array in the /me response.

**Why:** ERP needs granular access control per collaborator; admin/manager always have full access to avoid accidental lockout.

**How to apply:**
- To gate a route: use `ModuleGuard` in App.tsx (already wraps all 13 module routes).
- To hide a sidebar item: `canAccessModule` used in layout.tsx NAV_GROUPS filtering.
- To hide CRUD create buttons: `{canEditModule('module') && <Button>...}` — added to all 10 module pages (financeiro, estoque, compras, producao, aps, qualidade, rh, projetos, fiscal, vendas).
- Module keys: relatorios, dashboard, vendas, estoque, compras, producao, aps, qualidade, rastreabilidade, financeiro, fiscal, rh, projetos.
- PermissoesDialog in usuarios.tsx manages grants — uses `syncedData` pattern (not useEffect) to sync server data to local perms state.
