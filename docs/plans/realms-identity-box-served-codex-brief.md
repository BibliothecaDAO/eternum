# realms-identity box-served — Codex brief

## Goal

Serve **apps/realms** (identity SPA **and** its `/api`) from the lab box on one origin at `app.realms.party`, replacing
the retired `apps/web`. The game client at `play.realms.party` is a **cross-origin** consumer of the same identity API
(session, SIWS, bind, rotate), so the server must also send credentialed CORS. Owner picked box-served over SPA-on-Pages
because the apps/realms SPA talks to its API same-origin and login rides a `.realms.party` cookie; the heavy 3D game
client stays on Pages.

## Evidence (true as of 2026-09-01, feat/madara-lab)

- `apps/realms/server/main.ts` is a single Bun `fetch` handler serving `/api/auth/*` (better-auth), `/api/names`,
  `/api/leaderboard`, `/api/gameplay-account`, `/health` — and **nothing static**.
- **Two consumers, two origins:**
  - The apps/realms SPA calls **same-origin relative** `/api/*` (`src/services/identity.ts`, `requestJson("/api/...")`);
    `VITE_BASE_URL` is used only for the SIWS message `domain`/`uri`, never as an API base. Same-origin → no CORS.
  - The **game client** calls the identity API **cross-origin**: `apps/game/.../identity/identity-login.tsx:15` builds
    `createIdentityClient({ baseUrl: ${VITE_PUBLIC_IDENTITY_ORIGIN}/api/auth })` and
    `apps/game/src/hooks/context/gameplay-account-sync.tsx:28-29` builds the same auth client plus
    `createGameplayAccountApi({ baseUrl: VITE_PUBLIC_IDENTITY_ORIGIN })`, with
    `VITE_PUBLIC_IDENTITY_ORIGIN=https://app.realms.party`. So `play.realms.party` makes credentialed fetches to
    `app.realms.party/api/*` — which **requires credentialed CORS**. `trustedOrigins` + a shared cookie do **not**
    satisfy browser CORS.
  - Login is **inline SIWS in the game** (`identity-login.tsx` signs in place; there is no redirect at `:52`).
    `VITE_PUBLIC_IDENTITY_ORIGIN` is the cross-origin **API base**, not a redirect target.
- `server/auth.ts`: `crossSubDomainCookies.domain = IDENTITY_COOKIE_DOMAIN`,
  `trustedOrigins = [VITE_BASE_URL, VITE_PUBLIC_GAME_ORIGIN]`. With `VITE_BASE_URL=https://app.realms.party` and
  `VITE_PUBLIC_GAME_ORIGIN=https://play.realms.party` the origin check and cookie are correct — but that is origin
  _validation_, separate from emitting CORS response headers.
- A tested credentialed-CORS wrapper already exists to port: `apps/web/src/lib/api-cors.ts` (+ `api-cors.test.ts`) —
  `access-control-allow-credentials: true`, `allow-headers: content-type`, `allow-methods: GET, POST, OPTIONS`,
  `OPTIONS → 204`, `isAllowedOrigin ∈ {null, VITE_BASE_URL, VITE_PUBLIC_GAME_ORIGIN}`, else `403`.
- The binding write impl to port: `apps/web/src/lib/gameplay-account.ts` — `bind` **and** `rotate`, with zod input
  validation, `assertBindableGameplayAccount` (authority + class-hash checks), authority-call serialization
  (`authorityCallTail`), and one nonce retry. It reads `BINDING_AUTHORITY_ADDRESS`, `BINDING_AUTHORITY_PRIVATE_KEY`,
  `GAMEPLAY_ACCOUNT_CLASS_HASH`, `PLAYER_REGISTRY_ADDRESS` via `requiredServerValue` **inside** the call (`:90-93`), so
  read-only identity still boots without the key.
- Tunnel already routes it: `deploy/madara-lab/.lab/cloudflared/config.yml` has
  `app.realms.party → http://host.docker.internal:3000`. `app.realms.party` DNS resolves (Cloudflare-proxied), and
  `harden()` already `ufw allow …to any port 3000`.
- `bootstrap-server.sh` `install_units()` installs + enables the `herald`/`web` units and performs **no application
  build** (build/install/push are manual today). So there is no apps/web build step to "replace" — only the unit
  install. `web.service` is installed but not running.
- Box DB `postgres://realms:realms@127.0.0.1:5432/realms` holds only `herald_*`. The drizzle schema models what identity
  needs (`packages/db/src/schema/auth.ts` → `user`/`session`/`account`/`verification`; `schema/mmr.ts` →
  `starknet_mmr_updates`). **Gotcha:** `packages/db/drizzle.config.ts` sets `ssl: true`, which fails against the box's
  plain-TCP local Postgres.

## The fix

### 1. Static serving (code change #1)

In `apps/realms/server/main.ts`, serve the built SPA for non-`/api` requests:

- Accept **GET and HEAD** for non-`/api` paths → `serveStatic(url)`: return the file from `apps/realms/dist` when the
  path maps to a real asset, else `dist/index.html` (SPA fallback). **HEAD** returns the same headers with no body.
  Content-Type by extension; `Cache-Control: public,max-age=31536000,immutable` for `/assets/*`,
  `max-age=0,must-revalidate` for `index.html`.
- An unmatched `/api/*` stays a JSON `404` (never falls through to `index.html`), so API errors remain machine-readable.
- Keep the handler reading like a router (CORS → auth → api → static); file IO lives in the helper.

### 2. Credentialed CORS chokepoint (code change #2)

Port `apps/web/src/lib/api-cors.ts` (and its test) into `apps/realms/server` and apply it to **every** `/api/*` response
— `/api/auth/*`, `/api/names`, `/api/leaderboard`, `/api/gameplay-account`, and the new bind/rotate routes:

- `access-control-allow-credentials: true`, `allow-headers: content-type`, `allow-methods: GET, POST, OPTIONS`.
- `access-control-allow-origin`: **echo the matched allowed origin** (∈ {`VITE_BASE_URL`, `VITE_PUBLIC_GAME_ORIGIN`}) —
  never a bare list and never `*` (credentials forbid it). The apps/web version hard-codes `VITE_PUBLIC_GAME_ORIGIN`;
  echoing the matched origin lets both allowed origins work.
- `OPTIONS` preflight → `204` with the headers; a disallowed `Origin` → `403`.
- Set the CORS headers in this **one** chokepoint; do not also enable better-auth's own CORS (avoid a duplicated
  `access-control-allow-origin`).

### 3. Binding + rotation port (code change #3)

Port `bind` and `rotate` from `apps/web/src/lib/gameplay-account.ts` into `apps/realms/server` as explicit routes (match
the paths `createGameplayAccountApi` calls — confirm from `gameplay-account-sync.tsx`). Preserve the zod validation,
`assertBindableGameplayAccount` (authority + class-hash checks), authority-call serialization (`authorityCallTail`), and
the single nonce retry. Load `BINDING_AUTHORITY_ADDRESS` / `BINDING_AUTHORITY_PRIVATE_KEY` /
`GAMEPLAY_ACCOUNT_CLASS_HASH` **lazily inside the handler**, so read-only identity boots even if the key env is absent.
Without this port a newly signed-in player cannot provision or recover their gameplay account.

### 4. Environment (root `.env`; SPA build + server both read it via `pnpm with-env`)

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
DATABASE_SSL=false                     # box Postgres is plain local TCP; see §5
IDENTITY_RPC_URL=https://rpc.starknet.lava.build/rpc/v0_9
IDENTITY_COOKIE_DOMAIN=realms.party
GAME_RPC_URL=https://rpc.realms.party/rpc/v0_10_2
PLAYER_REGISTRY_ADDRESS=0x047d5db2930b9a3270d9cb0e31e3eed2645602c5b51419207f730f3a7f8fafe0
GAMEPLAY_ACCOUNT_CLASS_HASH=0x05085c5c53efdc762c7c0637c92eecaf962aa3d72774b38faf3b8852c1729093
REALMS_SERVER_PORT=3000
# Binding authority (write path): reuse the committed lab dev pair from apps/web/.env.example — address
# BINDING_AUTHORITY_ADDRESS=0x008a1719… and BINDING_AUTHORITY_PRIVATE_KEY=<the value in apps/web/.env.example>.
# The registry trusts this address and the overnight harness already binds bots with it. Not a lab secret;
# production hardening swaps it for a real key.
```

### 5. Provision the identity schema (make the SSL choice explicit)

Gate `packages/db/drizzle.config.ts`'s `ssl` on the env (e.g. `ssl: env.DATABASE_SSL === "false" ? false : true`) and
set `DATABASE_SSL=false` in the box `.env`, so the push command is not silently dependent on an unstated override. Run
`pnpm --filter @realms-world/db push`. Verify `user`/`session`/`account`/`verification`/`starknet_mmr_updates` exist and
the case-insensitive **unique index on `lower(name)`** is present (that index — not the app pre-check — is the
race-proof name guarantee).

### 6. systemd + bootstrap

- Add `deploy/madara-lab/systemd/realms-identity.service` mirroring `web.service` but:
  `Description=Realms identity (SPA + /api, :3000)`, `ExecStart=/usr/bin/env pnpm --dir apps/realms start:server` (that
  script is `bun run server/main.ts`), `Environment=PATH=/home/realms/.bun/bin:/usr/local/bin:/usr/bin:/bin`,
  `After=network-online.target docker.service herald.service`.
- In `bootstrap-server.sh`: `install_units()` installs + enables **`realms-identity.service` instead of `web.service`**
  (drop the `web` unit and update the log line). It builds nothing today, so there is no build step to replace — leave
  dependency install + SPA build + `db push` in the documented redeploy procedure below. Update the `harden()` comment
  (`app.realms.party` = apps/realms now, not apps/web). On the box, `systemctl disable --now web.service`.
- Redeploy recipe on the box:
  `git pull && pnpm install && pnpm run build:packages && DATABASE_SSL=false pnpm --filter @realms-world/db push && pnpm --filter @realms-world/realms build && sudo systemctl restart realms-identity`.

## Verifiable gate

- `curl https://app.realms.party/health` → `{"service":"realms-identity","success":true}`.
- `curl -s https://app.realms.party/` → `200`, `text/html` (SPA shell); `curl -I …/` (HEAD) returns the same headers, no
  body.
- `curl https://app.realms.party/api/leaderboard` → `200` (with an allowed `Origin`).
- **CORS preflight:**
  `curl -X OPTIONS -H 'Origin: https://play.realms.party' -H 'Access-Control-Request-Method: POST' -i https://app.realms.party/api/gameplay-account`
  → `204` with `access-control-allow-origin: https://play.realms.party` and `access-control-allow-credentials: true`; a
  disallowed `Origin` → `403`.
- `curl -s -o /dev/null -w '%{http_code}' https://app.realms.party/api/does-not-exist` → `404` (JSON, not the SPA).
- DB: the five identity/mmr tables exist; the `lower(name)` unique index exists.
- Browser (owner performs the inline wallet/Cartridge sign-in — **no redirect**): from the game at `play.realms.party`,
  SIWS sign-in sets a cookie on `.realms.party`, the game reads the session **cross-origin**, and bind/rotate provision
  the gameplay account. The apps/realms lobby lists **all** games from herald (`/madara/games`), not only the player's.

## Non-goals

- SPA on Cloudflare Pages (rejected — same-origin code). The 3D game client stays on Pages, untouched.
- No Pages Function, no `id.realms.party` hostname.
- A redirect-based identity-SPA login flow — keep the game's existing inline SIWS (touching `apps/game` is out of
  scope).
- Replacing the committed lab binding-authority dev key with a real secret (production hardening), and retiring the AWS
  `apps/web` (later pass).

## What I (Claude) will review

- The three code changes (static, CORS chokepoint, bind/rotate port) stay clean; `main.ts` reads as a router; static IO
  and CORS each live in one helper.
- CORS is a single chokepoint over all `/api/*`, echoes the matched allowed origin, credentials on, `OPTIONS → 204`,
  disallowed → `403`; no duplicated `access-control-allow-origin`.
- Bind/rotate preserve validation, authority-call serialization, and the one nonce retry; the authority key is loaded
  lazily so read-only identity boots without it.
- Static serves GET **and** HEAD; unmatched `/api/*` stays JSON `404`.
- `drizzle-kit push` ran with `DATABASE_SSL=false` and the `lower(name)` index is present.
- No secret or private-key literal committed anywhere.
- End to end: `play.realms.party` inline SIWS → session read cross-origin → bind works; lobby shows all games.
