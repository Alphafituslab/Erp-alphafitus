---
name: Vendas 10-step flow
description: New sequential order status machine with sector-based guards — replaces old 25-status flow.
---

## The new 10-step flow (in order)
awaiting_approval → financial_approved → sent_to_production →
ready_for_separation → awaiting_billing → partially_billed →
fully_billed → with_carrier → delivered

Plus terminal branches: rejected_total, rejected_pending_docs (→ awaiting_approval), cancelled.

## Sector guards (enforced server-side in vendas.ts)
| Transition | Required sector |
|---|---|
| awaiting_approval → financial_approved / rejected_* | financeiro |
| financial_approved → sent_to_production | vendas |
| rejected_pending_docs → awaiting_approval | vendas ou financeiro |
| sent_to_production → ready_for_separation | producao |
| ready_for_separation → awaiting_billing | separacao |
| awaiting_billing → partially/fully_billed | faturamento |
| partially_billed → fully_billed | faturamento |
| fully_billed → with_carrier | logistica |
| with_carrier → delivered | logistica |
| → cancelled | manager/admin only |

**Why:** business spec requires strict sequential accountability — each department owns exactly its step.

**How to apply:** employees with role="employee" get their sector stored in `users.sector` column. The server reads it on each status POST and enforces the SECTOR_TRANSITIONS map in vendas.ts. Managers/admins bypass all sector checks.

## Key DB columns added
- `users.sector` (text nullable) — vendas|financeiro|producao|separacao|faturamento|logistica
- `sales_order_items.billed_qty` (numeric, default 0) — for partial billing tracking

## Legacy statuses
Old 25 statuses kept in ALL_STATUSES for existing DB rows. Legacy rows can only be cancelled (by manager/admin) or for "draft" → awaiting_approval.

## New order initial status
New orders (type='order') start at `awaiting_approval` (not `draft`). Quotes still start at `draft`.
