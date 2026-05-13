# PRD: Explore Next-Safe Latency Under Current VRF Semantics

## Problem

Explorer movement already avoids the obvious VRF batching bug: one explore is isolated into its own transaction, and the
provider rejects multicalls with more than one `request_random`.

That protects correctness, but it does not yet minimize the latency that matters most for repeated exploration:

- the provider still performs pre-submit work inside the serialized explore/VRF critical section
- repeated explores pay fresh fee-estimation cost even when recent explore bounds are still representative
- same-explorer follow-up work is still too eager to convert path selection into transaction work before authoritative
  reconcile completes
- latency instrumentation tracks movement broadly, but it does not make "next safe explore ready" a first-class event

The result is a safe system that is still slower than it needs to be for the highest-value loop:

1. player or automation requests an explore
2. transaction submits
3. authoritative world state catches up
4. the same explorer becomes safe to explore again

The optimization target for this pass is step 4, not broader batching and not cosmetic feedback alone.

## Goal

Reduce **time to next safe explore** under the current contract and VRF model.

The final system should:

1. keep one VRF-backed explore per transaction
2. minimize time spent inside the provider's serialized explore submission path
3. reuse recent explore fee/resource-bound knowledge when safe
4. treat same-explorer follow-up explores as queued intents that become executable only after authoritative reconcile
5. preserve parallelism across different explorers
6. expose enough latency tracing to prove whether the change improved the safe-repeat loop

## Non-Goals

- redesigning the VRF provider or introducing explicit VRF request IDs
- allowing multiple explores in one multicall
- changing contract semantics for `request_random`, `explorer_move`, or `explorer_extract_reward`
- broad rewrites of worldmap optimistic movement or the general transaction-center UX
- optimizing global transaction throughput at the expense of same-explorer safety

## Product Principles

- Current VRF semantics are a hard constraint, not an implementation detail.
- Same-explorer throughput matters more than signer-wide batching throughput.
- "Next safe explore ready" is the primary success event.
- Different explorers should stay parallel whenever correctness permits.
- The system should queue **intent**, not stale calldata.

## Desired Behavior

### 1. Provider submit path minimizes serialized work

1. Explore-only fee/resource-bound preparation happens before the per-explorer VRF serialization lock whenever possible.
2. The serialized section is reduced to:
   - lock acquisition
   - final transaction assembly using already-derived assumptions
   - submission
3. The provider keeps the current one-VRF-per-tx guard and the existing per-explorer/per-source lock semantics.

### 2. Explore resource bounds use a short-lived fast path

1. Repeated explores may reuse recent `resourceBounds` on the steady-state path.
2. Cache keys are internal and derived from the active chain/world/signer/transaction type.
3. Cache misses fall back to fresh estimation.
4. Nonce or fee-related retry paths invalidate or refresh the cached entry before the next submission attempt.
5. The fast path never weakens retry safety; stale bounds degrade to a retry/refresh path, not to silent failure.

### 3. Same-explorer follow-up work is intent-gated

1. When the same explorer receives another explore request while prior movement is still unresolved, the system stores a
   follow-up intent instead of eagerly producing the next transaction payload.
2. That intent is rebuilt from fresh explorer position and pathing inputs only after authoritative reconcile completes.
3. Follow-up explores for the same explorer do not become eligible from optimistic state alone.
4. Different explorers can still submit independently.

### 4. Existing authoritative reconcile stays the source of truth

1. The system reuses the current `ArmyManager` authoritative reconciliation surface rather than introducing a second
   "ready" channel.
2. Explore readiness unlocks when the explorer has received authoritative reconciliation, including source-match
   discovery-revert cases.
3. No caller should infer same-explorer readiness solely from tx hash, pending state, or optimistic tween completion.

### 5. Latency tracing measures safe-repeat readiness explicitly

1. Existing army movement latency tracing is extended rather than replaced.
2. Explore-specific phases are recorded for:
   - intent queued
   - submit path started
   - provider lock acquired
   - tx hash or pending emitted
   - authoritative reconcile complete
   - next safe explore unblocked
3. Summary pairs are added for:
   - request -> tx hash/pending
   - tx hash/pending -> authoritative reconcile complete
   - request -> next safe explore unblocked
4. Regression evaluation for rollout is based on these concrete pairs, not on anecdotal hash timing alone.

## Acceptance Criteria

### Provider behavior

- Explore fee estimation no longer consumes serialized lock time when the needed inputs are already known.
- Cached explore `resourceBounds` can satisfy a repeated steady-state explore without a fresh estimate call.
- Cache miss, invalidation, and retry paths still submit correctly.
- The provider still rejects multicalls with more than one VRF request.

### Same-explorer readiness

- A single explorer can submit one explore immediately with no queue-delay batching wait.
- A second explore for the same explorer is held as intent until authoritative reconcile completes.
- That follow-up explore is rebuilt from fresh state rather than replaying stale calldata assumptions.
- Discovery-revert or stale-path mismatches continue to fail safe instead of reintroducing `VrfProvider: not consumed`.

### Cross-explorer parallelism

- Two different explorers can explore concurrently without blocking each other behind signer-wide same-explorer gating.
- Same-explorer gating does not spill over into unrelated explorers owned by the same account.

### Observability

- Latency tracing exposes "next safe explore unblocked" as a first-class phase.
- Summary output includes the three new latency pairs needed to compare before/after safe-repeat performance.

## Implementation Outline

### Workstream 1: Narrow the provider critical section

- Update `packages/provider/src/index.ts` so explore fee/resource-bound preparation occurs before the explore/VRF
  serialization lock when correctness allows.
- Preserve current submit failure classification, timeout handling, and late-submission recovery behavior.
- Keep top-level orchestration readable: preparation, lock, submit, wait, emit.

### Workstream 2: Add explore resource-bound caching

- Add an internal, short-lived explore cache inside the provider submit path.
- Scope the cache to current-network/current-signer/current-transaction-type semantics.
- Use cached bounds only for `TransactionType.EXPLORE`.
- Refresh or invalidate the cache on nonce/resource-bound/fee-related retry or submit failure signals.

### Workstream 3: Convert same-explorer follow-up work into intents

- Introduce same-explorer readiness gating at the caller/orchestrator layer rather than through broader batching.
- Use `ArmyManager` authoritative reconcile notifications as the unlock condition.
- Update the explore automation path so repeated explores for one explorer queue intent and rebuild from fresh state on
  unlock.
- Preserve parallel execution across different explorers.

### Workstream 4: Extend explore latency tracing

- Extend `packages/core/src/systems/army-movement-latency-trace.ts` with explore-specific phases.
- Extend `packages/core/src/systems/army-movement-latency-summary.ts` with pairs centered on tx-hash timing,
  authoritative reconcile, and safe-repeat readiness.
- Record these phases from the provider/client submit path and from the existing authoritative reconcile flow.

## TDD Plan

1. Add provider tests that fail while explore fee estimation still occurs inside the serialized critical section.
2. Add provider tests for explore `resourceBounds` cache hit, miss, and invalidation/refresh on retry-sensitive submit
   failures.
3. Add caller or actor tests that fail while same-explorer follow-up explores are converted into transaction work before
   authoritative reconcile completes.
4. Add game/client tests that prove different explorers are not blocked by same-explorer gating.
5. Add latency-trace and latency-summary tests for:
   - the new explore-specific phases
   - request -> tx hash/pending
   - tx hash/pending -> authoritative reconcile complete
   - request -> next safe explore unblocked
6. Implement the smallest clean orchestration changes needed to make those tests pass.
7. Re-run targeted tests, then run repo-required formatting and dead-code checks.

## Verification

Targeted tests should cover:

- provider submit-path locking and cached bounds behavior
- same-explorer explore gating and follow-up rebuild semantics
- cross-explorer independence
- authoritative reconcile unlock behavior
- explore latency trace and summary output

Required repo checks for this pass:

- `pnpm run format`
- `pnpm run knip`

## Expected Outcome

After this change:

- explore remains one VRF-backed transaction per submission
- the provider spends less time in the serialized explore critical section
- repeated explores can skip unnecessary steady-state estimation work
- same-explorer follow-ups unlock from authoritative truth instead of optimistic assumptions
- different explorers remain parallel
- the repo can measure the exact before/after effect on time to next safe explore
