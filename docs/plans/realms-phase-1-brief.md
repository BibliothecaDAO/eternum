# Realms phase 1 — one repo, one login, local Madara proof with no Cartridge dependency

Motto: **KISS, always. Evidence before optimization. Wired or deleted.**

**What phase 1 is:** `realms.world` becomes one repository — the ecosystem site, the account hub, the stats, and the
game — with one login; the game runs end to end on a Madara sequencer on the lab machine; nothing in the repo, its
lockfiles, or its server environments resolves a Cartridge host. **What phase 1 is not:** a production cutover. Hosted
Madara, DNS, the owned data plane that replaces Torii, and value on mainnet are phase 2. Phase 1 keeps **Torii as an
explicitly accepted, end-of-life dependency** (stock image, pointed at the lab chain) because the client's live path has
nothing else yet; phase 2 deletes it.

Branch: `feat/madara-lab` (worktree `/home/djizus/projects/eternum-madara-lab`, based on `origin/next`). The
procedural-terrain PR (`pr-4903`) is finished separately and is not touched here.

Order: **stack → structure → bring it in → play**. Stack first so imports land on the versions they use; structure
second so they land in their final place once; the apps third because the login lives in the portal; play last as the
gate that proves all of it.

## Facts this brief stands on

Verified 2026-08-24/25.

| Fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Evidence                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Cartridge (Katana, Torii, Slot, Controller, paymaster, VRF, Arcade) is end-of-life; announcement expected early September 2026                                                                                                                                                                                                                                                                                                                                              | owner input                   |
| Madara `v0.11.0-alpha.9` (digest `sha256:98e02d4b…`) runs the current Dojo world; `sozo 1.8.7` needs `--use-blake2s-casm-class-hash` and `/rpc/v0_9_0`; migration 22 m 40 s; block close p50 2.2 ms; lab config `block_time: 2s`, `pending_block_update_time: 250ms`, `--no-charge-fee`                                                                                                                                                                                     | `deploy/madara-lab/README.md` |
| Madara has no `starknet_subscribe*` and no `dev_predeployedAccounts`; Torii v1.8.16 follows it with `events_chunk_size = 100`                                                                                                                                                                                                                                                                                                                                               | README, canary                |
| Both game chains are fee-free: Katana AWS `no_fee = true` (`deploy/appchain/config/katana.toml:11`), lab `--no-charge-fee`                                                                                                                                                                                                                                                                                                                                                  | config                        |
| Contracts identify the player by `get_caller_address()` only; the Blitz flow is `obtain_entry_token` (`realm/blitz/contracts.cairo:64`) → `settle` (`:93`) → `provision_realm` (`:218`); the entry fee is `transfer_from(caller, …)` and prizes are `transfer(registered_player, …)` on the game chain (`:285-299`, `prize_distribution/contracts.cairo:173-175,249`)                                                                                                       | source                        |
| `settle(game_id, name, …)` writes `AddressName`; the Controller username was only a client default                                                                                                                                                                                                                                                                                                                                                                          | source                        |
| The Blitz cap of 24 is enforced in **four** places: Cairo `registrar/contracts.cairo:330`, the admin setter `config/contracts.cairo:920-942` (no cap at all), the TypeScript deployer `config/deployer/clean/registrar/preset.ts:598`, and the base config `config/source/blitz/base.ts:18`; `fill_open_settlement_pool` (`realm/blitz/contracts.cairo:451-466`) is unbounded per call                                                                                      | source                        |
| Madara devnet OZ account class `0xe2eb8f56…a1d6` has `__validate_deploy__`, `set_public_key`; Katana AWS `VITE_PUBLIC_ACCOUNT_CLASS_HASH=0x07dc78…` is **not declared** there                                                                                                                                                                                                                                                                                               | `starknet_getClass`           |
| Peer dependencies pin the game to React 18 / starknet 8: `@starknet-react/core@5.0.3` (`react ^18.0`, `starknet ^8.1.2`, `pnpm-lock.yaml:5594`), `@dojoengine/react` and `@dojoengine/sdk` (`react ^18`, `starknet ^8.1.2`, `:2196,2210`). React 19 for the game is part of the dojo.js-exit bundle (`client-legacy-purge-p7-codex-brief.md:161`)                                                                                                                           | lockfile                      |
| The game's Cartridge surface: 7 files import `@cartridge/*`; Controller-only mechanics: `policies.ts`, `signing-policy.ts`, `session-policy-refresh(-state).ts`, `transaction-submit-guard.ts`, `controller-connect.ts`, `use-controller-account.ts`, `use-cartridge-username.tsx`, `use-username.ts`, `ui/modules/controller/controller.tsx`, `paymasterRpcProvider` + `usePredeployedAccounts` in `starknet-provider.tsx`; `useAccount()` read in 17 files                | grep                          |
| Cartridge residue outside the game: `client/apps/onchain-agent` ("Axis", `@cartridge/controller` + `controller-wasm`, `package.json:22-23`); `deploy/appchain/spike/controller-test` (own lockfile); `client/apps/realtime-server` defaults `CARTRIDGE_API_BASE`/`MAINNET_RPC_URL` to `api.cartridge.gg` and keys profiles by `cartridge_username` (`db/schema/profiles.ts:7`); `eternum-mobile` has 6 source files naming Cartridge; `heavy-load` and `amm-indexerv2` none | grep                          |
| `client/public` is 518 MB; the game serves it via `publicDir: "../../public"` (`vite.config.ts:214`). The realm dataset exists twice in different shapes: `packages/core/src/data/realms.json` and `client/public/jsons/realms.json` (6.5 MB, fetched at runtime by `packages/core/src/utils/realm.ts:19`, which `getOffchainRealm` depends on); `packages/core/src/data/realm-names.ts` imports `client/public/jsons/{realms,realm-names}.json` by relative path           | source                        |
| `@starknet-start/react@1.0.0` (the portal's connector layer) peers on `react >=19`, `starknet >=9`; `@starknet-react/core` 5.0.3 peers on React 18 / starknet 8 — no wallet-connector library spans both stacks                                                                                                                                                                                                                                                             | `npm view`                    |
| The lab chain and Torii listen on plain HTTP (`127.0.0.1:5060`, `:8090`); an HTTPS page cannot call them (mixed content)                                                                                                                                                                                                                                                                                                                                                    | compose                       |
| `account-portal` = pnpm monorepo: TanStack Start/Router, React 19, Vite 7, Tailwind 4, shadcn, better-auth **Sign-In-With-Starknet**, Drizzle/Postgres, apibara indexer; routes bridge/claims/velords/delegates/proposals; still imports `@cartridge/*` for login                                                                                                                                                                                                           | GitHub                        |
| That SIWS plugin (`auth-siws-plugin.ts` @ `3bdc16f`) verifies against `https://api.cartridge.gg/x/starknet/{mainnet,sepolia}` (`:68-72`), makes nonces with `Math.random` (`:19-27`), and never deletes a used nonce — the deletion is commented out (`:198-202`); no cross-subdomain cookie or trusted-origin config                                                                                                                                                       | GitHub                        |
| `realms-world-site` = same stack minus Start (routes index/blitz/eternum/games/scroll/terms/privacy, keystatic, one OG function); `eternum-stats` = 90 KB React + chart.js; `marketplace` = Next 16 on `@cartridge/arcade` (31 files), serves `empire.realms.world/trade`                                                                                                                                                                                                   | GitHub                        |
| Domains: `realms.world` (portal), `blitz.realms.world` (game), `empire.realms.world/trade`, `docs.realms.world`                                                                                                                                                                                                                                                                                                                                                             | grep                          |

---

## A. Stack — named catalogs, not a forced upgrade

The game cannot move to React 19 / starknet 9 without dropping `@dojoengine/react`, `@dojoengine/sdk` and
`@starknet-react/core` 5.x (peer deps above). That is the dojo.js exit, which is phase 2 work. So:

- `pnpm-workspace.yaml` gets two named catalogs: `catalog:game` (React `^18`, `starknet ^8.5`, `@starknet-react/core`
  5.0.3, `@dojoengine/*` as today) for `apps/game`, `packages/{core,provider,dojo,react,types,client}` and the harness;
  `catalog:web` (React 19, `starknet ^9`, Vite 7, Tailwind 4) for `apps/web`, `apps/indexer`, `packages/{db,ui}`.
- `packages/identity` and `packages/chain` are consumed by both stacks, so they carry **no React and no starknet peer**:
  `chain` is plain data; `identity` is stack-neutral TypeScript — the SIWS typed-data builder, the
  `/siws/{nonce,verify}` client, the `Session` type, and a `signTypedData` callback each app supplies from its own
  connector layer. Wallet connectors stay in the apps: `@starknet-start/react` in web, `@starknet-react/core` 5.x
  injected connectors (`argent()`, `braavos()`) in the game.
- Install gate: `pnpm i --strict-peer-dependencies` in CI and locally; a peer mismatch is a red build, not a warning.

**Owner:** Codex. **Gate:** strict install passes; `pnpm typecheck`; `pnpm test` in the game; `pnpm exec vitest run` in
`packages/core`; the game plays on the Katana AWS env exactly as before.

## B. Structure

```
apps/
  web/              realms.world — the portal app, absorbing the site's and stats' routes (TanStack Start)
  game/             the game client (from client/apps/game), with its public/ assets
  game-docs/        docs.realms.world
  indexer/          the portal's apibara pipeline
  realtime-server/  see C.2 for what remains of it

  amm-indexer/      client/apps/amm-indexerv2, moved, must build
packages/
  identity/         NEW — stack-neutral SIWS client + session contract; no React/starknet peers
  chain/            NEW — plain data: chain ids, endpoints, addresses (the portal's constants + this repo's config
                    chain tables + packages/types addresses) and the one endpoint resolver that rejects forbidden hosts
  db/               the portal's Drizzle schema and client
  ui/               shared shadcn/Tailwind 4 primitives for web
  core, provider, dojo, react, types, client, amm-sdk …   as today
contracts/
  game/, season_pass/, …, player-account/   (C.3)
tooling/            eslint/prettier configs — one prettier config for the repo
deploy/, docs/, config/
```

Deleted in this step, not "audited": `client/apps/onchain-agent` (Controller-authenticated; rebuilt on gameplay accounts
later if wanted), `client/apps/heavy-load` (superseded by D.4), `deploy/appchain/spike/controller-test`, and
`client/apps/eternum-mobile` — a Vite web client with its own Controller login, session policies and account slice
(`src/app/dojo/context/{starknet-provider,policies,dojo-context}.tsx`, `store/slices/account-slice.ts`): a second copy
of what C.2/C.3 delete from the game, and it cannot compile once `GameChain` replaces `Chain`. History keeps it; phase 2
revives it as `apps/mobile` on `packages/identity` and the gameplay account, which is the same login work applied to an
app that then exists. Web needs no mobile app — the site/portal is responsive; only the game has a distinct mobile UI.

Assets: `client/public` → `apps/game/public` (`git mv`; `publicDir` becomes Vite's default). The realm data becomes one
bundled truth: `client/public/jsons/realms.json` moves to `packages/core/src/data/full-realms.json` (the name avoids the
existing, differently shaped `realms.json`) and `realm-names.json` beside it; `utils/realm.ts:19` replaces its runtime
`fetch("/jsons/realms.json")` with a dynamic `import()` of that file (a lazy 6.5 MB chunk, loaded when it was fetched
before), `realm-names.ts` imports locally, and the public copy is deleted. Whether `data/realms.json` and
`full-realms.json` then collapse into one is a phase-2 question, asked with a diff. No history rewrite of this repo; the
518 MB stays where it is.

Everything else moves with `git mv` in one commit so history follows. `client/` ceases to exist; workspace globs become
`apps/*`, `packages/*`, `tooling/*`.

**Owner:** Codex (moves, globs, path aliases, CI paths); Claude (`deploy/*` scripts and runbooks referencing
`client/apps/game`). **Gate:** every remaining app builds from the root; `pnpm run knip` clean; the game boots on the
Katana AWS env with every asset loading (Playwright: no 404 on `/images`, `/models`, `/textures` during a full world
load; `getOffchainRealm` returns a realm without a network request).

## C. Bring it in

### C.1 Import the repos with history

Exact filters, run on fresh clones, tree gated before any merge:

```bash
# account-portal → apps/web + packages/{db,chain} + apps/indexer + tooling
git filter-repo --strip-blobs-bigger-than 5M \
  --path apps/account-portal --path packages/db --path packages/apibara --path packages/constants --path tooling \
  --path-rename apps/account-portal/:apps/web/ \
  --path-rename packages/apibara/:apps/indexer/ \
  --path-rename packages/constants/:packages/chain/
# realms-world-site → apps/site-import (temporary)
git filter-repo --strip-blobs-bigger-than 5M --to-subdirectory-filter apps/site-import
# eternum-stats → apps/stats-import (temporary)
git filter-repo --to-subdirectory-filter apps/stats-import
```

Gate per clone before merging: `git ls-tree -r HEAD --name-only | cut -d/ -f1-2 | sort -u` equals exactly the expected
directory list. Then `git merge --allow-unrelated-histories` into the branch. Media above 5 MB that the site still needs
goes to a bucket and is referenced by URL; decide the bucket before the first import.

Then fold: site routes and keystatic content into `apps/web`; the two stats fetches and chart pages into `apps/web`
`/stats/*`; delete both import dirs. The marketplace is **not** imported (Arcade-bound); it is ported into `apps/web`
`/market/*` in phase 2 against owned read models.

**Owner:** Claude (filter-repo, tree gates, merges, catalogs); Codex (route folding, deleting the import dirs).
**Gate:** every public URL of `realms.world` and the stats app resolves from `apps/web`;
`pnpm i --strict-peer-dependencies` from the root; all apps build.

### C.2 One identity, one login — `packages/identity`, and the Cartridge purge

Extract the portal's SIWS client into `packages/identity` (stack-neutral, see A): `buildSiwsMessage()`,
`signIn({ signTypedData })`, `getSession()`, the `Session` type. Each app keeps its own connector layer and hands the
package a `signTypedData` from its wallet (web: `@starknet-start/react`; game: `@starknet-react/core` 5.x injected
connectors — Ready/Argent, Braavos on `SN_MAIN`, no Controller).

**Harden the SIWS server before it becomes the trust root** (all in `apps/web`):

- Verification RPC from `IDENTITY_RPC_URL` (required, no default), resolved through `packages/chain`'s endpoint resolver
  like every other host (forbidden-host gate below); the lab points it at a public Starknet mainnet node.
- Nonces from `crypto.randomBytes(32)`, in this order and no other: **verify the signature → atomically consume the
  nonce → create the session.** The consume is one conditional statement
  (`DELETE … WHERE id = ? AND expires_at > now() RETURNING id`) whose empty result is a 401; verifying first means an
  invalid request cannot burn a valid nonce. Tests: invalid signature leaves the nonce usable; sequential replay (second
  call 401); **two concurrent verifications of the same message → exactly one 200**.
- better-auth `advanced.crossSubDomainCookies` on the parent domain, `trustedOrigins` = the web and game origins,
  `secure` cookies.
- **HTTPS for all browser traffic, including the lab.** `/etc/hosts` maps `realms.test`, `play.realms.test`,
  `rpc.realms.test`, `torii.realms.test` to `127.0.0.1`. The lab compose gains a `caddy` service that terminates TLS for
  `rpc.realms.test → madara:9944` and `torii.realms.test → torii:8080` (HTTP/2, gRPC-web and WebSocket pass through)
  using certificates `mkcert` issues into `deploy/madara-lab/.lab/certs/` (gitignored; the mkcert root CA is installed
  once with `mkcert -install`, which covers the system store and Brave's NSS db). Browsers are the only TLS clients:
  `sozo`, the deployer, the harness and the `deploy_account` probe are CLI tools and stay on loopback HTTP
  (`http://127.0.0.1:5060`, `:8090`) — Bun ships its own Mozilla roots and would need extra CA plumbing for nothing. Web
  runs on `https://realms.test`, the game on `https://play.realms.test` (Vite mkcert plugin, `hosts` option). No
  browser-facing value on the branch is `http://` — every `VITE_PUBLIC_*` value, env sample, world profile and
  `packages/chain` endpoint; Docker-internal links (`torii → madara:9944`), health checks, tests and CLI tooling stay
  plain HTTP because no browser touches them. `check:forbidden-hosts` enforces exactly that split. Gate: a session
  created on web is readable on play; an origin outside the list is refused; zero mixed-content errors during a full
  world load.

In the game: delete the Cartridge surface listed in the facts; `StarknetProvider` becomes identity-only through
`packages/identity`; `useAccount()` consumers are reclassified by one rule — **signs or reads game ownership → gameplay
account; shows who the player is → identity**; the landing keeps game selection and entry and loses
profile/wallet/player-profile (they are `realms.world/account`). Remove `@cartridge/connector`, `@cartridge/controller`,
`@dojoengine/predeployed-connector`, `VITE_PUBLIC_CARTRIDGE_API_BASE`, and the legacy `mainnet`/`sepolia`/`local` chain
kinds, world entries, Cartridge RPC builders and `s1_eternum` signing domain. In the portal: `packages/identity`
replaces its Controller login.

Residue, each with a decision: `realtime-server` — `avatars`/`profiles` routes and tables are deleted (web owns the
profile; `cartridge_username` goes with them), and the remaining services take `TORII_SQL_URL` and
`STARKNET_MAINNET_RPC_URL` as required env with no default; `eternum-mobile` is deleted in B, so it carries nothing into
this step.

**Executable gate, not a grep by hand:** `pnpm check:forbidden-hosts` — fails on (a) any dependency in the `@cartridge/`
scope in any `package.json` or lockfile, (b) any `cartridge.gg` host literal in any file outside `docs/` — TypeScript,
JSON, TOML, YAML, shell, env samples, compose and deploy templates included — and (c) any `http://` URL in
browser-facing configuration only — by path, not by guess: `VITE_PUBLIC_*` values in `apps/game/.env*`, `VITE_*` values
in `apps/web/.env*`, `packages/chain/src/endpoints.ts`, and the world profiles under `apps/game/src/runtime/world/`.
Dojo profiles (`contracts/game/dojo_*.toml`), compose files, health checks, tests and scripts are CLI/internal
configuration and are not scanned (234 files legitimately use plain HTTP internally today). There is no loopback
exception because there is no HTTP page left: the `local` (Katana) chain kind becomes `madara` in D.1 — Katana is
Cartridge, and the local chain is Madara behind Caddy. The word itself is not the rule, so the script and this brief do
not trip it. At runtime, `packages/chain`'s single endpoint resolver — through which every RPC, Torii, SQL and identity
URL is read — throws on a forbidden host, and on a plain-HTTP endpoint whenever `window.location.protocol === "https:"`
(the mixed-content rule, made loud instead of silent); no per-variable assertions. Runs in CI from this step on. Plus:
web and game log in with the same session on the `.test` subdomains.

**Owner:** Codex.

### C.3 Gameplay account and binding

Two accounts, two jobs:

|         | Identity wallet                       | Gameplay account                                                                    |
| ------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| What    | The player's mainnet wallet           | `RealmsPlayerAccount` on the game chain                                             |
| Signs   | One SIWS message                      | Every game transaction                                                              |
| Lives   | Wallet extension; `packages/identity` | Key in the browser, per `(chainId, owner)`; deployed fee-free with `deploy_account` |
| Purpose | Who you are, where value goes         | Authority to play — **an operator-custodied burner that never holds value**         |

**Trust model, stated honestly.** The binding authority can rotate the account's key, and after a rotation it can
execute anything from that account — an immutable `owner` field constrains nothing about execution. Therefore the
gameplay account must never hold anything worth stealing. In phase 1 that is true by construction: the lab and the
Katana dev chain have no asset of value (the fee token is devnet STRK the master faucet mints). **Before any real value
touches the game chain (phase 2)**, both of these land, and the "cannot move value" claim is only made after the
adversarial test that proves it: (1) `prize_distribution` pays `registry.owner_of(registered_player)`, never the caller,
and the entry fee is escrowed from the identity side rather than pulled from the burner; (2)
`RealmsPlayerAccount.__execute__` refuses any call whose target is not a registered game system, so a rotated key can
play and nothing else. The test: from the authority, rotate a key, then attempt `transfer`/`approve` on an ERC20 and an
ERC721 held by the account — every attempt must revert.

- **`contracts/player-account/`** (pure Cairo, no Dojo, `cairo-contract` TDD): `RealmsPlayerAccount` = OpenZeppelin
  `AccountComponent` + `owner: ContractAddress` set in the constructor and never changed + `rotate_public_key(new_key)`
  callable only by the `binding_authority` given at construction, emitting `KeyRotated(account, by, new_key)`.
  `PlayerRegistry`: `bind(owner, account)` by the authority only, one account per owner forever, `account_of(owner)`,
  `owner_of(account)`.
- **`packages/core/src/account/gameplay-account.ts`** (starknet.js only, shared with the harness): derive the address
  from `(owner, publicKey, authority)` with `calculateContractAddressFromHash`, deploy once (skip when `getClassHashAt`
  succeeds), return an `Account`. Client key store: one `localStorage` record per `(chainId, owner)`; `owner = 0x0` is
  guest, allowed on `madara`, refused on `appchain`. `useAccountStore` holds the gameplay `Account` and `owner`; its
  `connector` field is deleted; it is written from one place, `GameplayAccountSync`. The class hash lives in the world
  profile and is verified with `starknet_getClass` at boot — loud in dev.
- **Two server functions in `apps/web`**, authenticated by the SIWS session (session = verified owner):
  `bind(gameplayAddress, publicKey)` checks on the game chain that the class is `RealmsPlayerAccount` and
  `owner() == session owner`, then `registry.bind`; a second account for the same owner is refused. `rotate(publicKey)`
  → `registry.account_of(owner)` → `rotate_public_key` with the authority key. Every rotation is logged with owner,
  account, session id.
- **Flows.** Play: connect → SIWS → local key → deploy → `bind`. Recovery on a fresh browser: session → registry has an
  account → no local key → generate → `rotate` → same gameplay address, same in-game position. No settlement involved.
- **Master account** (`VITE_PUBLIC_MASTER_*`) stays as the dev fee-token faucet on dev chains; nothing else.

**Owner:** Codex (contracts, core module, client store/sync, server functions). Claude (declare the class and registry
on the lab and on Katana AWS; authority key = devnet account #2 in the lab `.env`, documented; `postgres` under a `web`
profile in the lab compose for the session store; drop `--cartridge.controllers --paymaster --cartridge.paymaster` from
the Katana AWS command at the next deploy). **Gate:** on the lab, connect Braavos or Ready → Play →
`starknet_getClassHashAt(gameplay)` is `RealmsPlayerAccount` within one block → create game / `obtain_entry_token` /
`settle` / `provision_realm` / move; every `sender_address` is the gameplay account; `AddressName` shows the settle
name; reload keeps the address; a second wallet gets another; guest a third; **clear site data → same wallet → key
rotates → same address plays on**. `?spectate=true` shows no ownership chrome (`utils/spectator-session.ts` stays the
source of truth).

## D. Playing on Madara

### D.1 Chain kinds: `local` becomes `madara`, `sepolia`/`mainnet` go — one rename, every site

The chain kind exists three times today: `Chain` in `contracts/utils/utils.ts:49` (the `@contracts` export the client
uses), a duplicate `Chain` in `config/source/common/types.ts:1`, and `NetworkType` in `config/utils/environment.ts:1` —
all `"sepolia" | "mainnet" | "local" | "appchain"`. After this step there is one: `GameChain = "madara" | "appchain"` in
`packages/chain`, and the three copies are deleted with every consumer importing it. `local` is not deleted and
re-added: it is **renamed** to `madara` with its semantics fixed — the RPC comes from `VITE_PUBLIC_NODE_URL`, never a
hardcoded `http://localhost:5050`; the chain id is `WP_REALMS_MADARA_LAB`. Every site that switches on the kind changes
in the same commit:

- Client: `env.ts:59` (enum + default `madara`), `runtime/world/store.ts:20` (`CHAIN_VALUES`),
  `hooks/context/starknet-chain-config.ts` (`chainKind` union; the `KATANA_*` constants and the Cartridge RPC builders
  are deleted), `starknet-provider.tsx`, `signing-policy.ts` (deleted with C.2), `init/bootstrap.tsx`,
  `services/api.ts`, `ui/features/landing/components/{selected-world-entity-wait,game-entry-modal}.ts(x)`,
  `ui/utils/network-switch.ts`, `utils/torii-setting.ts`, and the world directory
  (`runtime/world/world-directory.ts:31-58`) which gains the `madara` entry from `contracts/game/manifest_madara.json`
  and loses `sepolia`/`mainnet`.
- Env: `.env.madara.blitz.sample` replaces `.env.local.blitz.sample` with
  `VITE_PUBLIC_NODE_URL=https://rpc.realms.test`, `VITE_PUBLIC_TORII=https://torii.realms.test`,
  `VITE_PUBLIC_VRF_PROVIDER_ADDRESS=0x0` (tx-hash randomness fallback, `utils/random.cairo:15-18` — right for the lab),
  `VITE_PUBLIC_MASTER_*` = devnet account #1. `.env.sepolia.*` and `.env.mainnet.*` are deleted.
- Deployer/config: `config/package.json` script `local:blitz` becomes `madara:blitz` and `sync:local:blitz` becomes
  `sync:madara:blitz`; `local:eternum`, `sync:local`, `sepolia:*` and `mainnet:*` scripts are deleted — phase 1
  exercises Blitz only, and an eternum environment would need its own preset, manifest and gate.
  `config/deployer/clean/constants.ts:53` (`local: DEFAULT_LOCAL_RPC_URL`) becomes `madara` reading `RPC_URL`;
  `config/source/{blitz,eternum}/chains.ts`, `config/scripts/run-sync.ts`, `config/utils/confirmation.ts` follow;
  `config/deployer/clean/paymaster/sync-policy.ts` is deleted with the paymaster. **The deployer's legacy `local`
  environment does not survive**; `madara.blitz` (D.2) is its only replacement.
- Root orchestration (`package.json:18-51`): every `*:local` wrapper is renamed to `*:madara` where the step exists in
  the lab — `game:migrate:madara` → `deploy/madara-lab/scripts/deploy-world.sh`, `config:deploy:madara:blitz`,
  `config:sync:madara:blitz`, `prefactory:deploy:madara:blitz`, and `contract:start:madara` = compose up + migrate +
  config deploy — and deleted where the underlying tool is Katana or a local Torii (`katana:*`, `indexer:*:local`,
  `toml:update:local`) or out of phase 1 (`amm:*`, `marketplace:migrate:local`, every `*:eternum`, `dev:mainnet`, all
  `sepolia`/`mainnet` wrappers). The collectible contract scripts (`seasonpass`/`villagepass`/`seasonresources:deploy`)
  survive as `:madara` only if D.2's collectibles path calls them; D.2 states which, and the others go.
- Hosts: every fallback that resolves `api.cartridge.gg` (`world-torii.ts:14-19`, `factory-endpoints.ts:7`,
  `chain-rpc.ts:4`, `global-chain.ts:4`, `profile-builder.ts:15`, `normalize.ts:36,56`,
  `landing-leaderboard-service.ts:87-90`) is deleted, not guarded — `packages/chain` is the only place a host comes
  from, and `check:forbidden-hosts` keeps it that way.
- Live path stays Torii's subscriptions against the canary; no Madara WebSocket path exists, do not add one.

**Owner:** Codex. **Gate:** `GameChain` is defined once, in `packages/chain`, and
`grep -rn "type Chain\b\|type NetworkType\b" contracts config apps packages --include='*.ts'` finds no other union;
`pnpm typecheck` passes with the three old types deleted (every consumer had to move); no `.env.local.*`,
`.env.sepolia.*`, `.env.mainnet.*` file and no `local`/`sepolia`/`mainnet` script remains in the root `package.json`,
`apps/game` or `config`, and every remaining `*:madara` root script is exercised by D.5;
`packages/chain/src/endpoints.ts` lists exactly `madara` and `appchain`; tests updated, not skipped; `pnpm dev` with
`.env.madara.blitz` shows the lab world; the C.3 gate runs on it.

### D.2 Deployer: `madara.blitz` environment and chain bootstrap

Add `madara.blitz` to `DEPLOYMENT_ENVIRONMENTS` (`config/deployer/clean/constants.ts:85-130`): chain `madara`, namespace
`s2`, manifest `contracts/game/manifest_madara.json`, registrar address from the manifest, config from a new
`config/source/blitz/madara.ts` (base + `registration_count_max: 96`, fee token = devnet STRK `0x04718f5a…938d`, VRF =
0x0) generating `config/generated/blitz.madara.json`. `deploy-s2-world.ts` accepts `--environment madara.blitz` and
`RPC_URL`. Collectibles: deploy them in the same script or stub the grants explicitly and say which in the README —
never silently skip.

**Owner:** Codex. **Gate:** the script is idempotent (second run reports "already initialized");
`config/deployer/clean/launch-step.ts` creates a 96-player game on the lab chain.

### D.3 Blitz cap 96 — every choke point, one constant per language

- Cairo: `BLITZ_REGISTRATION_COUNT_CAP: u16 = 96` in one constants module, asserted in `validate_registration_capacity`
  (`registrar/contracts.cairo:330`) **and** in `set_blitz_registration_config` (`config/contracts.cairo:920-942`).
- TypeScript: `BLITZ_REGISTRATION_COUNT_CAP = 96` in `config/deployer/clean/constants.ts` (the deployer is its only
  consumer; `packages/chain` stays ids, endpoints and addresses), used by `resolveRegistrationCountMax`
  (`preset.ts:598`) — the literal 24 goes; `config/source/blitz/base.ts:18` stays 24 for the appchain preset, the madara
  preset says 96.
- Settlement pool: `target_open_settlement_count` (`realm/blitz/contracts.cairo:412-433`) tiers 6 → 9 → remaining; at 96
  the third tier is up to 81 iterations of `generate_coords` + `write_model` in one call (`:451-466`). Replace the third
  tier with `min(BLITZ_SETTLEMENT_POOL_STEP, remaining)` where `BLITZ_SETTLEMENT_POOL_STEP: u16 = 12`.
- Geometry: 96 → 4 hyperstructure rings → 61 tiles (`hyperstructure-reservation.ts:22-28`); the reservation batch
  (`BLITZ_HYPERSTRUCTURE_RESERVATION_BATCH_SIZE = 19`) must still complete.

**Owner:** Codex. **Gate:** Cairo tests: 96 accepted, 97 rejected on both paths; for every settled count 0..95 no
`fill_open_settlement_pool` call writes more than 12 positions. TypeScript test: the deployer accepts 96 and rejects 97.
`scarb fmt`. Redeploy on the lab; D.4 settles 96 accounts with 0 reverts.

### D.4 96-player headless harness — with an acceptance bar

`deploy/madara-lab/harness/` in bun — one file each for driver, account factory (`gameplay-account.ts` from C.3, guest
owners), report. Drives `deploy account → obtain_entry_token → settle → provision_realm → action loop` using the call
builders in `apps/game/src/services/blitz/*` and `packages/provider`; records per action: submit, `PRE_CONFIRMED`,
`ACCEPTED_ON_L2`, Torii-indexed times — indexing is correlated **by transaction hash** against Torii's
`transactions`/`events` tables (both enabled in `torii.toml.template`), never by a mutable model row, which a later
action can overwrite; writes `.lab/runs/<timestamp>.json` with chain id, image tag, git rev, bot count, interval, mix,
percentiles, and the `block-stats.sh` output before and after.

**Workload:** 96 bots, one action per bot every 15 s (384 actions/min), mix 50 % move / 30 % explore / 20 % produce, 10
minutes → at least 3,500 completed actions per run. **Thresholds, derived from the lab chain config (2 s blocks, 250 ms
pending updates):** 0 reverts; p95 submit→`PRE_CONFIRMED` ≤ 1 s; p95 submit→`ACCEPTED_ON_L2` ≤ 4 s; p95 submit→indexed ≤
6 s; indexing loss 0 (every action's transaction hash appears in Torii within 30 s). A miss is a finding recorded in the
README, not a reason to loosen the bar.

**Owner:** Codex (harness); Claude (thresholds review, `block-stats.sh` attachment). **Gate:**
`bun deploy/madara-lab/harness/run.ts --bots 96 --minutes 10` meets the bar and produces the run manifest; the README
documents the command and the numbers.

### D.5 Phase-1 integration gate (Claude)

On a clean machine with Docker, asdf `sozo 1.8.7`, `bun`: `deploy/madara-lab/README.md` top to bottom → chain up → world
migrated → `madara.blitz` bootstrapped → `apps/web` on `https://realms.test` and `apps/game` on
`https://play.realms.test` against `https://rpc.realms.test` / `https://torii.realms.test` → log in on web with Braavos
→ open the game → gameplay account deployed and bound → **after** D.4's 96-bot benchmark has met its bar, a separate
integration game: one human plus 95 harness bots, played to a result → `check:forbidden-hosts` green → `block-stats.sh`
numbers recorded in the README. That is phase 1 done.

---

## Cost

Removed: three lockfiles, three CI setups, three Vercel projects' config, three wallet-connection layers, two
chain-constant tables, the game's duplicated profile/wallet UI, ~900 lines of Controller/session/paymaster mechanics,
three dependencies, one env value, the Katana Cartridge flags, `onchain-agent`, `heavy-load`, `eternum-mobile`, the
controller spike, the root `*:local`/`sepolia`/`mainnet` wrappers, realtime-server's profile/avatar routes, the
`client/` directory, the S1 chain kinds and the deployer's `local`/`sepolia`/`mainnet` environments, every hardcoded
Cartridge host. Added: `packages/identity`, `packages/chain`, `contracts/player-account` (~150 lines),
`gameplay-account.ts` (~100), key store + sync (~80), two server functions (~100), SIWS hardening (~60),
`check:forbidden-hosts` (~30), a `caddy` block and certs in the lab compose, a `postgres` block in the lab compose, two
named catalogs, `tooling/`. Net deletion in code; one more service in the lab.

## Out of phase 1 (deliberately)

Hosted Madara, DNS and cutover; L3 settlement (the README's "Next" section stays a plan); owned indexer/data plane
(Torii stays, accepted); pure-Cairo world; RECS replacement; the game's React 19 / starknet 9 move (with the dojo.js
exit); marketplace port; value on the game chain and the two protections it requires (C.3); AWS re-deploy. If you find
yourself writing one of them here, stop.

## Decisions taken

- Phase 1 is a local proof, not a cutover. Torii is the one accepted EOL dependency.
- Legacy S1 worlds (`mainnet`, `sepolia`) are deleted from the client. Owner-confirmed 2026-08-25.
- The game stays on React 18 / starknet 8 in phase 1 (peer deps); web is React 19 / starknet 9; named catalogs. This
  reverses the 2026-08-25 "React 19 is fine" call on the evidence in the facts table.
- The gameplay account is an operator-custodied burner that must never hold value; the protections that make it safe for
  value are named and gated for phase 2.
- Guest play only on `madara`; production entry requires an identity.
- The `local` (Katana) chain kind is renamed to `madara` with its RPC from env; `sepolia`/`mainnet` are deleted.
- Binding ships with the login; the hardened SIWS is the verifier, the registry is the truth.
- Subdomains + parent-domain cookie, not path routing. Game subdomain: keep `blitz.realms.world`.
- Marketplace is ported in phase 2, not imported.
- Mobile is deleted in phase 1 and revived in phase 2 as `apps/mobile` on the shared identity and gameplay-account
  packages; web has no separate mobile app.

## Validation

- Cairo: `scarb fmt`, `sozo test` for touched systems, `cairo-contract` TDD for `player-account`.
- TypeScript: focused tests, `pnpm i --strict-peer-dependencies`, `pnpm run format`, `pnpm run knip`,
  `pnpm check:forbidden-hosts`.
- Live: the gates above, on the running lab chain; D.4's run manifest attached to the PR.
- Every command a reviewer needs goes into `deploy/madara-lab/README.md`; it must run top to bottom on a clean machine.
