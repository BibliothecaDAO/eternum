# Launch service

`@bibliothecadao/launch-service` is the native game registrar, free-slot scheduler and result finalizer. Mutations
require a verified Realms identity session and an address in `LAUNCHER_ALLOWLIST`; reads are public with exact-origin
CORS headers.

Required environment:

- `DATABASE_URL` — the launch service database
- `IDENTITY_URL` — box-local identity origin, normally `http://127.0.0.1:3001`
- `CORS_ORIGIN` — comma-separated exact browser origins
- `LAUNCHER_ALLOWLIST` — comma-separated Starknet owner addresses; a wildcard is refused at startup
- `RPC_URL`, `HERALD_URL`, `NATIVE_WORLD_MANIFEST`, `ADMISSION_URL`
- `DEPLOYER_ACCOUNT_ADDRESS`, `DEPLOYER_PRIVATE_KEY` — registrar writer
- `FRONTIER_SEASON_START` — the current Frontier season's start as an ISO UTC timestamp; omit on a shard that hosts no
  Frontier

`bun run src/main.ts` serves port 3006, keeps the next free Blitz slot created, freezes due slot rosters and claims
durable jobs. Slots close daily at 11:00 and 20:00 UTC; the next one is created as soon as the previous closes, named by
its closing time, so restarts and concurrent workers create it once. A frozen slot is pruned when the next one freezes.
Completing a Blitz launch atomically schedules its result job at the actual game end, with no Blitz grace period. A
result job that runs before the chain reaches that end is requeued for it without spending an attempt. Finalization
completes pending actions and hyperstructure settlement before recording results, which resume from the chain cursor.
Failed jobs remain visible and can be retried by a launcher. Slot registration needs a verified identity, but not
launcher privileges. No L2 service is required for a free slot. Duel is registered as preset 4 but has no launch flow;
the API refuses it.

Frontier uses preset 1 in madara.frontier and is never created through the API. At startup the service enqueues the
season named by `FRONTIER_SEASON_START` (`frontier-<unix seconds>`), a season-long game with open entry and no roster.
The run is keyed by that name, so a restart, including one during creation, finds the existing run instead of creating a
second game; a season whose launch failed is queued again at the next start, which is safe because create_game is
idempotent by name. A new season is a new start time: set it and restart, and a new game is created without carrying
realms forward.
