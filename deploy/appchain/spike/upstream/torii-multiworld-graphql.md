# Upstream issue for dojoengine/torii
#
# POSTED 2026-08-03:
# - Issue: https://github.com/dojoengine/torii/issues/433
# - PR:    https://github.com/dojoengine/torii/pull/434
#   (branch fix/multi-world-graphql-duplicate-fields on djizus/torii —
#   dedupe + regression test; verified failing pre-fix, passing post-fix)
# Once a torii release ships with the fix, drop the local fork image
# (docker/torii/ + scripts/build-torii.sh) and pin the released version.

**Title:** GraphQL server panics when indexing multiple worlds that register
the same model names

**Body:**

## Summary

When torii indexes more than one world (multiple `WORLD:` entries in
`indexing.contracts`) and those worlds register models with identical
`(namespace, name)` — e.g. several instances of the same game deployed from
the same code — the GraphQL schema build panics and takes the whole process
down:

```
thread 'torii-query' panicked at .../async-graphql-7.0.11/src/dynamic/object.rs:82:9:
Field `s1EternumAgentConfigModels` already exists
Error: GraphQL server task panicked: task 65 panicked with message "Field `s1EternumAgentConfigModels` already exists"
```

## Reproduction

- torii v1.8.16, katana v1.8.0-rc.9
- `sozo migrate` the same project twice with two different world seeds
- run one torii with both worlds in `indexing.contracts = ["WORLD:<w1>", "WORLD:<w2>"]`
- torii indexes both correctly (SQL/storage rows are world_address-scoped),
  then exits when the GraphQL schema builds

## Cause

`crates/graphql/src/schema.rs` `build_objects()` does `SELECT * FROM models`
across all worlds and derives GraphQL field/type names from
`(namespace, name)` only (`utils::field_name_from_names`) — the same model
registered by two worlds produces a duplicate dynamic field, and
async-graphql panics. Still the case on `main`.

## Suggested fix

Dedupe models by `(namespace, name)` in `build_objects()` (world-scoped access
remains available via SQL/gRPC), or scope GraphQL field names by world.
Happy to open a PR with the dedupe variant — we run this patch in production.
