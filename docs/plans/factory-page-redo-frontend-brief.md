# Factory page redo — frontend brief (Opus agent)

## Goal

Redo the factory page (`apps/game/src/ui/features/factory-v2`) so it (1) launches on the **madara lab**, not only the
appchain, and (2) is **streamlined** now that registered presets carry the game config. Frontend only — the launch
backend (dispatch worker + `game-launch.yml` + scheduler) is [[madara-lab-game-launch-scheduler-codex-brief]].

## Systemic framing (KISS)

**madara is the appchain — the dev deployment.** A future mainnet appchain (and possibly a second madara deployment)
will launch the same way. So the redo is a **deletion**: remove the hardcoded `"appchain"` assumption and make the page
**environment-list-driven**, exactly as `catalog.ts`'s own comment already promises ("a new environment only needs a
list entry"). A new deployment must cost one config/env-list entry, not a new code path. Do **not** add a parallel
`"madara"` special case, and do not key behaviour off the chain literal where an environment/config field is the real
signal.

## Evidence (current state, grounded)

- **catalog.ts is appchain-hardcoded.**
  `FACTORY_ENVIRONMENTS_BY_MODE = { eternum:["appchain.eternum"], blitz:["appchain.blitz"] }` (no `madara.blitz`);
  `resolveFactoryLaunchChain() => "appchain"` ignores the env id (its comment claims the opposite).
  `FactoryLaunchChain = GameChain` already includes `madara` (types.ts:5).
- **The worker client excludes madara.** `api/factory-worker.ts`:
  `SUPPORTED_FACTORY_WORKER_ENVIRONMENTS = { appchain.eternum, appchain.blitz }` (:357-360); base URL is
  `env.VITE_PUBLIC_FACTORY_WORKER_URL` (:355). The Cloudflare worker itself already accepts `madara.blitz`.
- **Presets vs the lab.** `catalog.ts` blitz presets carry registrar `version` `"6"`/`"7"`; the lab registered preset
  `"1"`. Backend §D **registers presets 6/7 on the lab and defaults madara to 6**, so the UI sends `6`/`7` **unchanged —
  no mapping**. (Whatever `version` the UI sends must be registered on the target chain.)
- **The launch is server-side.** `create-run-request.ts` `buildFactoryCreateRunRequest` POSTs
  environment/gameName/startTime/version/devMode/twoPlayer/singleRealm/duration/overrides to the worker, which
  dispatches `game-launch.yml`; `create_game` runs with the **registrar** key server-side. The **user's wallet is not
  the launch signer** — the console's Cartridge 502 / "insufficient transaction data" fee-tip noise was Controller
  connection-time, not the launch. Audit whether the deployer-wallet card (`deployer-wallet.ts`,
  `factory-v2-deployer-wallet-card.tsx`) is needed on the lab or should be hidden; **do not require the user to hold fee
  tokens to launch.**
- **Defaults today.** The request builder sends **no game seed** (the launcher derives it) and **no explicit player
  count** in the default path (it relies on the preset/config `registration_count_max`, capped at 96). Biome seeds
  already randomize (`biome-climate-options.ts:139-140`).
- **Structure.** `pages/factory-v2.tsx` (route, 18L) → `components/factory-v2-content.tsx` (layout, 274L) →
  `hooks/use-factory-v2.ts` (the state hook, 2533L), plus start/watch workspaces, mode/workflow switches, developer
  tools, more-options, biome-climate.

## The redo

### 1. Environment-list-driven (the systemic un-hardcode)

- `catalog.ts`: derive the offered environments from a single source of truth for "which environments exist for this
  build" (keyed off `env.VITE_PUBLIC_CHAIN` / an env list), not the hardcoded appchain arrays. A madara build offers
  `madara.blitz`; appchain builds keep the appchain envs. Fix `resolveFactoryLaunchChain` to parse the chain from the
  env id (`id.split(".")[0]`). Add the `madara.blitz` label.
- `api/factory-worker.ts`: fold `madara.blitz` into `SUPPORTED_FACTORY_WORKER_ENVIRONMENTS` — ideally derive that set
  from the same single source, so the next deployment is one list entry.
- Point the client at the lab worker: set `VITE_PUBLIC_FACTORY_WORKER_URL` to the lab worker (backend §B) in
  `apps/game/.env.production`; appchain builds keep the appchain worker.

### 2. Fix the flagged defaults

- **Seed:** the default game seed is hardcoded — every launch must use fresh randomness (or the launcher's derivation).
  Verify the game seed and any map/settlement seed default to a random/derived value per launch, never a constant.
- **Player count:** the default number of players is wrong — default to the **selected preset's** registration cap (e.g.
  96 for standard blitz, 2 for Duel), sourced from the preset, not a hardcoded/incorrect value.

### 3. Streamline now that presets carry the config

- Presets already encode duration, devMode, twoPlayer, singleRealm, and `version`. The default flow should be: **pick
  mode → pick preset → start time → launch.** Drop the manual knobs presets already set from the primary path; keep the
  advanced overrides (map / biome-climate / registration / developer tools) behind an explicit **Advanced** toggle.
- The default page should read like a short checklist, not a config panel — fewer inputs, clearer run status. Given
  `use-factory-v2.ts` is 2.5k lines, expect to split it: the streamlined flow should not carry the advanced-overrides
  state unless Advanced is open.

### 4. Keep the tests honest

- Keep green / update: `factory-v2-content.launch-network.test.tsx`, the workflow-default/selection tests, the catalog
  and `create-run-request` tests. Add coverage: `madara.blitz` is offered on a madara build; `resolveFactoryLaunchChain`
  parses the chain; the game seed varies per launch; the default player count comes from the preset.

## Coordination with the backend brief

- Environment id `madara.blitz`; worker URL via `VITE_PUBLIC_FACTORY_WORKER_URL` → the lab worker. Presets: backend §D
  registers 6/7 on the lab (default 6), so the UI sends 6/7 unchanged — **no mapping needed**.

## Verifiable gate

On a `play.realms.party` (madara) build: the factory page offers **Blitz on the lab**, launches via the lab worker (a
run record appears and `game-launch.yml` dispatches), and the game shows in herald `/madara/games` with a joinable
window. The user needs **no fee tokens**. The default seed varies per launch; the default player count matches the
preset.

## Non-goals

- The launch backend — worker, `game-launch.yml`, scheduler, AWS teardown
  ([[madara-lab-game-launch-scheduler-codex-brief]]).
- A ground-up visual redesign beyond the streamline, unless the owner gives a design direction.

## Systemic follow-up (note, not this brief)

The dev-vs-prod signal (e.g. the landing "Played" column hides dev-mode games, currently gated on `chain === "madara"`)
should become **environment/config-driven**, not chain-literal — because a future **mainnet** appchain may also be a
madara chain. Track this so the chain-literal proxies get replaced when a second madara deployment exists.
