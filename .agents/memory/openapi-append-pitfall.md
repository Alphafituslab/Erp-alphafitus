---
name: OpenAPI append pitfall
description: Why cat >> lib/api-spec/openapi.yaml breaks the YAML structure and how to avoid it
---

## Rule
Never append to `lib/api-spec/openapi.yaml` using `cat >>` or shell redirection. The spec file has `paths:` and `components: schemas:` as separate top-level sections; appending always lands in the wrong section.

**Why:** `paths:` ends mid-file before `components:`, so appended content goes inside `components/schemas:`, producing invalid path entries as schema names and breaking Orval codegen with "Property is not expected to be here" errors.

**How to apply:**
- Add new paths using the `edit` tool, inserting BEFORE the `components:` line.
- Add new schemas using the `edit` tool, appending AFTER the last existing schema (still inside `components/schemas:`).
- After any spec change, run `pnpm --filter @workspace/api-spec run codegen` and verify it exits cleanly.
