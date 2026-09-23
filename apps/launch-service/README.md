# Launch service

`@bibliothecadao/launch-service` is the native game registrar, free-slot scheduler and result finalizer, run as the
Cloudflare Worker `realms-launch` (`realms-launch-staging` for staging). It serves `/api/factory/*` and `/api/slots/*`
on the app's origin, beside the identity Worker, whose session it reads over a service binding. Mutations need a
signed-in Realms account with a linked wallet from the app's origin; launch mutations also need that wallet in
`LAUNCHER_ALLOWLIST`. Reads are public.

Configuration, per environment (see `wrangler.jsonc` and `.github/workflows/deploy-workers.yml`):

- `RPC_URL`, `ADMISSION_URL`, `HERALD_URL` — the shard it launches on
- `NATIVE_WORLD_MANIFEST_URL` — that shard's deployment document, read at each launch
- `DEPLOYER_ACCOUNT_ADDRESS` and the secret `DEPLOYER_PRIVATE_KEY` — the registrar writer
- `LAUNCHER_ALLOWLIST` — comma-separated Starknet addresses; a wildcard is refused
- `FRONTIER_SEASON_START` — the current Frontier season's start as an ISO UTC time; omit where no Frontier runs

Runs and slots live in D1 (`migrations/`). A cron tick every minute creates the Frontier season named by
`FRONTIER_SEASON_START` (`frontier-<unix seconds>`) and the next free Blitz slot, freezes a slot whose registration has
closed into queued games, and wakes the registrar. Slots close daily at 11:00 and 20:00 UTC and are named by their
closing time, so every tick names the same slot; a frozen slot is pruned when the next one freezes.

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
