---
name: Vendas order approval-gated edit/delete
description: How edit/delete of sales orders is protected once a pedido leaves draft, and where the salesperson/commission auto-fill lives.
---

Sales orders in `draft` or `awaiting_approval` can be freely edited/deleted. Any other status (financial_approved, sent_to_production, legacy statuses, etc.) requires re-authentication before editing or deleting.

**Why:** once an order has moved into the commercial/production flow, uncontrolled edits could desync downstream sectors (finance, production, fiscal) that already acted on it.

**How to apply:** re-auth uses `POST /auth/verify-password` (`{password}` → `{ok, authorizedBy}`), which accepts either the current session user's password or any active admin/manager's password — it is a shared supervisor-override gate, not strictly self-service. The frontend gate is a generic `{action, order}`-driven dialog, not tied to a specific field, so new gated actions can reuse the same pattern instead of building bespoke confirm dialogs per action.

Salesperson and commission are derived, not manually entered per order: `clients.salespersonId` links a client to an employee, and the employee's `commissionRate` auto-fills the order's commission field when a client is selected. If this pattern needs to extend to other order-derived fields, follow the same "auto-fill from linked entity on client selection" approach rather than duplicating data entry.
