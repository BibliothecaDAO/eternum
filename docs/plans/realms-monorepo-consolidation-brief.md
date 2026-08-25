# Realms monorepo consolidation — brief

Bring `account-portal`, `realms-world-site`, `eternum-stats` and (later, rebuilt) `marketplace` into this repository so
`realms.world` is one product: the ecosystem site, the account hub, the stats, and the door into the game. Companion:
`gameplay-account-login-brief.md` (the shared login this merge makes possible).

## What the four repos are (inspected 2026-08-25)

| Repo                | Stack                                                                                                                                                                                                                                                                             | Size   | Notes                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `account-portal`    | pnpm monorepo: `apps/account-portal` (TanStack Start + Router 1.166, React 19, Vite 7, Tailwind 4, shadcn, better-auth **SIWS**, wagmi/reown for the ETH bridge), `packages/{db (Drizzle/Postgres), apibara (indexer), constants, starknet-types-*}`, `tooling/{eslint,prettier}` | 457 MB | Routes: bridge, claims, velords, delegates, proposals. Still imports `@cartridge/*` for Controller login.                        |
| `realms-world-site` | Vite 7 + TanStack Router + React 19 + Tailwind 4 + keystatic content, one Vercel function (`api/og.tsx`)                                                                                                                                                                          | 293 MB | Routes: index, blitz, eternum, games, scroll, terms, privacy. Same stack as the portal app.                                      |
| `eternum-stats`     | Vite 6 + React 19 + react-router + chart.js                                                                                                                                                                                                                                       | 0.8 MB | 90 KB of TS; two components fetch data.                                                                                          |
| `marketplace`       | Next 16 + `@cartridge/arcade` (31 files) + Controller                                                                                                                                                                                                                             | 37 MB  | "Scaffold"; Arcade is Cartridge's SDK and dies with it. Runs `empire.realms.world/trade`, which the game links to for cosmetics. |

This repo: `client/apps/{game, game-docs, eternum-mobile, heavy-load, onchain-agent, realtime-server, amm-indexerv2}`,
`packages/*`, `contracts/*`, `deploy/*`. Catalog: React `^18`, `starknet ^8.5.2`. The game's `ui/features/landing`
(profile, wallet section, player profile, game selector) duplicates what the portal is for.

## Target shape

```
apps/
  web/              realms.world — the portal app, absorbing the site's routes and the stats routes (TanStack Start)
  game/             play.realms.world — the game client, moved from client/apps/game, landing shrunk to game selection
  game-docs/        docs.realms.world
  indexer/          the portal's apibara pipeline (a service, not a library)
  realtime-server/, onchain-agent/, mobile/, heavy-load/, amm-indexer/   as today, each audited: alive or deleted
packages/
  identity/         NEW — wallet connectors + SIWS client + session hook; used by web and game (one login)
  db/               the portal's Drizzle schema and client
  chain/            ONE source of chain ids, RPC urls and addresses: merges the portal's `constants`, this repo's
                    `config` chain tables and `packages/types` addresses
  ui/               shared shadcn/Tailwind 4 primitives for web; the game keeps its design system until React 19
  core, provider, dojo, react, types, client, amm-sdk …   as today
contracts/
  game/, season_pass/, …, player-account/ (from the login brief)
tooling/            the portal's eslint/prettier configs, merged with this repo's root config — one prettier config
deploy/, docs/, config/
```

`client/` as a directory goes away: `apps/` at the root, workspace globs `apps/*`, `packages/*`, `tooling/*`.

## How the pieces fit — three rules

1. **One domain family, one session.** `apps/web` owns login (SIWS, better-auth). The session cookie is scoped to
   `.realms.world`, so `play.realms.world` reads the same session: the game never re-implements login, it only holds the
   gameplay key and the wallet connector it needs to sign the SIWS message when opened directly. No path routing, no
   microfrontend proxy — subdomains and a cookie domain do it.
2. **Same stack merges into one app; different stacks stay apps.** Site + portal + stats are the same stack and become
   routes in `apps/web`. The game is a different stack (React 18, three.js, RECS, its own Vite plugins) and stays its
   own app. The marketplace is a different stack **and** a dead dependency: it is ported into `apps/web` routes against
   owned read models, not merged as a Next app.
3. **Shared code is a package or it is not shared.** Wallet connection exists three times today (game Controller layer,
   portal `@starknet-start` + Controller, site `@starknet-react`); chain constants twice. `packages/identity` and
   `packages/chain` replace all of them. Nothing is copied between apps.

## Sequence (each step ships on its own)

1. **Move, don't rewrite.** `git filter-repo --to-subdirectory-filter apps/web` on a clone of `account-portal`, then
   `git merge --allow-unrelated-histories` into a branch here; same for the site (`apps/site-import`, temporary) and
   stats. History and blame survive. Root workspace globs, named pnpm catalogs (`catalog:react18` for the game, default
   catalog React 19 / `starknet ^9`), one prettier config. Gate: `pnpm i`, every app builds from the root,
   `pnpm run knip` clean.
2. **`packages/identity`.** Extract the portal's SIWS client + `@starknet-start` connectors into a package with
   `peerDependencies: react ^18 || ^19`; the game's login brief (L1) consumes it instead of writing its own wallet
   button. Delete the three wallet layers. Gate: web and game log in with the same session; `@cartridge/*` gone from
   every lockfile.
3. **Site routes into web.** Move `realms-world-site/src/routes/*` and keystatic content into `apps/web`; delete
   `apps/site-import`. Gate: every public URL of realms.world resolves from `apps/web` (`vercel.json` rewrites list); OG
   function moved.
4. **Stats routes into web.** Port the two data fetches and the chart pages to `/stats/*`; delete the stats app.
5. **Game landing shrinks.** `ui/features/landing` keeps game selection + entry; profile, wallet section and player
   profile are deleted in favour of `realms.world/account`. Gate: the game's landing has no route that web also serves.
6. **`packages/chain`.** One chain table; `config`, `packages/types` addresses and the portal's `constants` migrate.
7. **Marketplace port** (after the owned data plane's read models exist): `/market/*` routes in web against owned
   listings; archive the Next repo.
8. **Archive** the four GitHub repos with a README pointer.

## Cost

Deletes: three lockfiles, three CI setups, three Vercel projects' worth of config, three wallet-connection layers, two
chain-constant tables, the game's duplicated profile/wallet UI, and (step 7) a Cartridge-Arcade codebase. Adds: two
packages (`identity`, `chain`), a `tooling/` dir, named catalogs, and a bigger `pnpm i` (the repo grows by ~750 MB of
history and assets — run `git filter-repo` with `--strip-blobs-bigger-than 5M` on the imports and keep large media in
`public/` via LFS or a bucket; decide before step 1).

## Open decisions

- Subdomain for the game: keep `blitz.realms.world` or `play.realms.world`. The cookie domain works for either.
- Postgres for the lab: the session store needs it; `deploy/madara-lab` gets a `postgres` service under a `web` profile
  (~one compose block). Or the lab uses the hosted portal DB — not recommended, dev keys would hit prod auth.
- React 19 upgrade for the game: not part of this brief; `packages/identity` is written to support both.
