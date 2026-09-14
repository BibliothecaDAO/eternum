# Recorded randomness rehearsal

This isolated Compose project uses `docker compose -p madara-rand`. It does not operate the existing lab node. All
current evidence is **local rehearsal, not the host-independence gate**. Operator honesty remains trusted.

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
known without speculative execution.

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

## Start and reproduce

The checkout layout is `~/projects/madara` beside `~/projects/eternum-randomness`. Only this rehearsal uses the public
fixture password `local-rehearsal`; real-host connections use private networking or authenticated SSH tunnels and
provisioned roles. Ports 55432 and 55433 bind to loopback. The primary's initialization script creates roles only; it
never recreates an accepted stream. Initialize a new stream explicitly after replication is healthy. Missing volumes for
an existing deployment are a recovery incident, not permission to initialize another stream.

```sh
deploy/madara-rand/journal/start.sh
cd deploy/madara-rand
docker compose -p madara-rand exec -T journal-primary psql -U postgres -d randomness -v ON_ERROR_STOP=1 -f /schema.sql
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

The host-loss drill is the one gate left open until the owner provides the second host. Single-host rehearsals and items
2–6 proceed independently of that hardware gate.

## Local image and deployed conformance

The release builder compiles the patched node with `sequencer-randomness`, the same revision with the feature disabled,
and the shared sidecar. Both node binaries include the fsync correction. It publishes to a registry bound to
`127.0.0.1:15000` and writes `image.env` with the resulting digest. The manifest records the source revision, compiler
image, feature configurations, dependency graphs and binary hashes.

```sh
python3 deploy/madara-rand/release/build.py ~/projects/madara /tmp/madara-rand-release
python3 deploy/madara-rand/start-fixture.py /tmp/madara-rand-release /tmp/madara-rand-fixture 1
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

The deployed fixture is `RecordedExecutionStub`. Its result rows exercise admission, authority checks, nonce consumption
and recovery. Their native `ActionNonce` event now exercises Herald delivery, but does not represent exploration or
discovery rows. Deployed-explore measurements need the conforming native entrypoint and gameplay fixtures. Freeze the
measurement manifest before collecting those results.

The checked [release manifest](release/evidence/manifest.json) records image
`sha256:a7cd050b8429ee3e6adde66fe8172bf33b1886714bca8df5b62af3145a2660d9` from Madara `c75259889`. Its dependency
inventories and build logs are beside it. The [deployed report](release/deployed/report.json) records eight sidecar
actions and eight embedded actions on one retained journal, each with sixteen concurrent duplicate requests. Simulation,
estimation and direct-call rejections are recorded per action. All results match after restarting with the disabled
binary and then restoring the enabled binary. These runs use separate local containers and volumes.

At this pin, pending RPC calls and headers can synthesize wall time ahead of the batcher. New admission records the last
confirmed block timestamp after checking the declared 300-second skew; execution never substitutes another timestamp.
The two earlier [timestamp regressions](timestamp-regression.json) remain recorded with their rejected transactions and
retained bindings. Their stopped test deployments were preserved. The corrected runner uses a new deployment identity.

## Timing instrumentation and native Herald

The instrumented [node release](release/measurement/node/manifest.json) is Madara `c342e4737`, image
`sha256:dee06fd2348a400b67681e20d41a7868d9b6cef4a1894ac5a632ab92e9339004`. Both feature configurations and the sidecar
were rebuilt. JSON records correlate canonical action/order with the ordinary transaction hash. Sampling and journal
timings are emitted only after the replicated acceptance acknowledgement. The executor records batch wall time and its
amortized per-member value; the latter is not an individual transaction wall-time measurement when a batch has multiple
members.

Build native Herald from its pinned archive, then start it with separate live and reconstruction databases:

```sh
python3 deploy/madara-rand/release/build-herald.py 1b787c57ae36a860679d805e9e7cdb52730d2ae2 \
  /tmp/madara-rand-release /tmp/randomness-herald-release
python3 deploy/madara-rand/start-herald.py /tmp/madara-rand-release /tmp/randomness-herald-release \
  /tmp/madara-rand-fixture /tmp/randomness-herald
bun deploy/madara-rand/check-herald.ts /tmp/madara-rand-fixture/fixture.json sidecar /tmp/randomness-herald-delivery
```

Herald uses RPC v0.10.2 for subscriptions and serves this project's loopback port 13003. The replay container
uses 13004. Its compiled artifact imports the pinned source and requires a matching dependency lock. The build log
retains a Bun directory-mismatch warning; compilation exited successfully and the resulting image passed the delivery
check.

The [instrumentation manifest](release/measurement/run-manifest.json) was written before the two recorded checks: one
embedded action and one sidecar action, each with sixteen concurrent duplicate requests and no warmup. The
[evidence index](release/measurement/index.json) records the raw logs, images, fixture and reports by digest. Both
actions produced native pre-confirmed row diffs with all timing stages present. Recheck each capture with
`check-telemetry.py DELIVERY_REPORT NODE_LOG WORKER_LOG OUTPUT_JSON`; use the node log as the worker log for embedded
placement. `check-native-routing.ts NATIVE_SOURCE SIERRA_ARTIFACT OUTPUT_JSON` checks the compiled `execute` calldata
against native Herald's game routing. The Cairo intent field is named `game_id`; its felt position and canonical bytes
are unchanged.

These are single-host instrumentation checks, not gameplay percentile or budget results. The baseline/embedded/sidecar
explore comparison has not run. Its immutable manifest must include the actual gameplay release, discovery fixtures,
hardware, offered load, action mix, warmup and sample counts before collection. The fixed limits remain +25 ms p95 and
+50 ms p99 submission-to-pre-confirmed-row latency, at least 95% of baseline throughput, no additional failed actions
and no ticket-order violations. Native #4994 at `1b787c57ae36` still lacks the required recorded-context interface and
recovery views, so this package continues to use the explicit conformance stub.
