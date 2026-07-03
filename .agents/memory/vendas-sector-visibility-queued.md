---
name: Vendas sector-visibility + status PIN gate (queued feature)
description: Confirmed requirements for a not-yet-implemented feature — read this before building right-click status change / sector-filtered order screens in vendas.tsx.
---

User confirmed the following design for a queued feature (not yet built as of 2026-07-03):

1. **Right-click context menu** to change a sales order's status must work in BOTH places: the Orçamentos & Pedidos table list AND the Pipeline (Kanban) cards.
2. **Supervisor PIN gate**: changing status via this menu requires a manager password UNLESS the acting employee already has a "login mestre" flag enabled on their employee/user record — add a boolean (e.g. `hasMasterAccess`) to employees/users; if true, skip the PIN prompt, otherwise prompt for a manager password before applying the change.
3. **Sector-filtered visibility**: each sector (Financeiro, Produção, Separação, Faturamento, Logística) should, by default, only see orders currently in their stage of `SECTOR_TRANSITIONS`. When status changes, the order must disappear from the previous sector's screen and appear on the next sector's screen automatically (i.e. filter the orders list/pipeline by the sector matching the order's current status, not by all orders).
4. Admin/manager (or master-access) users must still be able to see ALL orders across all sectors/stages regardless of the above filtering — a global unfiltered view.
5. All status changes remain fully traceable via `sales_order_logs` (already implemented — includes fromStatus/toStatus/userId/notes).

**Why this file exists:** the user paused this request mid-conversation to prioritize a different large feature (New Order dialog overhaul, #1-15 list). Read this before resuming so the clarifying questions don't need to be re-asked.
