# realms-identity box-served — Codex brief

## Goal

Serve **apps/realms** (identity SPA **and** its `/api`) from the lab box on one origin at `app.realms.party`, replacing
the retired `apps/web`. The game client already redirects there for sign-in (`apps/game/.env.production`:
`VITE_PUBLIC_IDENTITY_ORIGIN=https://app.realms.party`). Owner picked box-served over SPA-on-Pages because the SPA talks
to its API same-origin and login rides a `.realms.party` cookie — a Pages/box split would need a proxy Function + CORS
for no real gain (the heavy 3D game client is the thing that belongs on Pages, and it already is).

## Evidence (true as of 2026-09-01, feat/madara-lab)

- `apps/realms/server/main.ts` is a single Bun `fetch` handler serving `/api/auth/*` (better-auth), `/api/names`,
  `/api/leaderboard`, `/api/gameplay-account`, `/health` — and **nothing static**.
- The SPA calls **same-origin relative** paths: `src/services/identity.ts` uses `requestJson("/api/auth/...")`,
  `"/api/gameplay-account"`, etc. `VITE_BASE_URL` is used **only** for the SIWS message `domain`/`uri`
  (`identity.ts:101-102`), never as an API base. So the SPA and the API must share an origin.
- `server/auth.ts`: `crossSubDomainCookies.domain = IDENTITY_COOKIE_DOMAIN`, and
  `trustedOrigins = [VITE_BASE_URL, VITE_PUBLIC_GAME_ORIGIN]`. With `VITE_BASE_URL=https://app.realms.party` and
  `VITE_PUBLIC_GAME_ORIGIN=https://play.realms.party`, origins and the shared cookie are already correct — **no auth
  code change**.
- Tunnel already routes it: `deploy/madara-lab/.lab/cloudflared/config.yml` has
  `app.realms.party → http://host.docker.internal:3000`. `app.realms.party` DNS resolves (Cloudflare-proxied), and
  `harden()`'s `ufw allow from 172.16.0.0/12 to any port 3000` already lets the tunnel reach the host.
- `web.service` (apps/web, `:3000`, the previous identity + binding-authority host) is installed but **not running**
  (nothing on `:3000`). apps/realms replaces it.
- Box DB `postgres://realms:realms@127.0.0.1:5432/realms` currently holds **only** `herald_*` tables. The drizzle schema
  models what the identity server needs: `packages/db/src/schema/auth.ts` → `user`/`session`/`account`/`verification`;
  `schema/mmr.ts` → `starknet_mmr_updates`. `pnpm --filter @realms-world/db push` provisions them (plus the other read
  models it re-exports — harmless on the lab).
- **Gotcha:** `packages/db/drizzle.config.ts` sets `dbCredentials.ssl: true`. The box Postgres is plain local TCP with
  no TLS, so a naive `push` fails with an SSL error. Push must run with SSL disabled for the lab.

## The fix

### 1. Static serving in the Bun server (the one code change)

In `apps/realms/server/main.ts`, serve the built SPA for non-`/api` requests:

- Keep the existing routing first: `/api/auth/*` → `auth.handler`; the other `/api/*` and `/health` exactly as today.
- Add a `serveStatic(url)` helper that returns a file from `apps/realms/dist` when the path maps to a real asset, else
  `dist/index.html` (SPA fallback for client-side routes). Content-Type by extension;
  `Cache-Control: public,max-age=31536000,immutable` for `/assets/*`, `max-age=0,must-revalidate` for `index.html`.
- **Do not** let unknown `/api/*` fall through to `index.html` — an unmatched `/api/*` must stay a JSON `404` so API
  errors remain machine-readable. Only non-`/api` GETs reach `serveStatic`.
- Keep the handler reading like a router (auth → api → static); the static file IO lives in the helper, one level down.

### 2. Environment (root `.env` on the box; SPA build + server both read it via `pnpm with-env`)

SPA (baked at build time):

```
VITE_BASE_URL=https://app.realms.party
VITE_PUBLIC_GAME_ORIGIN=https://play.realms.party
VITE_PUBLIC_IDENTITY_RPC_URL=https://rpc.starknet.lava.build/rpc/v0_9   # public mainnet read node, same as the game client
VITE_PUBLIC_HERALD_URL=https://herald.realms.party
VITE_PUBLIC_HERALD_CHAIN=madara
```

Server:

```
BETTER_AUTH_SECRET=<openssl rand -hex 32>
DATABASE_URL=postgres://realms:realms@127.0.0.1:5432/realms
IDENTITY_RPC_URL=https://rpc.starknet.lava.build/rpc/v0_9
IDENTITY_COOKIE_DOMAIN=realms.party
GAME_RPC_URL=https://rpc.realms.party/rpc/v0_10_2
PLAYER_REGISTRY_ADDRESS=0x047d5db2930b9a3270d9cb0e31e3eed2645602c5b51419207f730f3a7f8fafe0
REALMS_SERVER_PORT=3000
```

### 3. Provision the identity schema

Run `push` against the lab DB with SSL disabled (local Postgres has no TLS) — e.g. gate `drizzle.config.ts`'s `ssl` on
an env flag, or push a `?sslmode=disable` URL. Verify `user`/`session`/`account`/`verification`/ `starknet_mmr_updates`
exist and the case-insensitive **unique index on `lower(name)`** is present (that index — not the app pre-check — is the
race-proof name guarantee).

### 4. systemd + bootstrap

- Add `deploy/madara-lab/systemd/realms-identity.service` mirroring `web.service` but:
  `Description=Realms identity (SPA + /api, :3000)`, `ExecStart=/usr/bin/env pnpm --dir apps/realms start:server` (that
  script is `bun run server/main.ts`), `Environment=PATH=/home/realms/.bun/bin:/usr/local/bin:/usr/bin:/bin`,
  `After=network-online.target docker.service herald.service`.
- `systemctl disable --now web.service` and drop its install from `scripts/bootstrap-server.sh`; replace the apps/web
  build + `web.service` install there with the apps/realms build + `realms-identity.service`. Fix the tunnel config
  comment (`app.realms.party` now = apps/realms, not apps/web).
- Redeploy recipe on the box:
  `git pull && pnpm install && pnpm run build:packages && pnpm --filter @realms-world/db push && pnpm --filter @realms-world/realms build && sudo systemctl restart realms-identity`.

### 5. Binding authority (WRITE) — scope + owner gate

`server/binding.ts` only **reads** `PlayerRegistry.account_of` (no key), so sign-in, session, name, and read-only
binding _status_ all work without any authority key. The actual SIWS → gameplay-account binding **write** (co-signing
with the binding-authority key) is **not present in `apps/realms/server`** — confirm whether it must be ported from
`apps/web`, and if so add it as an explicit route that loads the key from the box env only. **Never commit the
binding-authority private key**; it is the owner's and lives in the box `.env` alone.

## Verifiable gate

- `curl https://app.realms.party/health` → `{"service":"realms-identity","success":true}`
- `curl -sI https://app.realms.party/` → `200`, `content-type: text/html` (SPA shell)
- `curl https://app.realms.party/api/leaderboard` → `{"players":[...]}` `200`
- `curl -s -o /dev/null -w '%{http_code}' https://app.realms.party/api/does-not-exist` → `404` (JSON, **not** the SPA)
- DB: the five identity/mmr tables exist; the `lower(name)` unique index exists.
- Browser (owner performs the wallet/Cartridge sign-in): from the game at `play.realms.party`, the login button lands on
  `app.realms.party`, SIWS sign-in sets a cookie on `.realms.party`, and returning to the game shows the session. The
  lobby lists **all** games from herald (`/madara/games`), not only the player's.

## Non-goals

- SPA on Cloudflare Pages (rejected — same-origin code). The 3D game client stays on Pages and is untouched.
- No CORS, no Pages Function, no `id.realms.party` hostname.
- Provisioning the binding-authority write key (owner-gated) and retiring the AWS `apps/web` (later pass).

## What I (Claude) will review

- `main.ts` stays a clean router; `serveStatic` is the only new abstraction; unmatched `/api/*` stays JSON `404` (no
  fallback swallows API errors).
- No secret or binding key committed; all secrets come from the box `.env`.
- `drizzle-kit push` actually ran against the non-TLS lab Postgres and the `lower(name)` index is present.
- `trustedOrigins` + cookie domain leave the game → identity → game round-trip working; lobby shows all games.
