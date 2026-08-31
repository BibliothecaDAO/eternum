# Realms web app — one app for everything but the map

Brief for a Fable agent building the new realms.world from the ground up. It replaces, in one app: the current
`apps/web` (realms.world: account portal, SIWS, bridge for Realms NFTs, veLORDS, governance), the marketplace, the game
client's landing and entry flows (the lobby), and every L2 value action of the game (registration, modifiers, chest
opening, loadout, bridge, swap, betting, names). The game client (`apps/game`) becomes a per-game desktop client
launched from this app and does nothing but play; a mobile client comes later as a second client of the same contracts
and the same app.

Design source: `realms-value-plane-design.md` (§1 second rule, §3 names, §4 collectibles, §5 bridge/AMM, §6 pools, §9
decisions). Contracts and addresses: `realms-phase-3-backend-brief.md` B.1 (mainnet deployment, frozen ABI in week 1).
Read both before writing code; do not reopen their decisions.

Rules: the repo `AGENTS.md` (KISS, systemic, deletion, one truth per fact, wired or deleted, clean-code standard). The
one design rule specific to this app: **it never holds game state**. Live game facts come from herald over HTTP; value
facts come from the L2 contracts by direct RPC reads; history comes from herald's history sink or the existing apibara
indexer (`apps/indexer`) for L2 events. No Torii anywhere, no SQL read model for a fact that a contract or herald
already serves.

## What stays, what goes

| Keep as a service or dependency                                                                                                | Replace                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity: SIWS + better-auth + Drizzle/Postgres (`apps/web/src/utils/auth`, `lib/gameplay-account.ts` — the binding authority) | every page and route of the current `apps/web`                                                                                                 |
| `packages/chain` (endpoints, addresses), `packages/react`, `packages/types` where they fit                                     | the game client's landing feature (`apps/game/src/ui/features/landing/**`, the 4,000-line `game-entry-modal.tsx`, worlds summary, entry flows) |
| `@bibliothecadao/ammv2-sdk` for swaps                                                                                          | the marketplace app and `packages/chain/src/marketplace.ts` collection registry (folds in)                                                     |
| `apps/indexer` (apibara) for L2 history only                                                                                   | `apps/game`'s cosmetics UI, chest-opening store, AMM services, PM stubs                                                                        |
| herald HTTP: `/<chain>/games`, `/games/<id>/snapshot`, `/games/<id>/history`, `/games/<id>/review/snapshot`                    | any react-query cache that would become a second truth for a live fact                                                                         |

Stack (owner, 2026-08-30 — decided, not the agent's choice any more): React 19 and starknet.js 9 stay (phase-2
inherited); **Effect (Effect-TS) is the backbone of the app** — every service (contract reads/writes, herald client,
identity API), every async boundary and every decoded payload goes through Effect: services as `Effect.Service` layers,
external data validated with `effect/Schema`, errors typed in the signature, no bare promises or ad-hoc try/catch in app
code. Around it: Vite, TanStack Router (type-safe routes/loaders that run Effects), Tailwind v4. The server side is
`apps/realms/server` — better-auth + Drizzle/Postgres with the SIWS plugin ported from `apps/web` (the first slice built
it as a new server rather than extending the old one; the owner ratified that in review, 2026-08-31). **It is the only
sign-in authority**: `apps/web`'s SIWS mount is retired at cutover (the game client's auth URL then points at this
server; the shared cookie on `.realms.party` and the shared Postgres make its sessions valid everywhere), while
`apps/web` keeps only the gameplay-account binding routes — which validate the shared sessions — until those routes move
here too. Both SIWS plugins already derive identity keys through `@realms-world/identity` (`9d2104fa0d2`), so the two
never disagree on who a wallet is. The SPA talks to the server over one `IdentityApi` Effect service. The design
artifact (claude.ai, "Realms App Architecture") records the layer graph; deviations from it are named in the PR.
Ground-up means a new app directory (`apps/realms`), not a refactor of `apps/web`; `apps/web` is deleted when the last
route has moved, and the deletion is part of this brief.

## Pages (the product, in order of build)

1. **Sign in and account** — SIWS with Ready/Braavos/Controller (the connectors that exist), against **mainnet** from
   the start (owner decision 2026-08-30: Controller cannot sign on Sepolia, so the value plane deploys to mainnet
   immediately — no chain flip at launch, no dual-chain mode); on first sign-in the **name** step: prefilled from
   Cartridge for Controller users, typed by everyone else; unique (case-insensitive index), 3–20 chars, changeable in
   settings. The gameplay account binding (bind/rotate through the existing authority server code) shown as a status,
   never as a thing the player manages. `owner → name` is served by this app's API to anything that needs it
   (leaderboards, review, the game client).
2. **Lobby** — the game list from herald's directory (open, live, finished; player counts; preset; start/end), one game
   page per `game_id` with registration state from the ledger (`registered`, flags, pool, payouts by preset),
   **Register** (`register(game_id, sword, shield)` with the LORDS approval folded into one multicall), **Register with
   pass** / village pass for Eternum, **Play** (launches `apps/game` at its entry route — see the launch contract
   below), **Spectate**, and after the game the results (ranks, prizes, MMR deltas, chests) from the ledger and herald's
   review snapshot.
3. **Leaderboards and profile** — MMR from `MMRToken` (tiers as in `apps/game/src/ui/utils/mmr-tiers.ts`), names from
   the API, per-game history from herald's history sink; a player page by owner address.
4. **Chests and loadout** — inventory by direct enumerable read of the cosmetics and chest collections (`balance_of` +
   `token_of_owner_by_index` + `attributes_raw` in one multicall); chest opening through the existing
   `collectibles_claim.claim(token_id)`; loadout picker writing `set_loadout(game_id, attrs)` on the ledger before a
   game starts. The cosmetics catalog from `apps/game/src/ui/features/cosmetics/chest-opening/utils/cosmetics.ts` moves
   here.
5. **Bridge and swap** (Eternum) — `vault.deposit`, the withdrawal queue (`claim` after the delay, pending releases,
   caps), and swaps on ammv2 through its SDK. Bridge UI ships with backend B.4; swap can ship earlier.
6. **Bets** — the fixed-odds pool per game: quoted odds, locked odds on the ticket, liability-cap refusal shown as a
   reason, `claim_bet` after results.
7. **Marketplace** — the existing order-book contract (`contracts/marketplace`) for realms and cosmetics, folded in as
   pages; its own Torii dependency replaced by the apibara indexer for listings (L2 history).
8. **Everything else the current realms.world does** (Realms NFT bridge L1↔L2, veLORDS, governance, scroll posts) —
   ported last, page by page, deleting the old route each time.

## Data and contracts

- Herald HTTP is the only source for live game facts and history; the URL per chain from `packages/chain`.
- Ledger, vault, MMR, collectibles, ammv2, season pass, village pass: addresses from
  `contracts/common/addresses/<chain>.json`, ABIs from the mainnet deployment (B.1), typed calls in one
  `services/contracts/` module — no ad-hoc `callContract` elsewhere. Reads by multicall; writes as single multicalls
  with approvals.
- Identity API: the existing better-auth routes plus `name` (set/get/lookup by owner) and `owner → name` batch lookup.
- The app is the **game launcher**: home is news (the scroll posts) plus the next game and the player's standing, and
  every path ends at Launch. The client handoff is one URL — the identity session cookie is set on `.realms.party`, so
  the client opens already signed in. The URL shape is the client's, not this brief's: `apps/game` enters a game at
  `/enter/<chain>/<launch name>` (`?intent=spectate` to watch) and resolves the name to a `game_id` through herald's
  directory (`apps/game/src/play/navigation/play-route.ts`, `runtime/world/game-registry.ts`) — an earlier revision
  wrote `/play?game=<id>` here, a shape the client never had (review, 2026-08-30). The client resolves the gameplay
  account from the session as today (`gameplay-account-sync.tsx`) and never talks to L2. The desktop client (later,
  Tauri) registers a `realms://` deep link mirroring the same entry route; the launcher tries the deep link with a
  one-time code minted by the identity API and falls back to the web client. **Design ownership (2026-08-30):** the
  owner works on the visual and UX direction directly with the web agent; the two artifacts ("Realms App Architecture",
  "Realms Launcher" on claude.ai) are starting references, not binding specs — the launcher draft shows the intended
  shape (game-client DNA: top tab nav with HUD chrome, an anchored oversized Play, the merged REALM portal) and the flow
  contracts in its UX notes (register multicall, no optimistic UI, the cookie handoff) do bind. Claude reviews each
  slice; the owner gates.

## Gates

1. From a fresh wallet on mainnet: sign in → choose a name → register for a lab game with a sword → Play opens the game
   client at the right game with the name showing → after the game, results, MMR delta and a minted chest appear on the
   game page and the profile.
2. Chest opened and a loadout set from the app render in the lab game.
3. Eternum: register with a burned pass; (with B.4) deposit shows in the realm, a withdrawal appears in the queue and is
   claimable after the delay.
4. A bet placed at quoted odds pays the locked amount after results.
5. `apps/web` and the game client's landing feature are deleted; knip is clean; no Torii, no
   `VITE_PUBLIC_MARKETPLACE_URL`, no react-query cache holding a live game fact.

## Out of this brief

The game client (its brief), contracts (backend brief), mobile (later, same contracts and API), a CMS for the scroll
posts if the current generator suffices.
