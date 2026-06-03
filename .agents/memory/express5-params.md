---
name: Express 5 params typing
description: req.params.* is typed string | string[] in Express 5 — helper functions that take route params must accept both.
---

# Express 5 params typing

## Rule
Any helper function that receives `req.params.*` values must declare its parameter type as `string | string[]`, not just `string`.

**Why:** Express 5 changed the type of `req.params` values to `string | string[]` to support array params. Passing them directly to a function typed `(rawId: string)` causes TS2345.

## How to apply
Pattern used in APS and other routes:

```ts
function parseId(rawId: string | string[], res: Response): number | null {
  const raw = Array.isArray(rawId) ? rawId[0] : rawId;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return null; }
  return id;
}
```

Call as: `const id = parseId(req.params.id, res);`

Apply the same pattern to any other route-param helper function that gets a string from `req.params`.
