# Recorded randomness rehearsal

This isolated Compose project uses `docker compose -p madara-rand`. It does not operate the existing lab node.
All current evidence is **local rehearsal, not the host-independence gate**. Operator honesty remains trusted.

## Journal mechanism

The choice and procedure were recorded in PR #4995 before implementation. PostgreSQL 17 physical streaming replication
provides the transactional store. The pinned image is
`postgres@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73`.
The primary and hot standby use distinct volumes. Required settings are `fsync=on`, `full_page_writes=on`,
`synchronous_commit=remote_apply` and `synchronous_standby_names='FIRST 1 (journal_standby)'`.
PostgreSQL's [synchronous replication](https://www.postgresql.org/docs/17/warm-standby.html#SYNCHRONOUS-REPLICATION)
acknowledges writes after the named standby applies them. There is no asynchronous fallback.

One deployment owns one stream row. Database functions lock that row before changing order or lifecycle state. A unique
canonical actor nonce key covers every command. Proposal reservation is replicated before the OS source is invoked;
acceptance separately commits the complete immutable intent, root, order, context and authorization evidence. Only after
that commit returns and its record is read from the standby can the client release a ticket. A primary-local row after
an ambiguous timeout is not an acknowledgement. An unresolved sampling reservation stops; no replacement sampler exists.
An accepted predecessor must have a recorded terminal result before accepting its successor, so its state identity is
known without speculative execution.

The login role has no direct table privileges. Every mutation is a security-definer function that checks both the current
authority epoch and `session_user` against the locked stream row. A caller cannot escape fencing with `SET ROLE` or an
application lease. These functions also reject a primary whose durability settings differ. The role is not an administrator;
operators remain trusted to preserve PostgreSQL configuration and fencing. Public clients cannot connect to this database.
The batcher and native entrypoint must enforce the same submission authority at their own boundaries; database fencing
alone does not prove stale-leader submission rejection.

The journal schema is version 1. Rust/Cairo envelope version remains 1. PostgreSQL order/epoch capacity is the positive
signed 64-bit range; exceeding it stops rather than wrapping. Recovery checks a consistent standby snapshot, stream head,
contiguous prefix, canonical intent/envelope hashes, nonce uniqueness, predecessor state, recorded authorization, entry
integrity and chain results. Submitted transaction bytes and hashes survive credential changes. A chain result observed
before the journal records it is reconciled with its existing ticket, never admitted again.

## Start and reproduce

The checkout layout is `~/projects/madara` beside `~/projects/eternum-randomness`. Only this rehearsal uses the public
fixture password `local-rehearsal`; real-host connections use private networking or authenticated SSH tunnels and provisioned
roles. Ports 55432 and 55433 bind to loopback. The primary's initialization script creates roles only; it never recreates an
accepted stream. Initialize a new stream explicitly after replication is healthy. Missing volumes for an existing deployment
are a recovery incident, not permission to initialize another stream.

```sh
deploy/madara-rand/journal/start.sh
cd deploy/madara-rand
docker compose -p madara-rand exec -T journal-primary psql -U postgres -d randomness -v ON_ERROR_STOP=1 -f /schema.sql
```

The following **replaces this project's rehearsal schema**, including deliberately corrupting/removing test entries.
It checks actual SQL privileges, immutable bindings, duplicates, restart recovery, terminal consumption, corruption,
missing entries, an unresolved sampling claim and a paused synchronous standby. Do not run against a workload journal.

```sh
cd ~/projects/madara
cargo test -p mc-sequencer-randomness --test journal --locked -- --ignored --nocapture
```

The test leaves an unresolved reservation deliberately. This is evidence of the stop condition, not a ready gameplay stream.
The schema is rebuilt by the next explicitly requested rehearsal test. Default crate tests leave this destructive fixture
rehearsal ignored; the command above runs it explicitly.

## Promotion and recovery procedure

1. Stop admissions and publication for the affected deployment. Record both journal endpoints, database system identifier,
   last acknowledged order/binding, chain progress, pending transaction hashes and authority epoch.
2. Fence the old primary **and its chain submission path** using external power or network controls. Record evidence that
   it cannot write storage or submit transactions. A health-check failure or lease expiry is insufficient. On a partition,
   remain stopped if fencing cannot be established. Local process shutdown is only rehearsal evidence.
3. Inspect the surviving PostgreSQL copy and replay all available WAL. Verify the full accepted prefix and compare it with
   chain history, including recorded roots/context, consumed nonces and known results. A missing/corrupt entry or conflicting
   chain result stops recovery. Preserve submitted-but-unacknowledged transaction bytes; query their hashes and the entrypoint's
   consumed order before resubmission. A missing transaction receipt alone does not authorize another effect.
4. Promote the survivor with PostgreSQL `pg_promote()`. Rebuild a synchronous standby from it on replacement storage before
   allowing durable journal writes. Do not lower the acknowledgement policy to regain availability.
5. With replication restored, revoke the former writer's access and terminate its database connections. Provision the new
   writer role, then atomically advance the authority epoch and role binding. Rotate the logical sequencing account's credential
   and enforce the new epoch on chain before releasing submissions. None of these operations changes pending action identity,
   root, order, timestamp or accepted player key.
6. Reconcile any chain-ahead result into its original record, consume terminal nonces, and resubmit unresolved accepted tickets
   with unchanged bindings. Validate the recorded timestamp against the 300-second bound and the original rules/config/state.
   Mismatch stops the stream; substituting current time or drawing again is forbidden. Only then resume admission.
7. Restore a stale disk only as a replica of the chosen verified history. Never expose its old primary service while replaying.
   Loss of all journal copies stops the deployment. Backups without the complete accepted prefix cannot regenerate it.

The real drill needs two physical hosts with independent storage: the existing local host and an additional host with
8 CPU cores, 32 GiB RAM, 200 GiB free SSD space and Docker. Private bidirectional TCP 55432 carries journal traffic; TCP
15062 carries chain replication. RPC 15050, admin 15051 and Herald 13003 remain loopback-only or SSH-tunnelled. External
power/network fencing must be available before promotion. Replenishing the lost storage is required before new acknowledgements.
No drill uses the excluded remote box.

The host-loss drill is the one gate left open until the owner provides the second host. Single-host rehearsals and items
2–6 proceed independently of that hardware gate.
