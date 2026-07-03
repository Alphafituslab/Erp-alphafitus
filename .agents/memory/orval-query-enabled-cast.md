---
name: Orval hook query.enabled typing
description: Why generated React Query hooks need an `as any` cast when passing `{ query: { enabled } }` options.
---

When calling an Orval-generated `useGetX`/`useListX` hook with a conditional `enabled` flag, e.g.:

```ts
useListPriceTableItems(id, { query: { enabled: !!id } })
```

TypeScript reports `Property 'queryKey' is missing`. The generated `UseQueryOptions` type in this repo's codegen output requires `queryKey` unless the options object is cast.

**Why:** the Orval template used here types the `query` option strictly against `UseQueryOptions<...>` with a required `queryKey`, but callers only want to override `enabled` and let the hook supply its own default query key.

**How to apply:** cast the options object with `as any` (established convention already used throughout `artifacts/erp/src/pages/*.tsx`, e.g. `{ query: { enabled: !!x } as any }`). Don't fight the generated types here — this is the accepted pattern in this codebase.
