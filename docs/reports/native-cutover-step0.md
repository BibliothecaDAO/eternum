# Native cutover step 0: test and CI diet handback

This records F41's accepted diet and its follow-ups. It does not include test changes from other streams that landed
later on the integration branch.

## Behaviors still protected

| Area / commit                                                 | Behavior protected                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client: initial `116b671cdd9`, completion `148b76fab10`       | Combat/stamina/production and coordinate calculations; pending-action presentation; authoritative world updates; world entry and reconnect; chunk transitions and terrain geometry; renderer fallback, resource disposal and input; installation and notification behavior. Asset loading and rendering checks remain in `verify:assets` and the terrain gallery.                                                                 |
| Assets `78f55d92911`                                          | Every shipped icon meets its format, dimensions, transparency, size and uniqueness contract; one real approved-master normalization preserves the published artwork. Removed constant path mapping and repeating the same normalization over the full icon set.                                                                                                                                                                   |
| Core `0b14f02052c`                                            | Atomic fact-store updates, game isolation, confirmed/overlay reconciliation, missing-config failure, nonce/ticket resolution, snapshots and reconnect, resource/combat calculations and complete ordered entity keys.                                                                                                                                                                                                             |
| Chain `12f5747dd83`                                           | Endpoint resolution and rejection of the wrong chain.                                                                                                                                                                                                                                                                                                                                                                             |
| Provider `410e0efdfdb`, `c5a5f267647`                         | Explore estimates have no cross-command cache. Real provider-to-command encoding; large-integer preservation; command/bridge ordering; bounded zero-tip submissions; proven-revert rejection; independent actors, ticket-specific outcomes, late admission and stalled-stream recovery.                                                                                                                                           |
| Herald `8195af68587`, `17a6ed9c65b`                           | Frontier isolation across every snapshot model keyed by entity, with symmetric resource-weight, name and production fixtures; Blitz parity; decoding, fold and replay; actor-specific transaction outcomes; PostgreSQL checkpoint restoration; commit-time history rollback, restart and cursor/projection consistency.                                                                                                           |
| Launch `fac1ee0347e`, `0d809e82a83`                           | HTTP authorization/validation/idempotency through PostgreSQL; durable lease recovery and stable start time; interruption on lease loss without overwriting the successor lease; stale-lease completion refusal; atomic creation/result scheduling; slot registration races, roster persistence/splitting and result calculation. The injected executor is the external chain boundary; the former copied in-memory store is gone. |
| Identity `85c8476ea92`                                        | Authenticated preferences, concurrent preference writes, push-subscription persistence and notification deduplication against PostgreSQL.                                                                                                                                                                                                                                                                                         |
| Portal `c7630dcd477`                                          | Authentication, concurrent one-time nonce consumption against PostgreSQL, ownership calculations and retained account/domain calculations.                                                                                                                                                                                                                                                                                        |
| Deployer `9d8d708e8c9`, `67cf6afb66b`                         | Preset validation, registry creation/recovery, launch time parsing, contract-call construction and fail-closed missing rules/tokens; receipt recovery and failed-deployment handling.                                                                                                                                                                                                                                             |
| Database `810cf84a0ef`                                        | Removed only the Drizzle configuration-equality test. Real persistence/schema behavior is exercised by the service suites.                                                                                                                                                                                                                                                                                                        |
| Runtime, L2 and native contracts: unchanged behavioral suites | Runner/harness failures and cancellation, sandbox proxy, native rules, randomness protocol, schema/ABI drift, AMM, collectibles, MMR and season pass.                                                                                                                                                                                                                                                                             |
| Release `78ab84c8ed5`                                         | Version bump, tag and GitHub release remain; release notes now come directly from the commit log.                                                                                                                                                                                                                                                                                                                                 |
| CI `8f98abf8d18`, `707bbad35fc`                               | Pushes to `next` and `native-*` use the same path selection, including deleted files. First branch pushes compare with `origin/next`. One aggregate requires every selected area to succeed and rejects failures, cancellations and unexpected skips. Client/core and static checks are folded; duplicate scheduled checks are removed.                                                                                           |

## Deleted groups by class

[Every deleted or replaced group, with its original title and class](native-cutover-step0-deleted-tests.md). The
inventory contains 983 old titles or parameterized groups across 270 files, including partial replacements. Counts
describe the result; the retained boundaries above are the acceptance evidence.

The final deleted suite is `config/deployer/clean/tests/native-preset.integration.test.ts`:
`deployer Eternum preset registers tokens and executes a deposit and withdrawal`. Its class is a conditionally skipped
live-fixture integration suite. It required a deployed chain, funded token, administrator and admission fixtures that CI
does not provide. It is deleted rather than silently passing without executing. Preset validation, registrar behavior
and native contract rules remain. There is no retained end-to-end replacement for that exact funded-token
deposit/withdrawal scenario in the normal CI gate.

The old mock-heartbeat lease-loss group remains in the historical deletion inventory. Its behavior is now covered
against PostgreSQL by
`interrupts execution when a revoked lease is requeued and reclaimed without overwriting its new owner`. The executor is
suspended while the real store revokes and reclaims its lease. A real failed heartbeat interrupts it; the stale worker
cannot requeue or complete the successor's run.

Commit `612a02186e1` removes the approved retired digest directory, the `smoke:game-client` package entry and its
orphaned runner. Deployment smoke checks remain in `deploy-client.yml`. Repository secrets and branch protection remain
under the owner's control.

## Client suite time

The same isolated-box command, `pnpm --dir apps/game test`, produced:

```text
Before the diet:
Test Files  695 passed (695)
Tests       3480 passed (3480)
Duration    201.84s

After the completed client diet, at 8f98abf8d18:
Test Files  459 passed (459)
Tests       2495 passed (2495)
Duration    105.74s
```

That is 52% of the original duration, a 48% reduction. The later `78f55d92911` change affects the separate asset gate,
not the normal client suite. Hosted runs measured 117.14s before and 113.78s after; those hosts do not support a claim
of the same speedup. These are diet measurements, not a new benchmark of subsequent stream changes.

## Scope evidence

The strengthened scope tests passed after incorporating integration head `881cfd0c5cd`:

```text
cd apps/herald
pnpm exec vitest run --config ../../.context/step0-vitest.config.mjs src/live-world.test.ts src/blitz-stream.test.ts --reporter=verbose
✓ keeps two expedition scopes isolated through depth changes, overlay reset, reconnect and rollover
✓ preserves the whole Blitz game's facts through snapshot, overlay, confirmation and reconnect
Test Files  2 passed (2)
Tests       8 passed (8)
Duration    2.73s
```

The temporary configuration resolves workspace sources without rebuilding packages locally. CI runs the regular Herald
suite after building packages. The same Blitz test also passed at `88f75cda7e3`, the parent of `e22ec7c777f`: 1 file, 1
test, 3.18s. Actor-private nonces and outcomes remain intentionally private.

## Gate evidence and ownership

The accepted step-0 [validation run at 78f55d92911](https://github.com/BibliothecaDAO/eternum/actions/runs/35778372208)
passed all selected areas, including PostgreSQL-backed Herald, launch, identity and portal suites. The follow-up
provider suite passes 8 files and 146 tests in 2.26s after cache deletion and integration. The restored worker test runs
in the services gate's PostgreSQL 17 fixture; missing database configuration fails. The repository-wide required-check
switch remains with the owner when the workflow reaches `next`.

High-churn dispositions: core native-world tests retain nonce resolution and fail-closed store behavior while deleting
generated/configuration copies; provider tests now exercise public submission boundaries; Herald transaction tests stay
because their history changes ticket attribution, recovery, batch completion and actor isolation.

Release notes still come from the commit log. The extracted notes step passed its dry run, and workflow lint passed. The
scope and diet follow-ups do not redeploy the shared stack. F43 is cancelled; game identity remains
`(chain id, game id)`. F42/C1 is outside this work.
