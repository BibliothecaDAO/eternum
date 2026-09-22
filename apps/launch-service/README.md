# Launch service

`@bibliothecadao/launch-service` is the native game registrar, free-slot scheduler and result finalizer. Mutations
require a verified Realms identity session and an address in `LAUNCHER_ALLOWLIST`; reads are public with exact-origin
CORS headers.

Required environment:

- `DATABASE_URL` — the launch service database
- `IDENTITY_URL` — box-local identity origin, normally `http://127.0.0.1:3001`
- `CORS_ORIGIN` — comma-separated exact browser origins
- `LAUNCHER_ALLOWLIST` — comma-separated Starknet owner addresses, or `*` to let any verified session launch (still
  origin- and session-gated; used on the dev testnet)
- `RPC_URL`, `HERALD_URL`, `NATIVE_WORLD_MANIFEST`, `ADMISSION_URL`
- `DEPLOYER_ACCOUNT_ADDRESS`, `DEPLOYER_PRIVATE_KEY` — registrar writer

`bun run src/main.ts` serves port 3006, freezes due slot rosters and claims durable jobs. Completing a Blitz launch
atomically schedules its result job at the actual game end, with no Blitz grace period. Finalization completes pending
actions and hyperstructure settlement before recording results, which resume from the chain cursor. Failed jobs remain
visible and can be retried by a launcher. Slot registration needs a verified identity, but not launcher privileges. No
L2 service is required for a free slot.

Frontier uses preset 1 in madara.frontier. Schedule a season through the existing create-game API with an explicit
gameStartTime; that UTC timestamp determines the canonical season name. The durable job creates the season-long game
with open entry and no roster. Repeating the same schedule returns its existing job, including after completion or a
service restart. Different options for the same start time are rejected. Schedule the next season with a new start time;
it creates a new game without carrying realms forward.
