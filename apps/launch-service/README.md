# Launch service

`@bibliothecadao/launch-service` is the native game registrar, free-slot scheduler and result finalizer, run as the
Cloudflare Worker `realms-launch` (`realms-launch-staging` for staging). It serves `/api/factory/*` and `/api/slots/*`
on the app's origin, beside the identity Worker, whose session it reads over a service binding. Mutations need a
signed-in Realms account with a linked wallet from the app's origin; launch mutations also need that wallet in
`LAUNCHER_ALLOWLIST`. Reads are public.

Configuration, per environment (see `wrangler.jsonc` and `.github/workflows/deploy-workers.yml`):

- `SHARD_URL` — the shard it launches on: its Herald, whose `/manifest` names the chain, node, admission endpoint and
  contracts. It is read at each launch, and a shard running a release other than the one this Worker was built with is
  refused; the ABIs are that release's committed schema.
- `DEPLOYER_ACCOUNT_ADDRESS` and the secret `DEPLOYER_PRIVATE_KEY` — the registrar writer
- `LAUNCHER_ALLOWLIST` — comma-separated Starknet addresses; a wildcard is refused
- the secret `OPERATOR_TOKEN` — the environment's one token for operator automation

Launchers are allowlisted wallets and the operator: automation that presents the environment's one `OPERATOR_TOKEN`
secret as a bearer token, the same token the identity Worker's directory routes accept. A launcher can also create a
slot off the timetable (`POST /api/slots {name, closesAt}`) and register gameplay accounts into it directly
(`POST /api/slots/:name/register {accounts}`, at most 96 per call) for harness runs and invited rosters, under the same
duplicate and close-time rules as a player. A slot freezes at the first cron tick after it closes.

Runs, slots and the season calendar live in D1 (`migrations/`). The calendar holds each phase's planned start and end,
the Frontier season and the Blitz window; launchers edit it on the launcher screen (`PUT /api/factory/calendar/:phase`)
and the operator token can set it for automation. A phase that has not started moves freely; a running phase keeps its
start, and a running Frontier season also keeps its end.

A cron tick every minute follows the calendar. Once the Frontier season has started it creates the season game
(`frontier-<unix seconds>`), running to the season's planned end; the Frontier preset's own duration is only a fallback
for games created outside the calendar. It creates the next free Blitz slot only when that slot closes inside the Blitz
window, freezes a slot whose registration has closed into queued games, and wakes the registrar. Slots close daily at
11:00 and 20:00 UTC and are named by their closing time, so every tick names the same slot; a frozen slot is pruned when
the next one freezes.

The registrar is one Durable Object that executes launches one at a time, because they all sign with one deployer
account. Each alarm runs the next due launch to its end. A launch interrupted by a restart is resumed on the next alarm
and costs an attempt; creation, roster settlement and result batches each check the chain before writing, so a resumed
launch creates nothing twice. A failed launch is retried twice after five seconds, then stays failed until a launcher
continues it, a failed Frontier season included: the schedule creates the season once and never requeues it.

Completing a Blitz launch schedules its result job at the game's actual end in the same write. A result job that runs
before the chain reaches that end is requeued for it without spending an attempt. Finalization completes pending actions
and hyperstructure settlement before recording results, which resume from the chain cursor. Duel is registered as preset
4 but has no launch flow; the API refuses it.

Production deploys only at the cutover, once the box's launch service has stopped: two schedulers would freeze the same
slots.
