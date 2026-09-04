# Realtime chat rework — features + hardening — Codex brief

## Goal

Turn `apps/realtime-server` from a dev toy into the coordination layer an onchain RTS MMO needs — the missing MMO
features **and** the security hardening, as **one build**, because they share a foundation. Today the chat has only
public zone chat + 1:1 DMs, and its entire authorization model guards a **client-asserted identity** (audit 2026-09-01,
verified first-hand).

## Implementation standard: Effect

Owner mandate (2026-09-01): **our TypeScript uses Effect** (effect-ts). Build this rework in Effect — typed errors,
`Layer`/services for the identity/herald/db dependencies, structured concurrency for fan-out — matching `apps/realms`
which already runs on Effect. The chat is a **service**, so Effect is a clean fit (it replaces ad-hoc try/catch + the
linear session scans with typed effects). Do not carry the current bare Hono/async-await style into the rework.

## The systemic foundation (everything rests here — build it first)

Two changes, tightly coupled, that are the security fix **and** the feature enabler:

1. **Verified identity.** Resolve the sender from the shared `.realms.party` session, never from client input. This is
   the audit's root cause (C1/C2) and the basis for all membership.
2. **Gameplay-anchored channels with _derived_ membership.** Channels are game entities. The set is **format-aware**:
   **tribe/alliance exist in Eternum, not Blitz** — so Blitz = **game/match** + **DM**; Eternum adds **tribe** (+
   alliance). Membership is a **function of the verified player's on-chain/game state**, never client-managed. **Channel
   authorization (read/post/join) = membership.**

This single model is why merging is correct: "can you read this tribe channel?" and "are you who you say you are?" are
the same question, and answering it closes the whole authorization class (impersonation, unvalidated zone-join,
publish-to-any-zone) **and** delivers group chat done right (groups = tribes/games, not arbitrary rooms).

> **Membership source (resolved by owner): herald.** The chat reads a player's channels from herald, never the client:
> **game/match** participation from herald's game directory (both formats), and **tribe** membership from Eternum's
> herald tribe read model (Eternum only — Blitz has no tribes). Cache per-player with a short TTL. Name the exact herald
> tables in the implementation.

## Current state (grounded)

- **Transport:** Bun/Hono WS (`server.ts`), HTTP GET for history. **Surfaces:** world/zone chat (`world_chat_messages`,
  zone-scoped broadcast), **1:1 DMs** (`direct_message_threads` — pairwise, unique index on the pair; + typing, read
  receipts, unread counts), zone **notes**, **presence**.
- **No group chats** (thread = a fixed pair), **no channel/membership model**.
- **Identity is client-asserted** (`http/middleware/auth.ts:16-54` trusts `x-player-id`/`?playerId=`) — C1; the WS
  upgrade registers a socket under the client's `playerId` (`server.ts:544-559`) — C2.
- **No abuse controls** (H1), **unbounded** `playerPresence` (H2) and `zoneRooms` (H3), presence **leaks
  wallet+location** (H4), **no retention** (M5).
- **Done right (keep):** no SQL injection; zod schemas on all entry points with `limit`s capped at 100; the WS DM path
  is transactional (`SELECT … FOR UPDATE`); read-receipt/typing identity is server-derived with a `!== player → 403`
  guard; DM/note authz filters live in WHERE clauses; `onMessage` is crash-safe; `DATABASE_URL` masked in logs.

## The build

### Phase 0 — Foundation (do first; unlocks everything)

- **Verified identity (C1/C2).** On the HTTP middleware **and the WS upgrade**, resolve the verified user from the
  session cookie — call `GET ${IDENTITY_URL}/api/auth/get-session` forwarding `Cookie`, or validate against the shared
  session table. `playerId` = verified `user.id` (address), `displayName` = verified name. **Delete the header/query
  trust path**; reject unauthenticated HTTP (401) and WS upgrades. `IDENTITY_URL` box-local on the lab
  (`http://127.0.0.1:3000`); cache per-connection/short-TTL. Client sends credentials (verify
  `left-command-sidebar.tsx`).
- **Channel + membership model.** Introduce a channel abstraction keyed by `(kind, entityRef)` — `tribe:<id>`,
  `game:<id>`, `zone:<id>`, `dm:<pair>`. Resolve a verified player's memberships from the trusted source (design
  decision above). Enforce membership on **join, read, and publish** for every channel. Zone chat becomes "zone
  channel"; DMs stay the pairwise `dm:` channel.

### Phase 1 — MVP (the smallest set that makes it a war-game coordination tool)

Features — scoped to **Blitz** (what the lab runs now; Blitz has no tribes):

1. **Game/match chat** — auto-join the verified player of game X (from herald); ephemeral (the channel dies with the
   match). This is the core Blitz social surface.
2. **DMs + Block** — keep the existing 1:1 DMs; add block (stop receiving from a player, both directions).

(Tribe chat is **Eternum-only** → Phase 2. Map pings are **not** in scope — see the uncertain list below.)

Hardening folded in (required before any network exposure):

5. **Rate limit + caps (H1):** token bucket per connection (N msgs/sec), max-connections-per-player + global socket cap,
   max message size; reject over-limit frames.
6. **Presence prune + privacy (H2/H4):** `playerPresence.delete` on last-socket close; snapshot only online
   (bounded/TTL); **strip `walletAddress`** (and reconsider `lastZoneId`) from broadcast presence.
7. **Zone/channel membership enforced (H3/M1):** `zoneIdSchema.safeParse` on join, cap zones-per-socket; publishing to a
   channel you haven't joined / aren't a member of is rejected.

### Phase 2 — Eternum + fast-follow

- **Tribe chat (Eternum-only)** — private channel, membership from herald's tribe read model; **alliance channels**
  (cross-tribe) after. Blitz never gets these.
- **@mentions + notifications** (DM / mention / tribe-ping while away); **rich presence** (activity: in battle / at
  realm X / in game Y); **history search**; **moderation** (report / mute / admin hide — `moderated_at` already exists).

### Uncertain — not planned until validated

- **Map pings / rally markers / game-object camera-jump.** These need **client map-rendering** work (drawing markers on
  the WorldmapScene, consuming a message's `location`) that has **not** been validated as feasible. The chat-server data
  path (a message with `location`) is trivial; the open question is the client. Do **not** build these until the client
  side is confirmed — hold as an idea, not a commitment.

### Correctness & retention (fold in during the phases)

- **M4** HTTP DM unread-count race → do it in a txn with `FOR UPDATE` (match the WS path).
- **M5** retention: filter expired notes (`expiresAt > now`, `notes.ts:127-171`) + a periodic prune for aged rows and
  stale typing states.
- **M3** bound `metadata` (keys/bytes/depth) and document server-side output-encoding as a contract (stored-XSS).
- **L1** typing route needs a participant check; **L2** forbid the `|` delimiter in ids (or hash the sorted pair);
  **L4** enforce note `visibility` on read (or drop the enum); **L5** debounce presence broadcasts, index sessions by
  alias (drop the O(N) DM fan-out scan).
- **M2** CORS: default to a closed allowlist (no `*`), validate `Origin` on the WS upgrade.
- **L3** identity leaves the query string (root-cause fix), so it stops appearing in request logs.

### Explicit boundaries (KISS — these do NOT go in chat)

- **The battle/event feed is not chat.** "X attacked Y", "hyperstructure captured", "relic found" is **Herald-sourced
  entity/event data** — it may render beside chat, but building it into the chat service violates _one truth per fact_.
- **No arbitrary user-created groups** — groups are tribe/alliance/game only.
- **Voice — out of scope** (text + map pings cover RTS coordination).

## Verifiable gate

- **Identity:** `wss://host/ws?playerId=<victim>` and `curl -H 'x-player-id: <victim>' …` are rejected (401); messages
  are attributed to the caller's verified identity, never a spoofed one; you cannot open a socket as someone else or
  receive their DMs.
- **Membership:** you cannot read or post a game/zone channel you are not a member of (per herald); game chat auto-joins
  the verified player of game X. (Eternum: tribe chat delivers only to tribe members — Phase 2.)
- **Abuse:** a one-connection flood is throttled; connection caps hold; oversized messages are rejected;
  `playerPresence` returns to baseline after disconnect; the presence snapshot carries no `walletAddress`.
- **Features:** game/match chat auto-joins on entering a game; DM block works both directions; @mention notifies (Phase
  2).
- **Correctness:** HTTP unread counts don't drift under concurrency; expired notes aren't returned.

## Sequencing / owner-gated

1. **Phase 0 first** — verified identity + the membership model unlock every authz control and every gameplay channel.
2. Then Phase 1 (MVP features + the abuse/privacy hardening) — required before the chat is reachable beyond the trusted
   lab.
3. Phase 2 + the correctness/retention items follow.

- The dev chat is **currently LIVE and impersonation-prone** ([[latitude-box-live]]); acceptable on the trusted lab
  meanwhile, but do not treat its identity as trustworthy or expose it beyond the lab until Phase 0 lands.
- **Owner-run / integration:** `IDENTITY_URL` + CORS config on the running `realms-chat.service`; the trusted source for
  tribe/game membership (the design decision) may need a herald/RPC endpoint or an identity-server extension — name it
  before Phase 1.
- Full audit evidence with exact `file:line` citations for every finding above lives in this brief's parent audit; keep
  the "done right" list intact when refactoring.
