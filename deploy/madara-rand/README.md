# Recorded randomness rehearsal

This isolated Compose project uses `docker compose -p madara-rand`. It does not operate the existing lab node. Evidence
is **single-host rehearsal, not the host-independence gate**. Operator honesty remains trusted.

## Journal mechanism

The choice and procedure were recorded in PR #4995 before implementation. PostgreSQL 17 physical streaming replication
provides the transactional store. The pinned image is
`postgres@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73`. The primary and hot standby use
distinct volumes. Required settings are `fsync=on`, `full_page_writes=on`, `synchronous_commit=remote_apply` and
`synchronous_standby_names='FIRST 1 (journal_standby)'`. PostgreSQL's
[synchronous replication](https://www.postgresql.org/docs/17/warm-standby.html#SYNCHRONOUS-REPLICATION) acknowledges
writes after the named standby applies them. There is no asynchronous fallback.

One deployment owns one stream row. Database functions lock that row before changing order or lifecycle state. A unique
canonical actor nonce key covers every command. Proposal reservation is replicated before the OS source is invoked;
acceptance separately commits the complete immutable intent, root, order, context and authorization evidence. Only after
that commit returns and its record is read from the standby can the client release a ticket. A primary-local row after
an ambiguous timeout is not an acknowledgement. An unresolved sampling reservation stops; no replacement sampler exists.
An accepted predecessor must have a recorded terminal result before accepting its successor, so its state identity is
known without speculative execution. Indexed lookups read the current ticket and its retained submissions. Startup and
recovery still validate the complete prefix. There is no second in-memory nonce registry.

The login role has no direct table privileges. Every mutation is a security-definer function that checks both the
current authority epoch and `session_user` against the locked stream row. A caller cannot escape fencing with `SET ROLE`
or an application lease. These functions also reject a primary whose durability settings differ. The role is not an
administrator; operators remain trusted to preserve PostgreSQL configuration and fencing. Public clients cannot connect
to this database. The batcher and native entrypoint must enforce the same submission authority at their own boundaries;
database fencing alone does not prove stale-leader submission rejection.

The journal schema is version 1. Rust/Cairo envelope version remains 1. PostgreSQL order/epoch capacity is the positive
signed 64-bit range; exceeding it stops rather than wrapping. Recovery checks a consistent standby snapshot, stream
head, contiguous prefix, canonical intent/envelope hashes, nonce uniqueness, predecessor state, recorded authorization,
entry integrity and chain results. Submitted transaction bytes and hashes survive credential changes. A chain result
observed before the journal records it is reconciled with its existing ticket, never admitted again.

## Journal-only rehearsal

The checkout layout is `~/projects/madara` beside `~/projects/eternum-randomness`. Only this rehearsal uses the public
fixture password `local-rehearsal`; real-host connections use private networking or authenticated SSH tunnels and
provisioned roles. Ports 55432 and 55433 bind to loopback. The primary's initialization script creates roles only; it
never recreates an accepted stream. Initialize a new stream explicitly after replication is healthy. Missing volumes for
an existing deployment are a recovery incident, not permission to initialize another stream.

```sh
deploy/madara-rand/journal/start.sh
cd deploy/madara-rand
docker compose -p madara-rand exec -T journal-primary psql -U postgres -d randomness -v ON_ERROR_STOP=1 -f /schema.sql -f /lookup.sql
```

The following **replaces this project's rehearsal schema**, including deliberately corrupting/removing test entries. It
checks actual SQL privileges, immutable bindings, duplicates, restart recovery, terminal consumption, corruption,
missing entries, an unresolved sampling claim and a paused synchronous standby. Do not run against a workload journal.

```sh
cd ~/projects/madara
cargo test -p mc-sequencer-randomness --test journal --locked -- --ignored --nocapture
```

The test leaves an unresolved reservation deliberately. This is evidence of the stop condition, not a ready gameplay
stream. The schema is rebuilt by the next explicitly requested rehearsal test. Default crate tests leave this
destructive fixture rehearsal ignored; the command above runs it explicitly.

## Promotion and recovery procedure

1. Stop admissions and publication for the affected deployment. Record both journal endpoints, database system
   identifier, last acknowledged order/binding, chain progress, pending transaction hashes and authority epoch.
2. Fence the old primary **and its chain submission path** using external power or network controls. Record evidence
   that it cannot write storage or submit transactions. A health-check failure or lease expiry is insufficient. On a
   partition, remain stopped if fencing cannot be established. Local process shutdown is only rehearsal evidence.
3. Inspect the surviving PostgreSQL copy and replay all available WAL. Verify the full accepted prefix and compare it
   with chain history, including recorded roots/context, consumed nonces and known results. A missing/corrupt entry or
   conflicting chain result stops recovery. Preserve submitted-but-unacknowledged transaction bytes; query their hashes
   and the entrypoint's consumed order before resubmission. A missing transaction receipt alone does not authorize
   another effect.
4. Promote the survivor with PostgreSQL `pg_promote()`. Rebuild a synchronous standby from it on replacement storage
   before allowing durable journal writes. Do not lower the acknowledgement policy to regain availability.
5. With replication restored, revoke the former writer's access and terminate its database connections. Provision the
   new writer role, then atomically advance the authority epoch and role binding. Rotate the logical sequencing
   account's credential and enforce the new epoch on chain before releasing submissions. None of these operations
   changes pending action identity, root, order, timestamp or accepted player key.
6. Reconcile any chain-ahead result into its original record, consume terminal nonces, and resubmit unresolved accepted
   tickets with unchanged bindings. Validate the recorded timestamp against the 300-second bound and the original
   rules/config/state. Mismatch stops the stream; substituting current time or drawing again is forbidden. Only then
   resume admission.
7. Restore a stale disk only as a replica of the chosen verified history. Never expose its old primary service while
   replaying. Loss of all journal copies stops the deployment. Backups without the complete accepted prefix cannot
   regenerate it.

The real drill needs two physical hosts with independent storage: the existing local host and an additional host with 8
CPU cores, 32 GiB RAM, 200 GiB free SSD space and Docker. Private bidirectional TCP 55432 carries journal traffic; TCP
15062 carries chain replication. RPC 15050, admin 15051 and Herald 13003 remain loopback-only or SSH-tunnelled. External
power/network fencing must be available before promotion. Replenishing the lost storage is required before new
acknowledgements. No drill uses the excluded remote box.

The host-loss drill is deferred at the owner’s request. Cross-host recovery and durability remain unverified. Consult
the gate index for the separate latency and integration results; a local promotion does not clear this hardware gate.

## Native release on the retained lab

The native fixture starter uses the already-running isolated lab and refuses to switch deployments with pending accepted
work. It is not a bootstrap command for a missing node or lost journal.

The release builder compiles the patched node with `sequencer-randomness`, the same revision with the feature disabled,
and the shared sidecar. Both node binaries include the fsync correction. It publishes to a registry bound to
`127.0.0.1:15000` and writes `image.env` with the resulting digest. The manifest records the source revision, compiler
image, feature configurations, dependency graphs and binary hashes.

```sh
python3 deploy/madara-rand/release/build.py ~/projects/madara /tmp/madara-rand-release
python3 deploy/madara-rand/start-fixture.py /tmp/madara-rand-release /tmp/madara-rand-fixture 10 \
  ~/projects/eternum-native-world 288
bun deploy/madara-rand/prepare-native-actions.ts /tmp/madara-rand-fixture/fixture.json
bun deploy/madara-rand/exercise-fixture.ts /tmp/madara-rand-fixture/fixture.json /tmp/randomness-sidecar-smoke.json sidecar
python3 deploy/madara-rand/deployed-check.py /tmp/madara-rand-release /tmp/madara-rand-fixture /tmp/randomness-deployed
```

Build the `madara-rand-build:llvm19` compiler image from the pinned Madara Dockerfile's `base-rust` target before
running the release builder:

```sh
cd ~/projects/madara
docker build --target base-rust -f madara/Dockerfile -t madara-rand-build:llvm19 .
```

The builder fetches the pinned contract artifact bundle and refuses conflicting local artifacts. The nested native
compiler's lockfile is included in the release inventory. The fixture starter uses `node.yml` in the `madara-rand`
project. Node RPC is on 15050, admin RPC on 15051, gateway on 15062, embedded admission on 15080 and sidecar admission
on 15081. The positive fixture ID selects a unique deployment salt and a separate `randomness_execution_<id>` database;
an existing database makes initialization fail. A new fixture is a new test deployment, never recovery of a pending
action. The destructive journal rehearsal uses the `randomness` database instead. Preserve fixture output and recover
the existing deployment after an interrupted start.

The bootstrap and service environment files contain public local test credentials. `RANDOMNESS_PRIVATE_KEY` signs
ordinary transactions for the sequencing account; it is not an entropy key and never participates in root generation.
The OS sampler calls the initialized Linux `getrandom` syscall directly. The following drill denies that syscall with
`ENOSYS` and requires sampling to fail without retry:

```sh
python3 deploy/madara-rand/drills/entropy-failure.py ~/projects/madara /tmp/randomness-entropy-failure
```

The release fixture deploys the conforming native season, map, structures and troops domains through the existing
deployer. It uses PlayerRegistry and the real gameplay account class. Typed commands arrive in the published intent's
arguments, and the season verifies their commitment before execution. Both placements submit real explorer creation,
Ethereal entry and exploration through the same authority account. The conformance stub remains only as the second
implementation exercised by the shared protocol invariant tests; it is absent from the deployment path.

Herald is compiled from the native foundation checkout and consumes its generated schema. Live ingestion serves 13003;
confirmed-history reconstruction uses a separate database on 13004. The unchanged Dojo baseline uses 13005. Readers
retain checkpoints and restart after a node restart. Their rows, rather than a direct gameplay state fetch, establish
submission-to-row latency.

```sh
python3 deploy/madara-rand/release/build-herald.py NATIVE_REVISION RELEASE HERALD_RELEASE
python3 deploy/madara-rand/start-herald.py RELEASE HERALD_RELEASE FIXTURE HERALD_DIRECTORY
bun deploy/madara-rand/check-herald.ts FIXTURE/fixture.json sidecar DELIVERY_OUTPUT
```

## Matched explore measurement

Prepare a fresh Dojo world using the original artifacts and the existing deployer with `--manifest` under the local
output directory. `prepare-baseline.ts` provisions unchanged Dojo rules and both layers; its usage requires the native
fixture, native source and original Dojo artifacts. Provision two independent native fixtures with 288 explorers each.
The original preset pools and weights remain intact. Raw-root parity is separately checked by the foundation oracle;
these performance runs use the actual baseline placeholder and independently sampled native roots.

Freeze all inputs before collection:

```sh
python3 deploy/madara-rand/freeze-explore-run.py BASELINE_FIXTURE_JSON EMBEDDED_FIXTURE_JSON \
  SIDECAR_FIXTURE_JSON RELEASE HERALD_RELEASE RUN/plan.json
python3 deploy/madara-rand/collect-explore-run.py RUN RELEASE EMBEDDED_HERALD_DIRECTORY SIDECAR_HERALD_DIRECTORY
python3 deploy/madara-rand/analyze-explore-run.py RUN
```

Each placement has 32 warmup actions and 256 measured actions, alternating surface and Ethereal at four explores per
second, with four independently signed token transfers per second. The manifest records deterministic arrival jitter,
source and image revisions, hardware, discovery fixtures, preparation rest and exclusions before the first sample. All
placements run the same enabled node binary at a 250 ms pre-confirmed cadence. Singleton execution batches provide
direct action times; any shared batch is labelled as amortized. Every measured failure and timeout remains in evidence.

The limits are unchanged: at most +25 ms p95 and +50 ms p99 submission-to-pre-confirmed-row latency, at least 95% of
baseline throughput, no additional failed actions and no ticket-order violations. The
[first native comparison](release/native/comparison-initial/summary.json) failed both placement budgets. The
[indexed-journal comparison](release/native/comparison-indexed/summary.json) passes for embedded: +4.37 ms p95 and +4.98
ms p99 versus baseline, with no added failures or ordering violations. Sidecar passes p95 but misses p99 (+74.57 ms), so
embedded is selected. The combined comparison report correctly remains false because sidecar failed. Both runs and all
samples remain in evidence; the budget and discovery pools are unchanged. Stage percentiles, event counts, gas,
execution time and throughput are recorded in each machine-readable comparison report.

## Local recovery gates

The [gate index](release/gates/index.json) identifies current native evidence and retained historical rehearsals. The
compiled ABI check and shared conformance assertions pass on both the native season and the isolated test stub. Do not
carry historical stub measurements forward as native gameplay results.

Run the recovery checks in this order on a fresh isolated fixture, preserving each output directory:

```sh
python3 deploy/madara-rand/drills/herald-replay.py RELEASE FIXTURE HERALD_DIRECTORY REPLAY_OUTPUT
python3 deploy/madara-rand/drills/submission-crash.py RELEASE FIXTURE before-broadcast BEFORE_OUTPUT
python3 deploy/madara-rand/drills/submission-crash.py RELEASE FIXTURE after-broadcast AFTER_OUTPUT
python3 deploy/madara-rand/drills/submission-crash.py RELEASE FIXTURE promote-before-broadcast PROMOTION_OUTPUT
python3 deploy/madara-rand/drills/restore.py FIXTURE RESTORE_OUTPUT
python3 deploy/madara-rand/drills/missing-journal.py RELEASE FIXTURE MISSING_OUTPUT
```

The crash runner holds the ordinary signed transaction before sending it, or withholds the successful RPC response after
sending it. It kills the worker, then checks the retained binding and chain result after recovery. A disconnected client
in these fault logs is expected; it does not cancel the accepted action. The promotion variant keeps that ticket
pending, stops and disconnects the old primary, verifies the survivor with
`survivor_prefix_matches_chain_before_promotion`, promotes it and builds a new synchronous witness on a fresh volume.
Only after that peer is synchronous does it rotate the database writer and sequencing credential. The old epoch fails in
storage and the old signature fails at chain submission. The original root, context and order are retained. Historical
manual continuations and their original failures remain in evidence. Standby construction now requests a fast checkpoint
so it fits the accepted context's 300-second bound; exceeding that bound still stops the stream rather than changing its
timestamp.

After promotion, retired primaries remain stopped and disconnected. The fixture's `service.env` declares the active
primary, witness and epoch. Shared runtime helpers select the matching Compose overlays; do not start a retired pair.
Promotion stops Herald readers while their database endpoint changes. Update their database URLs to the promoted host
and restart them using their existing checkpoint databases. With those readers running, verify the partition boundary:

```sh
python3 deploy/madara-rand/drills/preview-partition.py RELEASE FIXTURE PARTITION_OUTPUT
```

That check pauses the replacement witness before admission. The accepted prefix stays unchanged, the worker logs no
unaccepted action, and the subscription delivers its row only after replication resumes. The stale-disk restore copies
the retired volume into a fresh volume and starts it without networking and with read-only transactions; its bindings
match the captured prefix and writes fail. Missing-history startup exits on the missing journal schema and creates no
replacement stream. Neither drill deletes accepted storage. Rust recovery tests also cover every accepted lifecycle
state, unresolved sampling ownership and corrupted or missing entries. The separate Herald reconstruction began with an
empty database and decoded chain history into the same rows as the live fold.

The current release and recovery results are indexed in `release/gates/index.json`; its historical index retains the
earlier stub rehearsals. Current measurements were frozen from clean source trees before the requested history rewrite.
The measured runtime sources are archived with their original hashes, alongside raw measurements, image provenance and
all recovery commands. Verify those files without extracting them:

```sh
python3 deploy/madara-rand/verify-native-evidence.py
```

The selected embedded release passes the local gates. The host-loss drill is deferred at the owner’s request, not
passed. Cross-host recovery and durability remain unverified. The sidecar p99 failure is retained as a rejected
placement result. These measurements cover four explores per second on one host, not saturation capacity or a cross-host
latency guarantee.
