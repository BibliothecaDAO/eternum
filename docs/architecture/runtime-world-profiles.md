Title: Runtime World Selection and Factory-Based Address Resolution

Objective

- Let players choose a world at runtime by name (e.g., credenceox-82389), derive Torii as
  `https://api.cartridge.gg/x/<name>/torii`, and persist choices in localStorage.
- Replace manifest-provided contract addresses with addresses fetched from the World Factory. Use manifest only for
  selectors; match selectors to factory rows by normalized selector, then overwrite addresses in the runtime manifest.
- Gate Dojo setup and initial sync until the world is selected and the patched manifest is ready.

Key Concepts

- WorldProfile: A local record for a chosen world that includes its name, chain, Torii base URL, resolved world address,
  and a lookup of `selector -> contract address` gathered from the factory.
- Factory Query: Query `[wf-WorldContract]` by world name felt-hex (ASCII of the name, left-padded with zeros to 32
  bytes) to fetch `{ contract_address, contract_selector }` rows.
- Manifest Patching: Start from the static manifest (for ABI and selectors), then replace each contract `address` by
  matching `selector` against the factory map. Also set `manifest.world.address` from the selected world’s Torii `/sql`
  (`SqlApi.fetchWorldAddress()`).

Data Flow at Startup

1. World select UI (or confirmation of previously used world) produces a world name.
2. Compose Torii base: `https://api.cartridge.gg/x/<name>/torii`.
3. Factory resolve: query factory SQL for selectors+addresses; build `contractsBySelector` map.
4. Resolve world address: call selected world’s `/sql` (via `SqlApi.fetchWorldAddress`).
5. Patch manifest: for each manifest contract entry, match selector and overwrite address; set world.address.
6. Initialize Dojo with `toriiUrl = selectedWorld.toriiBaseUrl` and `manifest = patchedManifest`.
7. Begin initial sync.

LocalStorage Shape

- ACTIVE_WORLD_NAME: string
- WORLD_PROFILES: { "<name>": { name: string, chain: "sepolia", toriiBaseUrl: string, worldAddress: string,
  contractsBySelector: Record<string, string>, fetchedAt: number } }

Modules (client/apps/game/src/runtime/world)

- types.ts
  - `WorldProfile`, `FactoryContractRow` interfaces.
- normalize.ts
  - `normalizeHex(value)`, `normalizeSelector(value)` → lowercase, strip 0x, left-pad to 64 hex chars.
  - `nameToPaddedFelt(name)` → ASCII → hex → left-pad to 32 bytes (64 hex chars) with `0x` prefix.
- store.ts
  - Simple localStorage-backed CRUD for world profiles and active world name.
  - `getActiveWorld()`, `setActiveWorld(name)`, `saveWorldProfile(profile)`, `listWorldNames()`.
- factory-endpoints.ts
  - `getFactorySqlBaseUrl(chain)`; currently returns sepolia factory
    `https://api.cartridge.gg/x/eternum-factory-sepolia/torii/sql`.
- factory-resolver.ts
  - `resolveWorldContracts(factorySqlBaseUrl, worldName)` → fetch rows from `[wf-WorldContract]` WHERE
    `name = <padded felt>` and build `selector -> address` map.
  - `isToriiAvailable(toriiBaseUrl)` → HEAD probe to `/sql`.
- manifest-patcher.ts
  - `patchManifestWithFactory(baseManifest, worldAddress, contractsBySelector)` → returns a new manifest with addresses
    overwritten.

Integration Plan (Phases)

1. Domain scaffolding (this PR): types, store, normalization, factory resolver, manifest patcher.
2. Wire manifest patcher into bootstrap:
   - Before `setup(...)`, ensure active world profile exists (world select UI), resolve contracts/world address, patch
     manifest, inject into Dojo config.
3. Replace env-based Torii usage:
   - `dojo-config.ts` → use active world `toriiBaseUrl` instead of `TORII_SETTING()`.
   - `services/api.ts` and other consumers → compute SQL/GraphQL endpoints from the active world’s Torii base.
4. World Selector UI:
   - Modal on enter: pick recent, confirm existing, or add a new world name; show availability and cached status.
5. Hardening & telemetry:
   - Retry/caching, clear error UX, and simple logs/tracing around selection and patching.

Notes

- Selector matching normalizes both sides (manifest and factory) using 64-hex left padding for stable equality.
- World name felt-hex is zero-left-padded ASCII; sample: `credenceox-27781` →
  `0x000...0063726564656e63656f782d3237373831`.
- Future: add `predefined-worlds.json` for curated list shown on the landing page.
