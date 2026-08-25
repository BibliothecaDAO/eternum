# Realms phase 1 — everything in one place, playing on Madara

Motto: **KISS, always. Evidence before optimization. Wired or deleted.**

One goal: `realms.world` is one repository and one product — the ecosystem site, the account hub, the stats, and the
game — with one login, and the game runs on our own Madara sequencer with no Cartridge dependency. Nothing else is in
phase 1. Branch: `feat/madara-lab` (worktree `/home/djizus/projects/eternum-madara-lab`, based on `origin/next`). The
procedural-terrain PR (`pr-4903`) is finished separately and is not touched here.

Order of work, and why: **stack → structure → bring it in → play**. Upgrading the stack first means every import lands
on the versions it already uses (React 19, Vite 7, Tailwind 4, `starknet ^9`). Restructuring second means the imports
land in their final place once. Bringing the apps in third gives the login its home (the portal's SIWS). Playing on
Madara last is the gate that proves all of it.

## Facts this brief stands on

Verified 2026-08-24/25 unless stated; evidence in the right column.

| Fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Evidence                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Cartridge (Katana, Torii, Slot, Controller, paymaster, VRF, Arcade) is end-of-life; announcement expected early September 2026                                                                                                                                                                                                                                                                                                                                       | owner input                   |
| Madara `v0.11.0-alpha.9` (digest `sha256:98e02d4b…`) runs the current Dojo world; `sozo 1.8.7` needs `--use-blake2s-casm-class-hash` and the `/rpc/v0_9_0` route; migration 22 m 40 s; block close p50 2.2 ms                                                                                                                                                                                                                                                        | `deploy/madara-lab/README.md` |
| Madara has no `starknet_subscribe*` and no `dev_predeployedAccounts`; Torii v1.8.16 follows it with `events_chunk_size = 100`                                                                                                                                                                                                                                                                                                                                        | README, canary run            |
| Both game chains are fee-free: Katana AWS `no_fee = true` (`deploy/appchain/config/katana.toml:11`), lab `--no-charge-fee`                                                                                                                                                                                                                                                                                                                                           | config                        |
| Contracts identify the player by `get_caller_address()` only; prizes and fees are game-chain ERC20 to/from that address (`registrar/contracts.cairo:120,180`, `realm/blitz/contracts.cairo:82,102,296-299`, `prize_distribution/contracts.cairo:174,249`)                                                                                                                                                                                                            | source                        |
| `settle(game_id, name, …)` writes `AddressName`; the Controller username was only a client default                                                                                                                                                                                                                                                                                                                                                                   | source                        |
| Blitz cap is `registration_count_max <= 24` (`registrar/contracts.cairo:330`); `set_blitz_registration_config` (`config/contracts.cairo:920-942`) has no cap; `fill_open_settlement_pool` (`realm/blitz/contracts.cairo:451-466`) is unbounded per call                                                                                                                                                                                                              | source                        |
| Madara devnet OZ account class `0xe2eb8f56…a1d6` has `__validate_deploy__`, `set_public_key`; Katana AWS `VITE_PUBLIC_ACCOUNT_CLASS_HASH=0x07dc78…` is **not declared** there (`Class hash not found`)                                                                                                                                                                                                                                                               | `starknet_getClass`           |
| The game's Cartridge surface: 7 files import `@cartridge/*`; Controller-only mechanics are `policies.ts`, `signing-policy.ts`, `session-policy-refresh(-state).ts`, `transaction-submit-guard.ts`, `controller-connect.ts`, `use-controller-account.ts`, `use-cartridge-username.tsx`, `use-username.ts`, `ui/modules/controller/controller.tsx`, `paymasterRpcProvider` and `usePredeployedAccounts` in `starknet-provider.tsx`; `useAccount()` is read in 17 files | grep                          |
| `account-portal` = pnpm monorepo: TanStack Start/Router, React 19, Vite 7, Tailwind 4, shadcn, **better-auth Sign-In-With-Starknet** (`auth-siws-plugin.ts`: nonce → SNIP-12 → `verifyMessageInStarknet` on mainnet RPC → session), Drizzle/Postgres, apibara indexer; routes bridge/claims/velords/delegates/proposals; still imports `@cartridge/*` for login                                                                                                      | GitHub API                    |
| `realms-world-site` = same stack minus Start (routes index/blitz/eternum/games/scroll/terms/privacy, keystatic content, one OG function); `eternum-stats` = 90 KB React + chart.js; `marketplace` = Next 16 on `@cartridge/arcade` (31 files), serves `empire.realms.world/trade`                                                                                                                                                                                    | GitHub API                    |
| This repo: catalog React `^18`, `starknet ^8.5.2`; `client/apps/{game, game-docs, eternum-mobile, heavy-load, onchain-agent, realtime-server, amm-indexerv2}`; the game's `ui/features/landing` duplicates the portal's profile/wallet                                                                                                                                                                                                                               | source                        |
| Domains: `realms.world` (portal), `blitz.realms.world` (game), `empire.realms.world/trade` (marketplace), `docs.realms.world`                                                                                                                                                                                                                                                                                                                                        | grep                          |

---

## A. Stack

Upgrade this repo to what the incoming apps already run, before anything moves.

- React 19, `react-dom` 19, `@types/react` 19 across the catalog; fix the game's breaking changes (ref-as-prop, removed
  `forwardRef` warnings, `act` in tests, `@testing-library/react` 16). Vite 7 is already here.
- `starknet ^9` in the catalog (the portal needs it; `packages/provider`, `core`, `dojo`, `client`, `types`, `amm-sdk`
  follow). `@starknet-react/core` stays 5.x.
- Tailwind 4 for the game only if it is a one-day job; otherwise the game keeps its version and web uses 4 — two
  Tailwind majors in two apps is acceptable, two in one app is not.

**Owner:** Codex. **Gate:** `pnpm typecheck`, `pnpm test` in `client/apps/game`, `pnpm exec vitest run` in
`packages/core`, `pnpm run format`, `pnpm run knip`; the game plays on the Katana AWS env exactly as before.

## B. Structure

```
apps/
  web/              realms.world — the portal app, absorbing the site's routes and the stats routes (TanStack Start)
  game/             the game client, moved from client/apps/game
  game-docs/        docs.realms.world
  indexer/          the portal's apibara pipeline
  realtime-server/, onchain-agent/, mobile/, heavy-load/, amm-indexer/   each audited: alive, or deleted in this step
packages/
  identity/         NEW — wallet connectors + SIWS client + session hook; used by web and game
  chain/            NEW — one table of chain ids, RPC urls, addresses (merges the portal's constants, this repo's
                    config chain tables and packages/types addresses)
  db/               the portal's Drizzle schema and client
  ui/               shared shadcn/Tailwind 4 primitives for web
  core, provider, dojo, react, types, client, amm-sdk …   as today
contracts/
  game/, season_pass/, …, player-account/   (section C)
tooling/            eslint/prettier configs — one prettier config for the repo
deploy/, docs/, config/
```

`client/` goes away; workspace globs become `apps/*`, `packages/*`, `tooling/*`. Do the move of this repo's own apps
first, in one commit, with `git mv` so history follows.

**Owner:** Codex (moves, globs, path aliases, CI paths); Claude (deploy scripts and runbooks that reference
`client/apps/game`). **Gate:** every app builds from the root; `pnpm run knip` clean; `deploy/madara-lab/README.md` and
`deploy/appchain` paths updated.

## C. Bring it in

### C.1 Import the repos with history

`git filter-repo --to-subdirectory-filter apps/web --strip-blobs-bigger-than 5M` on a clone of `account-portal` (its
`apps/account-portal` becomes `apps/web`, its `packages/*` become `packages/{db,indexer→apps/indexer,…}`), then
`git merge --allow-unrelated-histories`. Same for `realms-world-site` (temporary `apps/site-import`) and `eternum-stats`
(`apps/stats-import`). Large media goes to `public/` via LFS or a bucket — decide before the first import. Named pnpm
catalogs only if a version must differ per app; the aim after A is that none does.

Then fold: site routes and keystatic content into `apps/web`; the two stats fetches and chart pages into `apps/web`
`/stats/*`; delete both import dirs. The marketplace is **not** imported: it is Arcade-bound; it is ported into
`apps/web` `/market/*` later, against owned read models (out of phase 1).

**Owner:** Claude (filter-repo, merges, catalogs); Codex (route folding, deleting the import dirs). **Gate:** every
public URL of `realms.world` and the stats app resolves from `apps/web`; `pnpm i` from the root; all apps build.

### C.2 One identity, one login — `packages/identity`

Extract the portal's SIWS client and its `@starknet-start` connectors into `packages/identity`: `connectWallet()`
(Ready/Argent, Braavos — injected connectors on `SN_MAIN`, no Controller), `signIn()` (SIWS: nonce → SNIP-12 → session),
`useSession()`. The session cookie is scoped to `.realms.world`, so `apps/game` on its subdomain reads the session
`apps/web` created. No path routing, no microfrontend proxy.

In the game: delete the Cartridge surface listed in the facts; `StarknetProvider` becomes identity-only through
`packages/identity`; `useAccount()` consumers are reclassified by one rule — **signs or reads game ownership → gameplay
account; shows who the player is → identity**; `sign-in-prompt-modal` copy changes; the landing keeps game selection and
entry and loses profile/wallet/player-profile (they are `realms.world/account`). Remove `@cartridge/connector`,
`@cartridge/controller`, `@dojoengine/predeployed-connector`, `VITE_PUBLIC_CARTRIDGE_API_BASE`, and the legacy
`mainnet`/`sepolia` chain kinds, world entries, Cartridge RPC builders and `s1_eternum` signing domain. In the portal:
the same package replaces its Controller login.

**Owner:** Codex. **Gate:** web and game log in with the same session; `@cartridge` appears in no lockfile; no request
to `api.cartridge.gg` in the game's network log on the appchain env.

### C.3 Gameplay account and binding

Two accounts, two jobs:

|         | Identity wallet                       | Gameplay account                                                                    |
| ------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| What    | The player's mainnet wallet           | `RealmsPlayerAccount` on the game chain                                             |
| Signs   | One SIWS message                      | Every game transaction                                                              |
| Lives   | Wallet extension; `packages/identity` | Key in the browser, per `(chainId, owner)`; deployed fee-free with `deploy_account` |
| Purpose | Who you are, where value goes         | Authority to play, nothing else                                                     |

- **`contracts/player-account/`** (pure Cairo, no Dojo, written with the `cairo-contract` TDD skill):
  `RealmsPlayerAccount` = OpenZeppelin `AccountComponent` + `owner: ContractAddress` set in the constructor and never
  changed + `rotate_public_key(new_key)` callable only by the `binding_authority` given at construction.
  `PlayerRegistry`: `bind(owner, account)` by the authority only, one account per owner forever, `account_of(owner)`,
  `owner_of(account)`.
- **`packages/core/src/account/gameplay-account.ts`** (starknet.js only, shared with the harness): derive the address
  from `(owner, publicKey, authority)` with `calculateContractAddressFromHash`, deploy once (skip when `getClassHashAt`
  succeeds), return an `Account`. The client key store keeps one record per `(chainId, owner)` in `localStorage`;
  `owner = 0x0` is guest, allowed on `local`/`madara`, refused on `appchain`. `useAccountStore` holds the gameplay
  `Account` and `owner`; its `connector` field is deleted; it is written from one place, `GameplayAccountSync`. The
  class hash lives in the world profile and is verified with `starknet_getClass` at boot — loud in dev.
- **Two server functions in `apps/web`**, authenticated by the SIWS session (session = verified owner):
  `bind(gameplayAddress, publicKey)` checks on the game chain that the class is `RealmsPlayerAccount` and
  `owner() == session owner`, then `registry.bind`; a second account for the same owner is refused. `rotate(publicKey)`
  → `registry.account_of(owner)` → `rotate_public_key` with the authority key.
- **Flows.** Play: connect → SIWS → local key → deploy → `bind`. Recovery on a fresh browser: session → registry has an
  account → no local key → generate → `rotate` → same gameplay address, same in-game position. No settlement involved.
- **Trust.** The authority key can rotate any player's key (the operator could play as anyone); it cannot move value —
  `owner` is immutable and payouts, when they move to mainnet, go to `owner_of(account)`. Same trust as running the
  sequencer. Log every rotation.
- **Master account** (`VITE_PUBLIC_MASTER_*`) stays as the dev fee-token faucet on dev chains; nothing else.

**Owner:** Codex (contracts, core module, client store/sync, server functions). Claude (declare the class and registry
on the lab and on Katana AWS; authority key = devnet account #2 in the lab `.env`, documented; `postgres` service under
a `web` profile in the lab compose for the session store; drop
`--cartridge.controllers --paymaster --cartridge.paymaster` from the Katana AWS command at the next deploy). **Gate:**
on the lab, connect Braavos or Ready → Play → `starknet_getClassHashAt(gameplay)` is `RealmsPlayerAccount` within one
block → create game / register / settle / move; every `sender_address` is the gameplay account; `AddressName` shows the
settle name; reload keeps the address; a second wallet gets another; guest a third; **clear site data → same wallet →
key rotates → same address plays on**. `?spectate=true` shows no ownership chrome (`utils/spectator-session.ts` stays
the source of truth).

## D. Playing on Madara

### D.1 Client chain target `madara`

`madara` in `VITE_PUBLIC_CHAIN` (`env.ts:59`); `.env.madara.blitz.sample` with
`VITE_PUBLIC_NODE_URL=http://127.0.0.1:5060`, `VITE_PUBLIC_TORII=http://127.0.0.1:8090`,
`VITE_PUBLIC_VRF_PROVIDER_ADDRESS=0x0` (tx-hash randomness fallback, `utils/random.cairo:15-18` — right for the lab),
`VITE_PUBLIC_MASTER_*` = devnet account #1, no `cartridge.gg` host. World directory entry from
`contracts/game/manifest_madara.json` (`runtime/world/world-directory.ts:31-58`). Torii/RPC fallbacks that resolve
`api.cartridge.gg` (`world-torii.ts:14-19`, `factory-endpoints.ts:7`, `chain-rpc.ts:4`, `global-chain.ts:4`,
`profile-builder.ts:15`, `normalize.ts:36,56`, `landing-leaderboard-service.ts:87-90`) become loud — throw in dev;
`madara` never resolves a Cartridge host. Live path stays Torii's subscriptions against the canary; no Madara WebSocket
path exists, do not add one.

**Owner:** Codex. **Gate:** `pnpm dev` with `.env.madara.blitz` shows the lab world; the C.3 gate runs on it.

### D.2 Deployer: `madara.blitz` environment and chain bootstrap

Add `madara.blitz` to `DEPLOYMENT_ENVIRONMENTS` (`config/deployer/clean/constants.ts:85-130`): chain `madara`, namespace
`s2`, manifest `contracts/game/manifest_madara.json`, registrar address from the manifest, config reusing
`config/generated/blitz.appchain.json` except fee token = devnet STRK `0x04718f5a…938d`, VRF = 0x0. `deploy-s2-world.ts`
accepts `--environment madara.blitz` and `RPC_URL`. Collectibles: deploy them in the same script or stub the grants
explicitly and say which in the README — never silently skip.

**Owner:** Codex. **Gate:** the script is idempotent (second run reports "already initialized");
`config/deployer/clean/launch-step.ts` creates a game on the lab chain.

### D.3 Blitz cap 96 with bounded settlement-pool opening

Raise `registration_count_max <= 24` to **96** as a named constant, and put the same assertion in
`set_blitz_registration_config` so the two paths cannot disagree. `target_open_settlement_count`
(`realm/blitz/contracts.cairo:412-433`) tiers 6 → 9 → remaining once 15 have settled; at 96 the third tier is up to 81
iterations of `generate_coords` + `write_model` in one call (`:451-466`). Replace it with a bounded increment (keep the
pool `min(12, remaining)` ahead of demand). Check geometry: 96 → 4 hyperstructure rings → 61 tiles
(`hyperstructure-reservation.ts:22-28`); the reservation batch (`BLITZ_HYPERSTRUCTURE_RESERVATION_BATCH_SIZE = 19`) must
still complete.

**Owner:** Codex. **Gate:** Cairo tests (24 → 96 ok, 97 rejected; no `fill_open_settlement_pool` call writes more than N
positions for every settled count 0..95); `scarb fmt`; redeploy on the lab and register 96 accounts (D.4) with 0
reverts.

### D.4 96-player headless harness

`deploy/madara-lab/harness/` in bun — one file each for driver, account factory (uses `gameplay-account.ts` from C.3,
guest owners), report. Drives `register → settle → provision → action loop` (move, explore, produce) using the call
builders in `apps/game/src/services/blitz/*` and `packages/provider`; records submit, `PRE_CONFIRMED`, `ACCEPTED_ON_L2`
and Torii-indexed times per action; writes `.lab/runs/<timestamp>.json` with chain id, image tag, git rev, bot count,
interval, percentiles. Scales 10 → 20 → 50 → 96 by flag. Not a general load-test framework.

**Owner:** Codex (harness); Claude (`block-stats.sh` before/after every run, attached to the run manifest). **Gate:**
`bun deploy/madara-lab/harness/run.ts --bots 96 --minutes 10` → 0 reverts, run manifest produced, README documents it.

### D.5 Phase-1 integration gate (Claude)

On a clean machine with Docker, asdf `sozo 1.8.7`, `bun`: `deploy/madara-lab/README.md` top to bottom → chain up → world
migrated → `madara.blitz` bootstrapped → `pnpm dev` for `apps/web` and `apps/game` on the lab env → log in on web with
Braavos → open the game → gameplay account deployed and bound → play a Blitz game with 95 harness bots →
`block-stats.sh` numbers recorded in the README. That is phase 1 done.

---

## Cost

Removed: three lockfiles, three CI setups, three Vercel projects' config, three wallet-connection layers, two
chain-constant tables, the game's duplicated profile/wallet UI, ~900 lines of Controller/session/paymaster mechanics,
three dependencies, one env value, the Katana Cartridge flags, the `client/` directory, the legacy S1 chain kinds.
Added: `packages/identity`, `packages/chain`, `contracts/player-account` (~150 lines), `gameplay-account.ts` (~100), key
store + sync (~80), two server functions (~100), a `postgres` block in the lab compose, `tooling/`, and ~750 MB less
history than the raw repos thanks to blob stripping. Net deletion in code; one more service in the lab.

## Out of phase 1 (deliberately)

L3 settlement (the README's "Next" section stays a plan), owned indexer/data plane, pure-Cairo world, RECS replacement,
marketplace port, mainnet prize/fee bridging, AWS re-deploy of Madara. If you find yourself writing one of them here,
stop.

## Decisions taken

- Legacy S1 worlds (`mainnet`, `sepolia`) are deleted from the client. Owner-confirmed 2026-08-25.
- The game moves to React 19 in step A. Owner-confirmed 2026-08-25.
- Guest play only on `local`/`madara`; production entry requires an identity.
- Binding ships with the login; the portal's SIWS is the verifier, the registry is the truth.
- Subdomains + `.realms.world` cookie, not path routing. Game subdomain: keep `blitz.realms.world` unless told
  otherwise.
- Marketplace is ported later, not imported.

## Validation

- Cairo: `scarb fmt`, `sozo test` for touched systems, `cairo-contract` TDD for `player-account`.
- TypeScript: focused tests, `pnpm run format`, `pnpm run knip`.
- Live: the gates above, on the running lab chain; D.4's run manifest attached to the PR.
- Every command a reviewer needs goes into `deploy/madara-lab/README.md`; it must run top to bottom on a clean machine.
