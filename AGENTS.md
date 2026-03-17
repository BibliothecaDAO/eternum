# Repository Agent Instructions

This file defines the default coding and review standard for the entire repository.

On startup, read this file first.
Then read any more specific `AGENTS.md` file in the subdirectory you are working in.
More specific files may add local rules, but they should not lower the quality bar defined here.

## Clean Code Standard

Write code so the top level reads like an outline of intent.
The reader should understand what the code does before they need to understand how it does it.

### Core Rule

At the top level of a file, exported functions, orchestration functions, and workflow steps should read in business terms, not implementation terms.

Bad:

- inline payload construction
- inline query construction
- inline chain/id/address selection logic
- nested conditionals with transaction details inside them
- long object literals mixed into orchestration
- repeated path/json/fs boilerplate

Good:

- `resolveLaunchConfiguration(...)`
- `grantVillagePassRoleToRealmInternalSystemsIfNeeded(...)`
- `buildTroopConfigPayload(...)`
- `resolveStarknetChainId(...)`
- `writeLaunchSummary(...)`

### One Level Of Abstraction Per Function

Each function should stay at one conceptual level.

- Orchestration functions should orchestrate.
- Payload builders should build payloads.
- Resolvers should resolve values.
- Writers should write artifacts.
- Validators should validate.

Do not mix these responsibilities in one function unless the function is trivially small.

### Top-Level Readability

When reading an exported function from top to bottom, it should feel like a checklist.

Example shape:

1. Validate inputs.
2. Resolve context.
3. Build or load dependencies.
4. Execute the main action.
5. Persist artifacts or summary.
6. Return the result.

If a top-level `if` block contains a full transaction body, a long object literal, or several unrelated operations, extract that body into a helper with a precise name.

At the orchestration layer, an `if` block should usually look like this:

```ts
if (isEternumEnvironment) {
  await grantVillagePassRoleToRealmInternalSystemsIfNeeded(...);
}
```

not like this:

```ts
if (isEternumEnvironment) {
  // 20+ lines of inline role-grant logic
}
```

### Naming

Use names that describe what the code means in the domain, not what the syntax is doing.

Prefer:

- `buildSeasonConfigPayload`
- `resolveFactoryWorldProfile`
- `createIndexerViaGitHubActions`
- `writeVillagePassRoleArtifacts`

Avoid:

- `handleData`
- `doThing`
- `processConfig`
- `temp`
- `misc`
- `utils`

If a helper name feels vague, the helper is probably hiding the wrong abstraction.

### Conditional Logic

Keep conditions simple at the top level.

- Pull complex boolean logic into `is...`, `has...`, `should...`, or `matches...` helpers.
- Pull action bodies into `build...`, `resolve...`, `create...`, `grant...`, `write...`, or `run...` helpers.
- Prefer one clear condition per branch.

If two branches do different domain actions, they should usually call different helpers.

### Data Construction

Do not bury business intent inside large inline object literals.

When a payload is non-trivial, extract it:

- `buildTroopConfigPayload`
- `buildBlitzRegistrationConfigPayload`
- `buildCapacityConfigPayload`

When a payload is trivial and obviously local, keeping it inline is acceptable.

### Shared Logic

If the same kind of resolution or IO exists in more than one place, centralize it.

Examples:

- chain parsing and chain IDs belong in shared chain helpers
- repo-relative JSON/text reads and writes belong in shared repo/path helpers
- account credential resolution belongs in one shared credential helper
- manifest address lookups belong in manifest/factory helpers

Do not copy small “temporary” helpers across files in the clean module.
If it is reusable, make it shared.

### File Structure

Keep related code together and keep file names honest.

- `shared/` is for genuinely shared helpers
- `factory/` is for factory discovery or factory-owned concepts
- `launch/` is for launch orchestration and launch artifacts
- `role-grants/` is for generic and specialized role-grant flows
- `config/` is for config loading, step selection, execution, and native config application
- `indexing/` is for indexer dispatch and tracking

Do not leave domain logic in the wrong folder once the true ownership is clear.

### Mutations And Results

Prefer clear result flow over scattered mutation.

- Collect related data into named result objects.
- Mutate summaries deliberately and near the orchestration flow.
- Avoid passing partially-known state through many helpers.

If a helper requires a fully resolved object, require it explicitly instead of threading optionals through the success path.

### Comments

Comments should explain why a choice exists, not restate obvious code.

Good comments:

- explain a protocol constraint
- explain why a branch exists
- explain why a fallback is safe

Bad comments:

- narrate assignments
- restate function names
- excuse unclear code instead of improving it

### Before Finishing

Do one review pass specifically for readability.

Read the exported functions and top-level helpers in order and ask:

1. Can I understand the flow without descending into helper bodies?
2. Are helper names specific enough that I trust them immediately?
3. Is any top-level block still carrying payload, query, fs, or transaction detail?
4. Is any shared logic duplicated across files?
5. Is any file doing work that belongs in a different folder?

If the answer to any of these is yes, refactor again before stopping.

## Non-Negotiable Rule

Do not leave sloppy code behind because it "works".

If the structure is hard to read, the work is not done.
