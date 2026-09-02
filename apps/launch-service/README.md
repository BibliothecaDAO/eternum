# Launch service

`@bibliothecadao/launch-service` is the Madara registrar writer and rotation scheduler. Mutations require a verified
Realms identity session and an address in `LAUNCHER_ALLOWLIST`; reads are public with exact-origin CORS headers.

Required environment:

- `DATABASE_URL` — the launch service database
- `IDENTITY_URL` — box-local identity origin, normally `http://127.0.0.1:3000`
- `CORS_ORIGIN` — comma-separated exact browser origins
- `LAUNCHER_ALLOWLIST` — comma-separated Starknet owner addresses, or `*` to let any verified session launch (still
  origin- and session-gated; used on the dev testnet)
- `RPC_URL`, `HERALD_URL`, `GAME_MANIFEST_PATH`
- `DOJO_ACCOUNT_ADDRESS`, `DOJO_PRIVATE_KEY` — registrar writer

`bun run src/main.ts` serves port 3006 and claims durable jobs. `bun run src/rotation.ts` is the systemd oneshot used by
the rotation timer. Both use the same Postgres run store; no launch summary is written to the local filesystem.
