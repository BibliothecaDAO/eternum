# Onchain-Agent Test Drift Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make test expectations match current `client/apps/onchain-agent` behavior and keep live Torii tests stable via schema/shape-first checks against `testy-testy-9`.

**Architecture:** Fix drift at the test layer first. For each failing suite, write or adjust focused failing tests that represent current behavior, verify RED, then apply minimal test updates (or runtime updates only when a true defect is proven). Validate by targeted suites and final full run.

**Tech Stack:** Bun, Vitest, TypeScript, Node fetch.

---

### Task 1: Re-baseline and lock failing targets

**Files:**
- Read: `.context/onchain-agent-vitest-full.json`
- No code changes

**Step 1: Run failing inventory command**

Run:
```bash
cd client/apps/onchain-agent
bunx vitest --run --reporter=json --outputFile ../../.context/onchain-agent-vitest-full.json || true
```

**Step 2: Verify expected failing suite list still matches drift scope**

Run:
```bash
jq -r '.testResults[] | select(.status=="failed") | .name' ../../.context/onchain-agent-vitest-full.json
```

**Step 3: Commit checkpoint (optional if no file changes)**

```bash
git status --short
```

### Task 2: Action-registry and adapter drift correction

**Files:**
- Modify: `client/apps/onchain-agent/test/action-definitions.test.ts`
- Modify: `client/apps/onchain-agent/test/adapter/action-registry.test.ts`
- Modify: `client/apps/onchain-agent/test/adapter/action-registry.more.test.ts`
- Modify: `client/apps/onchain-agent/test/adapter/eternum-adapter.test.ts`
- Modify: `client/apps/onchain-agent/test/e2e/pi-integration.test.ts`
- Read if needed: `client/apps/onchain-agent/src/adapter/action-registry.ts`

**Step 1: Write/update failing setup for explicit initialization requirement**

Ensure tests initialize action registry with test manifest before asserting handlers/actions.

**Step 2: Verify RED on targeted suite**

Run:
```bash
cd client/apps/onchain-agent
bunx vitest --run test/adapter/action-registry.test.ts test/action-definitions.test.ts
```
Expected: failure reflects missing/incorrect test setup assumptions.

**Step 3: Apply minimal test updates for current behavior**

- Add shared initialization helper in tests.
- Keep one explicit negative test for uninitialized registry error path.

**Step 4: Verify GREEN on targeted suite**

Run:
```bash
bunx vitest --run test/adapter/action-registry.test.ts test/adapter/action-registry.more.test.ts test/action-definitions.test.ts test/adapter/eternum-adapter.test.ts test/e2e/pi-integration.test.ts
```

### Task 3: TUI API drift correction

**Files:**
- Modify: `client/apps/onchain-agent/test/tui/app.test.ts`
- Read: `client/apps/onchain-agent/src/tui/app.ts`

**Step 1: Write/update failing mock expectations for `addInputListener` API**

**Step 2: Verify RED**

Run:
```bash
cd client/apps/onchain-agent
bunx vitest --run test/tui/app.test.ts
```

**Step 3: Apply minimal mock/test updates**

- Mock `addInputListener` and drive input through captured listener.
- Keep behavior assertions unchanged (prompt, steer, errors, dispose).

**Step 4: Verify GREEN**

Run:
```bash
bunx vitest --run test/tui/app.test.ts
```

### Task 4: Session fixture path drift correction

**Files:**
- Modify: `client/apps/onchain-agent/test/session/abi-policy-gen.test.ts`
- Modify: `client/apps/onchain-agent/test/session/controller-session.test.ts`
- Optional create: `client/apps/onchain-agent/test/session/fixtures/*`

**Step 1: Write/update failing fixture-resolution tests**

Use local deterministic fixture paths only.

**Step 2: Verify RED**

Run:
```bash
cd client/apps/onchain-agent
bunx vitest --run test/session/abi-policy-gen.test.ts test/session/controller-session.test.ts
```

**Step 3: Apply minimal fixture-path and fixture-content updates**

- Replace root-level missing fixture references.
- Keep assertions aligned with current manifest/policy generation behavior.

**Step 4: Verify GREEN**

Run same command from Step 2.

### Task 5: World-state and ABI schema drift correction

**Files:**
- Modify: `client/apps/onchain-agent/test/adapter/world-state.test.ts`
- Modify: `client/apps/onchain-agent/test/utils/mock-client.ts`
- Modify: `client/apps/onchain-agent/test/abi/action-gen.test.ts`
- Read: `client/apps/onchain-agent/src/adapter/world-state.ts`
- Read: `client/apps/onchain-agent/src/abi/parser.ts`

**Step 1: Write/update failing tests for current SQL method preference and param types**

**Step 2: Verify RED**

Run:
```bash
cd client/apps/onchain-agent
bunx vitest --run test/adapter/world-state.test.ts test/abi/action-gen.test.ts
```

**Step 3: Apply minimal test/mock updates**

- Align mock SQL surface with `fetchResourceBalancesWithProduction` path.
- Update type allowlist to include current valid `object` schema type.

**Step 4: Verify GREEN**

Run same command from Step 2.

### Task 6: Live Torii suite stabilization on `testy-testy-9`

**Files:**
- Modify: `client/apps/onchain-agent/test/e2e/torii-live.test.ts`

**Step 1: Write/update failing schema-first assertions using `testy-testy-9` base URL**

- Replace stale deployment assumptions.
- Remove brittle fixed-owner/fixed-value assertions.

**Step 2: Verify RED**

Run:
```bash
cd client/apps/onchain-agent
bunx vitest --run test/e2e/torii-live.test.ts
```

**Step 3: Apply minimal stabilization updates**

- Assert endpoint reachability.
- Assert key table availability and expected row-shape/type contracts.
- Keep transform pipeline checks while avoiding world-content constants.

**Step 4: Verify GREEN**

Run same command from Step 2.

### Task 7: Full verification and wrap-up

**Files:**
- No required file edits

**Step 1: Run full suite**

Run:
```bash
cd client/apps/onchain-agent
bun run test
```

**Step 2: Optional coverage run for regression visibility**

Run:
```bash
bunx vitest --run --coverage
```

**Step 3: Confirm clean status**

Run:
```bash
cd /Users/boat/conductor/workspaces/eternum/bangalore-v2
git status --short
```
