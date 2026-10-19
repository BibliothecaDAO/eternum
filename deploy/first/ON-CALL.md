# On call

The status monitor (`apps/status-monitor`) probes every public path once a minute and shows every component below on the
status page. Only an outage players feel, which only the owner can end, is emailed, on production only, to the address
production's setup recorded (`alertEmail` in the private directory's `inputs.json`):

- the component is `play`, `accounts`, `launch` or a world (`shard:<chain>`);
- and it has been down, not merely degraded, for ten minutes without a break.

The outage and its recovery are each emailed exactly once; components that cross the ten minutes in the same minute,
such as a world and launches when the box stops, share one email, and so do their recoveries. At most four emails go out
in any 24 hours (`status_alert_capped` in the log when one is held back), counted until a day after the latest each
could have been accepted (a run hands emails to Resend only within 50 s of its check, `status_alert_deferred` for the
rest), so a send delayed by a Resend outage or a slow send still counts: the fourth says the earliest time email can
resume, and a change made meanwhile is emailed then only if it is still true. Shorter outages, slowdowns and every other
component stay on the status page; read it first. Each email is recorded in the monitor's state before it is sent and
retried as recorded until Resend confirms it; one Resend has not confirmed within 23 hours is dropped and logged as
`status_alert_expired` (the status page still shows the incident), because past Resend's 24-hour key a resend could be a
second email. The email names the component; find it below. Dev is `play.dev-realms.party` and the box's dev shard is
`realms-dev`. Production is `play.realms.party`, and its Worker names drop `-staging`.

Commands for the box run there (`ssh realms-dev`). Worker logs need the Cloudflare token:
`pnpm --dir <app> exec wrangler tail <worker>`.

## shard:<chain> — a world's Herald or node

Herald is behind the node by more than 2 blocks (degraded) or more than 10 (down), or the node's head is older than 30 s
(degraded) or 120 s (down). Players see stale or frozen state.

1. `curl -s https://herald.dev-realms.party/health`: confirmed block, decoded models, undecodable events.
2. `sudo docker ps -a --filter name=realms-dev- --format '{{.Names}} {{.Status}}'`: something restarting or exited.
3. `sudo docker logs --since 15m realms-dev-madara-1 2>&1 | tail -50`, then the same for `realms-dev-herald-1`.

## node:<chain> — a world's node memory

The node uses half of the host's memory or more (degraded) or three quarters (down), or no node runs in its slice
(down), or the shard's metrics collector has not sampled it for a minute (degraded). Nothing limits the node's memory,
so it grows until the host runs out.

1. `curl -s https://herald.dev-realms.party/health`: `node` holds the last sample (`memory_bytes`, `host_memory_bytes`,
   `sampled_at`); `null` means Herald cannot read the collector's file.
2. `sudo docker stats --no-stream realms-dev-madara-1 realms-dev-metrics-1`: the node's memory now, and whether the
   collector runs.
3. `sudo docker logs --since 1h realms-dev-madara-1 2>&1 | tail -50`; a node that keeps growing is restarted with
   `sudo docker restart realms-dev-madara-1` (Herald reconnects; the chain is kept).

## launch — game launches and seating

The launch Worker reports a failed or stranded run, or a launcher or slot that could not join or freeze. A game is not
being created or its players are not being seated. A failed run is not retried by itself.

1. `curl -s https://play.dev-realms.party/api/factory/health`: `failedRuns`, `strandedRuns`, `joinFailures`,
   `freezeFailures`, each with its game or slot and code.
2. `pnpm --dir apps/launch-service exec wrangler tail realms-launch-staging`: the failing step, live.
3. `sudo docker logs --since 30m realms-dev-rpc-1 2>&1 | grep rpc_refused | tail`: the RPC's refusals of the launcher's
   or a seater's writes, each with its reason.

## relay — value relay

The value relay is halted on a row, its Frontier funding failed, or it has not checked in for five minutes. Rewards and
chest payouts are not being relayed.

1. `curl -s https://play.dev-realms.party/api/value/health`: each shard's `halted` row and `funding_error`.
2. `pnpm --dir apps/value-relay exec wrangler tail realms-value-relay-staging`: why it halted.
3. After fixing the cause, `POST /api/value/operator/reset` with the operator token and `{chainId,row,reason}`
   (`apps/value-relay/README.md`); the ledger's claim identity prevents a second payment.

## monitor — value monitor

The ledger watcher has not checked in for five minutes or reports a fault. It is the component that pauses payouts on a
mismatch.

1. `curl -s https://play.dev-realms.party/api/operator/monitor/health`.
2. `pnpm --dir apps/value-relay exec wrangler tail realms-value-monitor-staging`.
3. Recover a recorded fault with `POST /api/operator/monitor/reset` and `{row,reason}` (`apps/value-relay/README.md`). A
   reset never unpauses the ledger.

## ledger — Starknet ledger

The ledger's pause flag could not be read, payouts are paused (degraded), or Starknet's head is older than 30 s. A pause
is deliberate until someone lifts it.

1. Read the component's name on the status page: "payouts paused" means the flag is set.
2. `pnpm --dir apps/value-relay exec wrangler tail realms-value-monitor-staging`: the monitor pauses on a mismatch.
3. Check Starknet itself: the Alchemy dashboard, or `starknet_blockNumber` on the RPC in `inputs.json`.

## play, accounts, directory, blitz, chat, guardian — public pages and APIs

The page or API did not answer, answered with an error, or took over a second (degraded). `directory` is also down when
any listed world is down.

1. `curl -sI https://play.dev-realms.party/` (play), or the component's route: `/api/health/accounts`, `/api/directory`,
   `/api/slots`, `/api/chat/health`, `/api/guardian`.
2. `pnpm --dir apps/realms exec wrangler tail realms-identity-staging`: identity serves accounts, directory, chat and
   the guardian.
3. Cloudflare's status page, if several components fail together.

## Refused plays

A player's report that an action failed: every play the stamping RPC refuses is logged with its reason and sender.

1. `sudo docker logs --since 1h realms-dev-rpc-1 2>&1 | grep rpc_refused | grep -i <account> | tail`
2. Each `reason` is a rule in `packages/provider/src/play-refusal.ts`: `in-flight`, `nonce`, `deadline`, `stamp`,
   `validation`, `unavailable`. Code `-32011` is a write whose outcome is unknown; `-32005` is the rate limit.
3. `curl -s https://herald.dev-realms.party/health` if the reasons are `deadline` or `unavailable`: the node is slow.

## Changing the alert address

Edit `alertEmail` in production's `inputs.json`, then run
`pnpm run setup production "$HOME/.realms-production" --apply`. Setup re-sends a Worker secret whose value changed, so
the status monitor's `ALERT_EMAIL` is replaced in place and alerts never stop. `deploy:cloudflare` installs no secret.
Dev has no alert address.
