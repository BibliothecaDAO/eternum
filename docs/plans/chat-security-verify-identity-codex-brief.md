# Chat security — verify identity, don't trust client headers — Codex brief

## Goal

Make the realtime chat (`apps/realtime-server`) safe: a message's sender must be a **verified** identity, not a
client-supplied string. Today a user can impersonate any player — send world chat / DMs under another player's address
or username — because the server trusts request headers.

## Evidence

- `apps/realtime-server/src/http/middleware/auth.ts` `attachPlayerSession` takes the sender entirely from
  **client-controlled** inputs — `x-player-id` header / `playerId` query / route param, plus `x-wallet-address` and
  `x-player-name` headers — with **no verification**. `requirePlayerSession` only checks that _some_ playerId is
  present. So any client can present any `playerId` / wallet / name (full impersonation).
- The chat runs at `chat.realms.party`, a **`.realms.party` subdomain**, so the browser automatically sends the shared
  better-auth identity cookie (crossSubDomainCookies `domain=.realms.party`, set by the identity server) to the chat on
  every HTTP request and on the WebSocket upgrade.
- The identity server (`apps/realms/server`, `app.realms.party` / box-local `:3000`) already exposes the SIWS-verified
  session: `GET /api/auth/get-session` returns `{ user.id (= normalized address), name, image }`.

## The fix

Replace header-trust with **identity-session verification** at the chat's auth chokepoint:

- On each HTTP request and on the **WS upgrade**, read the better-auth session cookie and resolve the verified user by
  either (recommended) calling the identity server server-to-server — `GET ${IDENTITY_URL}/api/auth/get-session`
  forwarding the request `Cookie` — and using the returned `user.id` / `name`; or validating the session directly
  against the shared session table if the chat is given that DB.
- The sender's `playerId` = the verified address (`user.id`), `displayName` = the verified name. **Ignore `x-player-id`
  / `x-wallet-address` / `x-player-name` as identity** — at most keep them as non-authoritative hints, never as the
  trusted sender.
- `requirePlayerSession` becomes "require a **verified** session" (401 otherwise). A WS connection without a valid
  session is rejected at upgrade, not attached as an anonymous/spoofable player.
- Add `IDENTITY_URL` to the chat env. On the lab the identity server is box-local, so prefer `http://127.0.0.1:3000`
  (avoids a tunnel round-trip); production points at the identity origin. Cache the verified session per connection /
  for a short TTL so throughput doesn't hammer the identity endpoint.
- Client side: ensure the chat client sends credentials so the cookie reaches the chat (same-subdomain WS upgrades carry
  it automatically; verify the fetch/WS paths in `left-command-sidebar.tsx` use `credentials: "include"` where
  relevant).

## Systemic note (KISS / one truth per fact)

The source of truth for "who sent this" is the **verified identity session**, not a client header. The chat must not
mint its own notion of player identity. This mirrors the identity server already owning names/sessions — the chat
consumes that truth, it does not re-declare it.

## Verifiable gate

- A client sending `x-player-id: <someone-else>` with no/invalid session is **rejected (401)**; with a valid session it
  is attributed to **its own** verified identity, never the spoofed one.
- A signed-in player's messages carry their verified address + chosen name (from identity), regardless of any headers.
- World chat, DMs, and presence all attribute to the verified sender; a WS upgrade without a valid session is refused.

## Owner-gated / notes

- The dev chat is **currently LIVE and impersonation-prone** (header-trust) as `realms-chat.service` on the box. It is
  acceptable to keep running in dev meanwhile, but chat identity must not be treated as trustworthy until this lands.
- Coordinate the chat env (`IDENTITY_URL`, CORS) with the running service and [[latitude-box-live]].
