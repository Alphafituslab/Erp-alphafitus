---
name: CQ stock idempotency
description: How to correctly update product lot stock when approving/rejecting a CQ analysis — prevents double-counting.
---

## Rule

On **approval**: `released = totalQty - reservedQty`; `stockDelta = released - prevAvailable`; set `blockedQty = "0"`.
On **rejection**: `stockDelta = -prevAvailable`; set `availableQty = "0"`, `blockedQty = totalQty`.

**Why:** If the route is called twice (retry, bug), using a fixed `+totalQty` would double-count. The delta approach is idempotent — if availableQty is already at `released`, the delta is 0.

**How to apply:** In `/qualidade/analyses/:id/complete` transaction, always read `prevAvailable = parseFloat(lot.availableQty)` before computing the delta.
