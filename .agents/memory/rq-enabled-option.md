---
name: React Query enabled cast in Orval hooks
description: Passing `enabled` to Orval-generated hooks requires `as any` cast in RQ v5 because UseQueryOptions requires queryKey.
---

## Rule
When passing `{ query: { enabled: someCondition } }` to any Orval-generated hook, cast it:
```ts
useGetSomething(id, { query: { enabled: !!id } as any });
```

**Why:** In React Query v5, `UseQueryOptions` has `queryKey` as a required field. Orval generates hooks that accept `options?: { query?: UseQueryOptions<...> }`, so TypeScript complains TS2741 when you only pass `{ enabled }`. The generated hook internally merges its own `queryKey` at runtime, so the cast is safe.

**How to apply:** Any time you pass partial query options (just `enabled`, just `select`, etc.) to an Orval-generated hook — use `as any` on the `query` object. Applies to all `useGet*`, `useList*` hooks in this project.
