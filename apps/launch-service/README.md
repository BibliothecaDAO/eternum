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
atomically schedules its result job after the actual game end and grace period. Results resume from the chain cursor.
Failed jobs remain visible and can be retried by a launcher. Slot registration needs a verified identity, but not
launcher privileges. No L2 service is required for a free slot.
