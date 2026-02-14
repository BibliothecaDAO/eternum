# Onchain-Agent Pipeline Review

_Review of `client/apps/onchain-agent/` against the canonical World Profile & Cartridge Controller Policy Pipeline._

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [World Discovery & Factory Resolution](#world-discovery--factory-resolution)
3. [Manifest Patching & Policy Construction](#manifest-patching--policy-construction)
4. [Session Management & Controller Initialization](#session-management--controller-initialization)

---

## Executive Summary

### Overall Assessment

The onchain-agent reimplements the canonical world-building pipeline with **good fidelity in phases 1-2** (name
encoding, factory SQL queries) and **identical manifest patching logic** (phase 5), but has **critical gaps in phases
3-4** (Torii confirmation, token address fetch) and **severe policy coverage deficiencies in phase 6**. Session
management (phase 7) uses a fundamentally different — and appropriate — Node.js-native approach, but the chain ID
mapping and missing policy entries will cause transaction failures in production.

### Critical Issues (by severity)

| #   | Severity     | Issue                                                               | Impact                                                                                                                                                                                                                         |
| --- | ------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **CRITICAL** | `buy`/`sell` mapped to `bank_systems` instead of `swap_systems`     | Swap transactions signed against wrong contract address — will fail                                                                                                                                                            |
| 2   | **CRITICAL** | `level_up` mapped to `realm_systems` instead of `structure_systems` | Structure upgrades signed against wrong contract address — will fail                                                                                                                                                           |
| 3   | **CRITICAL** | Missing token policies (`token_lock`, `approve`)                    | Entry token locking and fee token approval rejected                                                                                                                                                                            |
| 4   | **CRITICAL** | Missing VRF provider `request_random` policy                        | Combat, exploration, any randomness-dependent action fails                                                                                                                                                                     |
| 5   | **HIGH**     | Missing `dojo_name` and `world_dispatcher` on ALL systems           | Internal Dojo framework calls may be blocked                                                                                                                                                                                   |
| 6   | **HIGH**     | 11 entire system contracts missing from policy                      | `blitz_realm_systems`, `config_systems`, `name_systems`, `ownership_systems`, `relic_systems`, `season_systems`, `structure_systems`, `swap_systems`, `village_systems`, `dev_resource_systems`, `troop_movement_util_systems` |
| 7   | **HIGH**     | Static `KATANA` chain ID for all slot worlds                        | Session collision between worlds; possible signing failures                                                                                                                                                                    |
| 8   | **HIGH**     | Missing WorldConfig token address fetch                             | `entryTokenAddress`/`feeTokenAddress` always `undefined`                                                                                                                                                                       |
| 9   | **HIGH**     | Tag-suffix `includes()` matching is overly broad                    | Could match wrong contracts (e.g., `resource_bridge_systems` matches `resource_systems`)                                                                                                                                       |
| 10  | **MEDIUM**   | No `toSessionPolicies()` wrapper                                    | Policy format may not match what SessionProvider expects                                                                                                                                                                       |
| 11  | **MEDIUM**   | No message signing policy                                           | Eternum chat message signing rejected                                                                                                                                                                                          |
| 12  | **MEDIUM**   | Hardcoded slot-only RPC URL fallback                                | Mainnet/sepolia worlds without factory `rpcUrl` get wrong endpoint                                                                                                                                                             |
| 13  | **MEDIUM**   | Missing Torii world address confirmation                            | Stale factory data could lead to wrong world address                                                                                                                                                                           |
| 14  | **LOW**      | Duplicated code (`getFactorySqlBaseUrl`, `asRecord`)                | Maintenance burden                                                                                                                                                                                                             |
| 15  | **LOW**      | Fragile 5-level `..` path for manifest loading                      | Breaks if directory structure changes                                                                                                                                                                                          |
| 16  | **LOW**      | `openLink` monkey-patching on private `_backend`                    | Will break on `@cartridge/controller` updates                                                                                                                                                                                  |

### Recommendations

1. **Fix mismatched entrypoints immediately.** Move `buy`/`sell` from `bank_systems` to `swap_systems`. Move `level_up`
   from `realm_systems` to `structure_systems`. These are silent failures — transactions get signed against the wrong
   contract address.

2. **Add missing token and special contract policies.** The agent needs `token_lock` (entry token), `approve` (fee
   token), `request_random` (VRF), and `set_approval_for_all` (Season Pass, Village Pass). Fetch token addresses from
   `s1_eternum-WorldConfig` via Torii SQL.

3. **Add `dojo_name` and `world_dispatcher` to every system** in `POLICY_METHODS_BY_SUFFIX`. These are present on every
   canonical system policy.

4. **Add the 11 missing system contracts** to `POLICY_METHODS_BY_SUFFIX`, or consider importing/deriving from the
   canonical `policies.ts` to avoid maintaining a parallel list.

5. **Derive per-world chain IDs for slot chains.** Parse the RPC URL slug and encode as `WP_{SLUG}` using
   `shortString.encodeShortString`, matching the canonical `deriveChainFromRpcUrl()`.

6. **Wrap policies with `toSessionPolicies()`.** Import from `@cartridge/controller` and include the `messages` signing
   policy.

7. **Fix the tag-suffix matching.** Replace `tag.includes(suffix)` with a stricter match to prevent
   `resource_bridge_systems` from matching `resource_systems`.

8. **Add WorldConfig token address fetch** in `buildWorldProfile()` and **chain-aware RPC URL fallback** instead of the
   hardcoded slot katana URL.

---

## World Discovery & Factory Resolution

### Name Encoding (Phase 1)

**Canonical** (`client/apps/game/src/runtime/world/normalize.ts:21-27`):

```typescript
export const nameToPaddedFelt = (name: string) => {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  const padded = leftPadHex(hex, 64);
  return `0x${padded}`;
};
```

**Onchain-agent** (`client/apps/onchain-agent/src/world/normalize.ts:12-17`):

```typescript
export const nameToPaddedFelt = (name: string) => {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  const padded = leftPadHex(hex, 64);
  return `0x${padded}`;
};
```

**Verdict: Identical.** The `nameToPaddedFelt` implementation is character-for-character the same. Helper functions
`strip0x`, `leftPadHex`, `normalizeHex`, and `normalizeSelector` are also functionally identical. The onchain-agent
omits `toLowerHex` and `isRpcUrlCompatibleForChain` (see Gaps below).

---

### Factory SQL Queries (Phase 2)

#### Factory Endpoint Resolution

**Canonical** (`common/factory/endpoints.ts:7-24`): Uses a shared `getFactorySqlBaseUrl(chain, cartridgeApiBase?)` with
a default and environment variable override via `process.env?.CARTRIDGE_API_BASE`.

**Onchain-agent** (`client/apps/onchain-agent/src/world/discovery.ts:19-31`): Defines its own
`getFactorySqlBaseUrl(chain)` inline with `process.env.CARTRIDGE_API_BASE` override.

**Verdict: Functionally equivalent, but duplicated.** The onchain-agent re-implements the same logic instead of
importing from `common/factory/endpoints.ts`. The switch cases map identically:

- `mainnet` -> `eternum-factory-mainnet`
- `sepolia` -> `eternum-factory-sepolia`
- `slot/slottest/local` -> `eternum-factory-slot-a`

The canonical version also has a `default: return ""` fallback for unknown chains; the onchain-agent's TypeScript
exhaustive switch covers the `Chain` union type but would fail at runtime for any unexpected string.

#### Query 1: World Contracts (`resolveWorldContracts`)

**Canonical** (`client/apps/game/src/runtime/world/factory-resolver.ts:16-33`):

```typescript
const paddedName = nameToPaddedFelt(worldName);
const query = FACTORY_QUERIES.WORLD_CONTRACTS_BY_PADDED_NAME(paddedName);
const url = buildApiUrl(factorySqlBaseUrl, query);
const rows = await fetchWithErrorHandling<FactoryContractRow>(url, "Factory SQL failed");
```

**Onchain-agent** (`client/apps/onchain-agent/src/world/factory-resolver.ts:10-27`):

```typescript
const paddedName = nameToPaddedFelt(worldName);
const query = FACTORY_QUERIES.WORLD_CONTRACTS_BY_PADDED_NAME(paddedName);
const url = buildApiUrl(factorySqlBaseUrl, query);
const rows = await fetchWithErrorHandling<FactoryContractRow>(url, "Factory SQL failed");
```

**Verdict: Identical.** Both use the shared `FACTORY_QUERIES` from `@bibliothecadao/torii`, the shared `buildApiUrl` and
`fetchWithErrorHandling` utilities, and `normalizeSelector` for the map keys.

#### Query 2: World Deployment (`resolveWorldDeploymentFromFactory`)

**Canonical** (`client/apps/game/src/runtime/world/factory-resolver.ts:123-144`): Identical to onchain-agent.

**Onchain-agent** (`client/apps/onchain-agent/src/world/factory-resolver.ts:116-137`): Same implementation.

**Verdict: Identical.** Both functions share the same `extractWorldAddressFromRow` and `extractRpcUrlFromRow` helpers
with the same multi-field fallback logic (checking `address`, `contract_address`, `world_address`, `worldAddress`, plus
nested `data.*` variants).

The canonical file has one additional exported function `resolveWorldAddressFromFactory` (lines 151-157) that the
onchain-agent does not have, but this is a convenience wrapper that isn't needed by the agent.

#### World Discovery (Listing Deployed Worlds)

**Canonical**: No direct equivalent. The game client derives the world from the URL path (`/play/<name>`) via
`deriveWorldFromPath()`.

**Onchain-agent** (`client/apps/onchain-agent/src/world/discovery.ts:87-127`): Has full discovery logic:

- Queries `SELECT name FROM [wf-WorldDeployed] LIMIT 1000` for each chain
- Decodes padded felt names via `decodePaddedFeltAscii()` using `shortString.decodeShortString()` with manual fallback
- Checks each world's Torii availability via `isToriiAvailable()`
- Derives game status (upcoming/ongoing/ended) from `season_config.start_main_at` and `season_config.end_at`
- Filters out unavailable and ended worlds

**Verdict: Novel feature, well-implemented.** This is a genuine addition needed for the CLI world picker. The
`decodePaddedFeltAscii` function in `factory-sql.ts:3-25` correctly handles both `shortString.decodeShortString` and
manual byte-by-byte decoding as fallback.

---

### World Torii Queries (Phase 3)

#### World Address Confirmation (Query 3)

**Canonical** (`client/apps/game/src/runtime/world/profile-builder.ts:34-40`):

```typescript
const sqlApi = new SqlApi(`${toriiBaseUrl}/sql`);
const fetched = await sqlApi.fetchWorldAddress();
worldAddress = normalizeAddress(fetched);
```

Uses `SqlApi.fetchWorldAddress()` which runs:

```sql
SELECT contract_address FROM contracts WHERE contract_type = 'WORLD'
```

Falls back to factory address, then to `"0x0"` as last resort.

**Onchain-agent** (`client/apps/onchain-agent/src/world/discovery.ts:129-153`):

```typescript
const worldAddress = deployment?.worldAddress;
if (!worldAddress) {
  throw new Error(`Could not resolve world address for "${worldName}" on ${chain}`);
}
```

**Verdict: MISSING.** The onchain-agent does **not** query the world's own Torii for address confirmation. It relies
solely on the factory's `[wf-WorldDeployed]` table. The canonical client queries the world's Torii first and only falls
back to the factory. Additionally, the onchain-agent throws an error instead of defaulting to `"0x0"`, which is more
strict but could be more fragile if the factory deployment row lacks an address field.

#### WorldConfig Token Addresses (Query 4)

**Canonical** (`client/apps/game/src/runtime/world/profile-builder.ts:53-66`):

```typescript
const configQuery = `SELECT "blitz_registration_config.entry_token_address" AS entry_token_address, "blitz_registration_config.fee_token" AS fee_token FROM "s1_eternum-WorldConfig" LIMIT 1;`;
```

Fetches `entryTokenAddress` and `feeTokenAddress`, stored in the profile.

**Onchain-agent**: The `WorldProfile` type at `types.ts:14-15` declares `entryTokenAddress?: string` and
`feeTokenAddress?: string`, but `buildWorldProfile` at `discovery.ts:129-153` **never populates them**.

**Verdict: MISSING.** Token addresses are not fetched from WorldConfig. The `WorldProfile` objects built by the agent
will always have `entryTokenAddress` and `feeTokenAddress` as `undefined`. This means any downstream code relying on
these values (e.g., for token_lock or approve policies) would need environment variable fallbacks.

---

### Profile Assembly (Phase 4)

#### `buildWorldProfile` Comparison

**Canonical** (`client/apps/game/src/runtime/world/profile-builder.ts:18-94`):

1. Fetches `contractsBySelector` and `deployment` from factory (parallel)
2. Queries world's Torii for address confirmation (with factory fallback, then `"0x0"`)
3. Fetches WorldConfig token addresses
4. Resolves RPC URL with chain-aware priority: factory -> env var (if compatible) -> chain default
5. Saves to `localStorage` via `saveWorldProfile()`
6. Returns complete `WorldProfile`

**Onchain-agent** (`client/apps/onchain-agent/src/world/discovery.ts:129-153`):

1. Fetches `contractsBySelector` and `deployment` from factory (parallel)
2. Uses factory world address directly (throws if missing)
3. Does NOT fetch WorldConfig token addresses
4. Resolves RPC URL: factory -> hardcoded `DEFAULT_RPC_URL`
5. Does NOT persist to any storage
6. Returns `WorldProfile` (without token addresses)

**Key differences in RPC URL resolution:**

| Priority | Canonical                                    | Onchain-agent               |
| -------- | -------------------------------------------- | --------------------------- |
| 1        | Factory `rpcUrl`                             | Factory `rpcUrl`            |
| 2        | `VITE_PUBLIC_NODE_URL` (if chain-compatible) | N/A                         |
| 3        | Chain-specific Cartridge default             | Hardcoded `DEFAULT_RPC_URL` |

The onchain-agent's `DEFAULT_RPC_URL` at `discovery.ts:35`:

```typescript
const DEFAULT_RPC_URL = "https://api.cartridge.gg/x/eternum-blitz-slot-3/katana/rpc/v0_9";
```

This is only suitable for `slot` chain. If a `mainnet` or `sepolia` world doesn't have a factory `rpcUrl`, the agent
would use a katana URL, which is incorrect.

#### `normalizeRpcUrl` Comparison

**Canonical** (`client/apps/game/src/runtime/world/normalize.ts:31-51`): Identical to onchain-agent.

**Onchain-agent** (`client/apps/onchain-agent/src/world/normalize.ts:22-38`): Same implementation.

**Verdict: Identical.** Both append `/rpc/v0_9` to Cartridge katana/starknet URLs that don't already contain `/rpc/`.

#### Manifest Patching (Phase 5)

**Canonical** (`client/apps/game/src/runtime/world/manifest-patcher.ts:9-34`):

```typescript
const manifest = JSON.parse(JSON.stringify(baseManifest));
if (manifest?.world) manifest.world.address = worldAddress;
if (Array.isArray(manifest?.contracts)) {
  manifest.contracts = manifest.contracts.map((c: any) => {
    if (!c?.selector) return c;
    const key = normalizeSelector(c.selector);
    const addr = contractsBySelector[key];
    if (addr) return { ...c, address: addr };
    return c;
  });
}
return manifest;
```

**Onchain-agent** (`client/apps/onchain-agent/src/world/manifest-patcher.ts:5-29`): Same implementation.

**Verdict: Identical.** Deep clone via JSON round-trip, world address patching, per-contract selector-based address
patching.

#### Manifest Loading

**Canonical**: Uses `getGameManifest(chain)` from `contracts/utils/utils.ts` which returns `manifest_slot.json`,
`manifest_sepolia.json`, etc.

**Onchain-agent** (`client/apps/onchain-agent/src/world/discovery.ts:156-182`): Uses
`buildResolvedManifest(chain, profile)` which reads the manifest file from disk via `readFile` with a relative path
resolution:

```typescript
const manifestPath = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..", "contracts", "game", manifestFile);
```

**Verdict: Functionally equivalent but brittle.** The five-level parent directory traversal
(`../../../../../contracts/game/`) works from the source tree but would break if the compiled output changes directory
depth. The canonical client imports the manifest at build time. The onchain-agent's chain-to-manifest map includes
`slottest` and `local` variants that may not exist on disk.

---

### Fallback Behavior

| Data point               | Canonical                                           | Onchain-agent                    | Match?      |
| ------------------------ | --------------------------------------------------- | -------------------------------- | ----------- |
| World address            | Torii -> Factory -> `"0x0"`                         | Factory only (throws if missing) | **NO**      |
| Contract addresses       | Factory -> Static manifest                          | Factory -> Static manifest       | YES         |
| Entry token address      | WorldConfig -> `VITE_PUBLIC_ENTRY_TOKEN_ADDRESS`    | Not fetched                      | **NO**      |
| Fee token address        | WorldConfig -> `VITE_PUBLIC_FEE_TOKEN_ADDRESS`      | Not fetched                      | **NO**      |
| RPC URL                  | Factory -> env var (if compatible) -> chain default | Factory -> hardcoded slot katana | **PARTIAL** |
| Torii URL                | Constructed from name                               | Constructed from name            | YES         |
| localStorage persistence | Yes (`WORLD_PROFILES` key)                          | No (N/A for CLI)                 | N/A         |

---

### Gaps & Issues

1. **Missing Torii world address confirmation (Phase 3).** The onchain-agent skips
   `SELECT contract_address FROM contracts WHERE contract_type = 'WORLD'` entirely. It relies solely on the factory
   `[wf-WorldDeployed]` table. If the factory has stale data, the agent may use the wrong world address.
   (`discovery.ts:137-139`)

2. **Missing WorldConfig token address fetch.** `entryTokenAddress` and `feeTokenAddress` are never populated in
   `buildWorldProfile`. While the `WorldProfile` type declares these optional fields (`types.ts:14-15`), the builder at
   `discovery.ts:145-153` never queries `s1_eternum-WorldConfig`. Any policy or transaction that depends on these token
   addresses will lack them.

3. **Hardcoded RPC URL fallback is chain-unaware.** `DEFAULT_RPC_URL` at `discovery.ts:35` is
   `https://api.cartridge.gg/x/eternum-blitz-slot-3/katana/rpc/v0_9`, a slot-chain katana endpoint. For `mainnet` or
   `sepolia` worlds without a factory `rpcUrl`, this would provide an incorrect RPC endpoint. The canonical client
   resolves per-chain defaults (e.g., `/x/starknet/mainnet` for mainnet).

4. **No `isRpcUrlCompatibleForChain` validation.** The canonical `normalize.ts` exports `isRpcUrlCompatibleForChain`
   which validates that an RPC URL matches its target chain (e.g., preventing a katana URL from being used for mainnet).
   The onchain-agent's `normalize.ts` does not include this check.

5. **Duplicated `getFactorySqlBaseUrl` instead of importing from `common/factory/endpoints.ts`.** The onchain-agent
   re-implements the factory endpoint mapping in `discovery.ts:19-31` instead of reusing the shared module. This creates
   a maintenance burden: if new chains or factory endpoints are added, both copies must be updated.

6. **`buildResolvedManifest` uses fragile relative path resolution.** The five-level `..` path at `discovery.ts:166-175`
   depends on a specific directory structure and would break if the agent is relocated or compiled to a different output
   directory. The canonical client uses build-time manifest imports.

7. **`buildWorldProfile` throws on missing world address instead of using `"0x0"` fallback.** At `discovery.ts:138-139`,
   the agent throws if `deployment?.worldAddress` is null. The canonical client defaults to `"0x0"` so that manifest
   patching can still proceed with contract selectors (the world address may not be critical for all operations). This
   makes the agent more fragile when dealing with newly deployed worlds whose factory data is incomplete.

8. **Duplicated `asRecord` helper.** The same `asRecord` function is defined in both `factory-resolver.ts:51-67` and
   `factory-sql.ts:27-43`. These could be extracted into a shared utility.

9. **No `localStorage` persistence (by design).** The onchain-agent is a CLI tool and does not use browser localStorage.
   This is expected but means profiles are rebuilt from scratch on every run. If profile caching is desired for CLI
   sessions, a file-based alternative would be needed.

10. **World discovery queries all worlds without ordering.** The `discoverWorldsForChain` function at `discovery.ts:92`
    runs `SELECT name FROM [wf-WorldDeployed] LIMIT 1000` without `ORDER BY`. The canonical pipeline document's curl
    example (Section 13) uses `ORDER BY internal_created_at DESC` to show recent worlds first. This could return an
    arbitrary ordering.

11. **`decodePaddedFeltAscii` uses `shortString.decodeShortString` on decimal conversion.** At `factory-sql.ts:9`, the
    function converts the hex to a BigInt decimal string and passes it to `shortString.decodeShortString`. This works
    for short strings (up to 31 bytes / 31 ASCII chars) but world names exceeding 31 characters would overflow the Cairo
    short string limit. This is likely fine in practice (world names are short), but it's a subtle divergence from the
    canonical approach which uses `nameToPaddedFelt` only in the encoding direction and never needs to decode.

12. **`isToriiAvailable` uses HEAD request to `/sql`.** At `factory-resolver.ts:30-36`, the availability check sends
    `HEAD /sql` without a query parameter. Some Torii implementations may reject HEAD requests or require a query. The
    canonical client does not have an explicit availability check -- it relies on try/catch around actual SQL queries.

---

## Manifest Patching & Policy Construction

### Manifest Patching (Phase 5)

**Canonical** (`client/apps/game/src/runtime/world/manifest-patcher.ts:9-34`):

```typescript
export const patchManifestWithFactory = (
  baseManifest: AnyManifest,
  worldAddress: string,
  contractsBySelector: Record<string, string>,
): AnyManifest => {
  const manifest = JSON.parse(JSON.stringify(baseManifest));
  if (manifest?.world) {
    manifest.world.address = worldAddress;
  }
  if (Array.isArray(manifest?.contracts)) {
    manifest.contracts = manifest.contracts.map((c: any) => {
      if (!c?.selector) return c;
      const key = normalizeSelector(c.selector);
      const addr = contractsBySelector[key];
      if (addr) return { ...c, address: addr };
      return c;
    });
  }
  return manifest;
};
```

**Onchain-agent** (`client/apps/onchain-agent/src/world/manifest-patcher.ts:5-29`):

```typescript
export const patchManifestWithFactory = (
  baseManifest: AnyManifest,
  worldAddress: string,
  contractsBySelector: Record<string, string>,
): AnyManifest => {
  const manifest = JSON.parse(JSON.stringify(baseManifest));
  if (manifest?.world) {
    manifest.world.address = worldAddress;
  }
  if (Array.isArray(manifest?.contracts)) {
    manifest.contracts = manifest.contracts.map((c: any) => {
      if (!c?.selector) return c;
      const key = normalizeSelector(c.selector);
      const addr = contractsBySelector[key];
      if (addr) {
        return { ...c, address: addr };
      }
      return c;
    });
  }
  return manifest;
};
```

**Verdict: Identical.** The `patchManifestWithFactory` function is character-for-character the same (modulo minor
whitespace). Both:

1. Deep-clone via `JSON.parse(JSON.stringify(...))`
2. Patch `manifest.world.address` with the resolved world address
3. Iterate `manifest.contracts`, normalize each contract's `selector` via `normalizeSelector`, and overwrite `address`
   from `contractsBySelector`

Both import `normalizeSelector` from the same relative `./normalize` module, which is itself identical between the two
codebases. The onchain-agent's manifest patcher is a faithful copy.

**Where patching is invoked:**

| Location   | Canonical                                         | Onchain-agent                                    |
| ---------- | ------------------------------------------------- | ------------------------------------------------ |
| Early load | `dojo-config.ts:23-25` (from localStorage cache)  | N/A (no browser storage)                         |
| Bootstrap  | `bootstrap.tsx:150-156` (freshly fetched profile) | `discovery.ts:176-182` (`buildResolvedManifest`) |
| Admin      | `factory.tsx` (admin UI)                          | N/A                                              |

The onchain-agent invokes patching once during `buildResolvedManifest`, which is the equivalent of the canonical
bootstrap path. The lack of early-load patching is expected since the agent has no browser localStorage.

---

### Policy Construction (Phase 6)

This is where the two implementations **diverge significantly**. The canonical client uses a hand-crafted, exhaustive
`buildPolicies` function. The onchain-agent uses a tag-based auto-discovery approach.

#### Canonical Approach (`client/apps/game/src/hooks/context/policies.ts`)

The canonical `buildPolicies(manifest)` function:

1. Calls `getContractByName(manifest, "s1_eternum", "<system_name>")` for each system contract to get the patched
   address
2. Explicitly lists every allowed entrypoint per system
3. Adds token policies from `getActiveWorld()` / env vars
4. Adds special contract policies (VRF, Season Pass, Village Pass)
5. Includes message signing policy from `signing-policy.ts`
6. Wraps everything in `toSessionPolicies()`

#### Onchain-agent Approach (`client/apps/onchain-agent/src/session/controller-session.ts`)

The onchain-agent's `buildSessionPoliciesFromManifest(manifest, options)` function:

1. Iterates every contract in the manifest
2. Matches contracts by tag suffix against a hardcoded `POLICY_METHODS_BY_SUFFIX` map
3. Builds a `{ contracts: {...} }` object
4. Does **NOT** use `toSessionPolicies()` from `@cartridge/controller`
5. Does **NOT** include token policies, special contracts, or message signing

**Verdict: The onchain-agent's policy construction is incomplete and architecturally different.** While the tag-matching
approach is more maintainable for auto-discovery, it misses numerous system contracts, entrypoints, token policies, and
signing policies.

---

### Detailed System Contract Comparison

Below is a system-by-system comparison of what the canonical `buildPolicies` includes vs. what the onchain-agent's
`POLICY_METHODS_BY_SUFFIX` includes.

#### Systems present in BOTH (with method-level differences):

**`resource_systems`**

| Entrypoint                          | Canonical | Onchain-agent |
| ----------------------------------- | --------- | ------------- |
| `send`                              | YES       | YES           |
| `pickup`                            | YES       | YES           |
| `arrivals_offload`                  | YES       | YES           |
| `approve`                           | YES       | **NO**        |
| `deposit`                           | YES       | **NO**        |
| `withdraw`                          | YES       | **NO**        |
| `troop_troop_adjacent_transfer`     | YES       | **NO**        |
| `troop_structure_adjacent_transfer` | YES       | **NO**        |
| `structure_troop_adjacent_transfer` | YES       | **NO**        |
| `structure_burn`                    | YES       | **NO**        |
| `troop_burn`                        | YES       | **NO**        |
| `dojo_name`                         | YES       | **NO**        |
| `world_dispatcher`                  | YES       | **NO**        |

The canonical client defines `resource_systems` twice (lines 418-435 for deposit/withdraw, lines 438-485 for the rest).
The onchain-agent only has 3 of the 13 entrypoints.

**`troop_management_systems`**

| Entrypoint               | Canonical | Onchain-agent |
| ------------------------ | --------- | ------------- |
| `explorer_create`        | YES       | YES           |
| `explorer_add`           | YES       | YES           |
| `explorer_delete`        | YES       | YES           |
| `guard_add`              | YES       | YES           |
| `guard_delete`           | YES       | YES           |
| `explorer_explorer_swap` | YES       | YES           |
| `explorer_guard_swap`    | YES       | YES           |
| `guard_explorer_swap`    | YES       | YES           |
| `dojo_name`              | YES       | **NO**        |
| `world_dispatcher`       | YES       | **NO**        |

Nearly complete, only missing the two boilerplate entrypoints.

**`troop_movement_systems`**

| Entrypoint                | Canonical | Onchain-agent |
| ------------------------- | --------- | ------------- |
| `explorer_move`           | YES       | YES           |
| `explorer_extract_reward` | YES       | YES           |
| `dojo_name`               | YES       | **NO**        |
| `world_dispatcher`        | YES       | **NO**        |

**`troop_battle_systems`**

| Entrypoint                    | Canonical | Onchain-agent |
| ----------------------------- | --------- | ------------- |
| `attack_explorer_vs_explorer` | YES       | YES           |
| `attack_explorer_vs_guard`    | YES       | YES           |
| `attack_guard_vs_explorer`    | YES       | YES           |
| `dojo_name`                   | YES       | **NO**        |
| `world_dispatcher`            | YES       | **NO**        |

**`troop_raid_systems`**

| Entrypoint               | Canonical | Onchain-agent |
| ------------------------ | --------- | ------------- |
| `raid_explorer_vs_guard` | YES       | YES           |
| `dojo_name`              | YES       | **NO**        |
| `world_dispatcher`       | YES       | **NO**        |

**`trade_systems`**

| Entrypoint         | Canonical | Onchain-agent |
| ------------------ | --------- | ------------- |
| `create_order`     | YES       | YES           |
| `accept_order`     | YES       | YES           |
| `cancel_order`     | YES       | YES           |
| `dojo_name`        | YES       | **NO**        |
| `world_dispatcher` | YES       | **NO**        |

**`production_systems`**

| Entrypoint                              | Canonical | Onchain-agent |
| --------------------------------------- | --------- | ------------- |
| `create_building`                       | YES       | YES           |
| `destroy_building`                      | YES       | YES           |
| `pause_building_production`             | YES       | YES           |
| `resume_building_production`            | YES       | YES           |
| `burn_resource_for_labor_production`    | YES       | **NO**        |
| `burn_labor_for_resource_production`    | YES       | **NO**        |
| `burn_resource_for_resource_production` | YES       | **NO**        |
| `dojo_name`                             | YES       | **NO**        |
| `world_dispatcher`                      | YES       | **NO**        |

Missing all three `burn_*` entrypoints for labor/resource production.

**`liquidity_systems`**

| Entrypoint         | Canonical | Onchain-agent |
| ------------------ | --------- | ------------- |
| `add`              | YES       | YES           |
| `remove`           | YES       | YES           |
| `dojo_name`        | YES       | **NO**        |
| `world_dispatcher` | YES       | **NO**        |

**`guild_systems`**

| Entrypoint                     | Canonical | Onchain-agent |
| ------------------------------ | --------- | ------------- |
| `create_guild`                 | YES       | YES           |
| `join_guild`                   | YES       | YES           |
| `leave_guild`                  | YES       | YES           |
| `update_whitelist`             | YES       | YES           |
| `whitelist_player`             | YES       | **NO**        |
| `transfer_guild_ownership`     | YES       | **NO**        |
| `remove_guild_member`          | YES       | **NO**        |
| `remove_player_from_whitelist` | YES       | **NO**        |
| `remove_member`                | YES       | **NO**        |
| `dojo_name`                    | YES       | **NO**        |
| `world_dispatcher`             | YES       | **NO**        |

Missing 7 of 11 entrypoints.

**`hyperstructure_systems`**

| Entrypoint                   | Canonical | Onchain-agent |
| ---------------------------- | --------- | ------------- |
| `contribute`                 | YES       | YES           |
| `initialize`                 | YES       | **NO**        |
| `claim_share_points`         | YES       | **NO**        |
| `allocate_shares`            | YES       | **NO**        |
| `update_construction_access` | YES       | **NO**        |
| `dojo_name`                  | YES       | **NO**        |
| `world_dispatcher`           | YES       | **NO**        |

Only 1 of 7 entrypoints present.

#### Systems COMPLETELY MISSING from onchain-agent:

**`blitz_realm_systems`** -- Canonical includes 6 entrypoints:

- `register`, `create`, `make_hyperstructures`, `obtain_entry_token`, `assign_realm_positions`, `settle_realms`

**`bank_systems`** (correct entrypoints) -- Canonical includes 3 entrypoints:

- `create_banks`, `dojo_name`, `world_dispatcher`

Note: The onchain-agent maps `bank_systems` to `buy`/`sell` (`controller-session.ts:82-85`), but these entrypoints
belong to `swap_systems` in the canonical policy. The canonical `bank_systems` has `create_banks`, not `buy`/`sell`.
This is a routing bug (see Gaps section).

**`config_systems`** -- Canonical includes 27 entrypoints:

- `set_agent_config`, `set_world_config`, `set_mercenaries_name_config`, `set_season_config`, `set_vrf_config`,
  `set_starting_resources_config`, `set_map_config`, `set_capacity_config`, `set_resource_weight_config`,
  `set_tick_config`, `set_resource_factory_config`, `set_donkey_speed_config`, `set_battle_config`,
  `set_hyperstructure_config`, `set_bank_config`, `set_troop_config`, `set_building_config`,
  `set_building_category_config`, `set_resource_bridge_config`, `set_resource_bridge_fee_split_config`,
  `set_resource_bridge_whitelist_config`, `set_structure_max_level_config`, `set_structure_level_config`,
  `set_settlement_config`, `set_trade_config`, `dojo_name`, `world_dispatcher`

**`dev_resource_systems`** -- Canonical includes 3 entrypoints:

- `mint`, `dojo_name`, `world_dispatcher`

**`name_systems`** -- Canonical includes 3 entrypoints:

- `set_address_name`, `dojo_name`, `world_dispatcher`

**`ownership_systems`** -- Canonical includes 4 entrypoints:

- `transfer_structure_ownership`, `transfer_agent_ownership`, `dojo_name`, `world_dispatcher`

**`realm_systems`** (correct entrypoints) -- Canonical includes 3 entrypoints:

- `create`, `dojo_name`, `world_dispatcher`

Note: The onchain-agent maps `realm_systems` to `level_up` (`controller-session.ts:96`), but `level_up` belongs to
`structure_systems` in the canonical policy. The canonical `realm_systems` has `create`. This is a routing bug (see Gaps
section).

**`relic_systems`** -- Canonical includes 4 entrypoints:

- `open_chest`, `apply_relic`, `dojo_name`, `world_dispatcher`

**`season_systems`** -- Canonical includes 4 entrypoints:

- `register_to_leaderboard`, `claim_leaderboard_rewards`, `dojo_name`, `world_dispatcher`

**`structure_systems`** -- Canonical includes 3 entrypoints:

- `level_up`, `dojo_name`, `world_dispatcher`

**`swap_systems`** -- Canonical includes 4 entrypoints:

- `buy`, `sell`, `dojo_name`, `world_dispatcher`

Note: The onchain-agent puts `buy`/`sell` under `bank_systems` (`controller-session.ts:82-85`), not `swap_systems`. This
means the tag matching would resolve these methods to the `bank_systems` contract address, not the `swap_systems`
contract address where the canonical policy places them. This is a **routing bug**.

**`village_systems`** -- Canonical includes 4 entrypoints:

- `upgrade`, `create`, `dojo_name`, `world_dispatcher`

**`troop_movement_util_systems`** -- Canonical includes 2 entrypoints:

- `dojo_name`, `world_dispatcher`

---

### Token Policies

**Canonical** (`client/apps/game/src/hooks/context/policies.ts:9-39`):

```typescript
const activeWorld = getActiveWorld();
const entryTokenAddress = activeWorld?.entryTokenAddress || env.VITE_PUBLIC_ENTRY_TOKEN_ADDRESS;
const feeTokenAddress = activeWorld?.feeTokenAddress || env.VITE_PUBLIC_FEE_TOKEN_ADDRESS;

// Entry token: { [entryTokenAddress]: { methods: [{ entrypoint: "token_lock" }] } }
// Fee token:   { [feeTokenAddress]:   { methods: [{ entrypoint: "approve" }] } }
```

**Onchain-agent**: **COMPLETELY MISSING.** The `buildSessionPoliciesFromManifest` function
(`controller-session.ts:135-178`) does not include any token policies. There is no reference to `token_lock`, `approve`
(for fee token), `entryTokenAddress`, or `feeTokenAddress` anywhere in the session policy construction.

The `WorldProfile` type declares `entryTokenAddress` and `feeTokenAddress` fields (`types.ts:14-15`), but as noted in
the world-reviewer's section, these are never populated, and even if they were, the policy builder does not use them.

**Impact:** Without the entry token `token_lock` policy, the agent cannot lock tokens for game entry. Without the fee
token `approve` policy, the agent cannot approve fee token spending. These are prerequisites for participating in the
game economy.

---

### Special Contract Policies

**Canonical** (`client/apps/game/src/hooks/context/policies.ts:723-747`):

| Contract         | Address Source                                                                  | Entrypoint             |
| ---------------- | ------------------------------------------------------------------------------- | ---------------------- |
| VRF Provider     | Hardcoded: `0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f` | `request_random`       |
| Season Pass NFT  | `getSeasonPassAddress()` (chain-dependent)                                      | `set_approval_for_all` |
| Village Pass NFT | `getVillagePassAddress()` (chain-dependent)                                     | `set_approval_for_all` |

Also, Village Pass is added separately near the top (`policies.ts:90-97`):

```typescript
[getVillagePassAddress()]: {
  methods: [{ name: "set_approval_for_all", entrypoint: "set_approval_for_all" }],
},
```

**Onchain-agent**: **ALL THREE COMPLETELY MISSING.** There is no reference to:

- VRF provider address or `request_random` entrypoint
- Season Pass address or `set_approval_for_all`
- Village Pass address or `set_approval_for_all`
- `getSeasonPassAddress()` or `getVillagePassAddress()` utility functions

**Impact:**

- Without VRF policy, any action requiring randomness (e.g., combat, exploration) will fail at the session signing
  level.
- Without Season/Village Pass `set_approval_for_all`, the agent cannot grant the world contract approval to transfer
  pass NFTs, blocking realm settlement and village operations.

---

### Message Signing Policy

**Canonical** (`client/apps/game/src/hooks/context/signing-policy.ts:1-30`):

```typescript
export const messages = [
  {
    name: "Eternum Message Signing",
    description: "Allows signing messages for Eternum",
    types: {
      StarknetDomain: [
        { name: "name", type: "shortstring" },
        { name: "version", type: "shortstring" },
        { name: "chainId", type: "shortstring" },
        { name: "revision", type: "shortstring" },
      ],
      "s1_eternum-Message": [
        { name: "identity", type: "ContractAddress" },
        { name: "channel", type: "shortstring" },
        { name: "content", type: "string" },
        { name: "timestamp", type: "felt" },
        { name: "salt", type: "felt" },
      ],
    },
    primaryType: "s1_eternum-Message",
    domain: {
      name: "Eternum",
      version: "1",
      chainId: env.VITE_PUBLIC_CHAIN == "mainnet" ? "SN_MAIN" : "SN_SEPOLIA",
      revision: "1",
    },
  },
];
```

This is passed into `toSessionPolicies({ contracts: {...}, messages })` at `policies.ts:749`.

**Onchain-agent**: **COMPLETELY MISSING.** The `buildSessionPoliciesFromManifest` function returns only `{ contracts }`
with no `messages` field. There is no signing policy file anywhere in the onchain-agent source.

**Impact:** The agent cannot sign typed data messages (e.g., in-game chat messages with the `s1_eternum-Message` type).
If the agent needs to send chat messages or any other typed-data-signed operations, the session will reject them.

---

### `dojo_name` and `world_dispatcher` Boilerplate Entrypoints

**Canonical**: Every system contract includes `dojo_name` and `world_dispatcher` entrypoints. These are Dojo framework
methods required for contract identification and world dispatching.

**Onchain-agent**: **NO system contract includes these.** The `POLICY_METHODS_BY_SUFFIX` map at
`controller-session.ts:23-104` does not include `dojo_name` or `world_dispatcher` for any system.

**Impact:** If the Cartridge controller enforces entrypoint-level allowlisting (which it does), any Dojo framework call
to `dojo_name` or `world_dispatcher` on a system contract will be rejected. These are called internally by the Dojo
runtime, so this could cause subtle failures in contract interactions.

---

### `toSessionPolicies` Wrapper

**Canonical**: Uses `toSessionPolicies()` from `@cartridge/controller` to format the policy object:

```typescript
import { toSessionPolicies } from "@cartridge/controller";
// ...
export const buildPolicies = (manifest: any) => toSessionPolicies({ contracts: {...}, messages });
```

**Onchain-agent**: Does **NOT** use `toSessionPolicies()`. Instead, `buildSessionPoliciesFromManifest` returns a raw
`{ contracts: {...} }` object that is passed directly to `SessionProvider`:

```typescript
const policies = buildSessionPoliciesFromManifest(config.manifest, { gameName: config.gameName });
this.provider = new SessionProvider({
  // ...
  policies,
});
```

The `SessionPolicies` type is inferred from the `SessionProvider` constructor:

```typescript
type SessionPolicies = ConstructorParameters<typeof SessionProvider>[0]["policies"];
```

**Verdict:** This may or may not be compatible depending on whether `SessionProvider` from
`@cartridge/controller/session/node` expects the same format as `ControllerConnector`. The canonical browser client uses
`ControllerConnector` which requires `toSessionPolicies()` formatting. The node `SessionProvider` might accept a raw
`{ contracts }` object. However, the missing `messages` field means signing policies are definitely absent.

---

### Tag-Suffix Matching vs. Explicit `getContractByName`

**Canonical**: Uses `getContractByName(manifest, "s1_eternum", "system_name")` from `@dojoengine/core` to resolve each
contract by its exact tag.

**Onchain-agent** (`controller-session.ts:150-153`):

```typescript
if (!(tag === suffix || tag.endsWith(`-${suffix}`) || tag.includes(suffix))) {
  continue;
}
```

The tag matching uses three conditions: exact match, ends-with, or substring inclusion. The `tag.includes(suffix)`
condition is overly broad -- for example, a contract tag like `s1_eternum-resource_bridge_systems` would match the
`resource_systems` suffix pattern via `includes()`, potentially adding `send`/`pickup`/`arrivals_offload` methods to the
wrong contract address.

---

### `bank_systems` / `swap_systems` Routing Bug

**Onchain-agent** (`controller-session.ts:82-85`):

```typescript
bank_systems: [
  { name: "buy", entrypoint: "buy", description: "Buy resources from bank" },
  { name: "sell", entrypoint: "sell", description: "Sell resources to bank" },
],
```

**Canonical** (`policies.ts:74-89` and `policies.ts:542-561`):

- `bank_systems` -> `create_banks`, `dojo_name`, `world_dispatcher`
- `swap_systems` -> `buy`, `sell`, `dojo_name`, `world_dispatcher`

The onchain-agent incorrectly maps `buy`/`sell` to `bank_systems`. Since the policy builder resolves contract addresses
from the manifest by matching the tag suffix, the onchain-agent would resolve the `bank_systems` contract address and
attach `buy`/`sell` to it. But on-chain, `buy`/`sell` are entrypoints on the `swap_systems` contract, not
`bank_systems`. Transactions approved for `bank_systems` address would fail when actually targeting `swap_systems`.

### `realm_systems` / `structure_systems` Routing Bug

**Onchain-agent** (`controller-session.ts:96`):

```typescript
realm_systems: [{ name: "level_up", entrypoint: "level_up", description: "Upgrade realm level" }],
```

**Canonical** (`policies.ts:402-416` and `policies.ts:526-541`):

- `realm_systems` -> `create`, `dojo_name`, `world_dispatcher`
- `structure_systems` -> `level_up`, `dojo_name`, `world_dispatcher`

Same routing bug as above. `level_up` would be approved for `realm_systems` address but actually lives on
`structure_systems`.

---

### Gaps & Issues

_(Continuing numbering from the world-reviewer's section, items 1-12)_

13. **11 of 22 system contracts completely missing from policy.** The following system contracts are present in the
    canonical `buildPolicies` but have zero correct representation in the onchain-agent's `POLICY_METHODS_BY_SUFFIX`:
    `blitz_realm_systems`, `config_systems`, `dev_resource_systems`, `name_systems`, `ownership_systems`,
    `relic_systems`, `season_systems`, `structure_systems`, `swap_systems`, `village_systems`,
    `troop_movement_util_systems`.

14. **Token policies (`token_lock`, `approve`) are absent.** The onchain-agent does not construct entry token or fee
    token policies. Without `token_lock` on the entry token and `approve` on the fee token, the agent cannot perform
    token operations required for game entry and fee payments. (`controller-session.ts` has no reference to any token
    addresses.)

15. **VRF Provider policy is absent.** The hardcoded VRF provider address (`0x051fea...0ced8f`) and its `request_random`
    entrypoint are not included in the onchain-agent's policies. Any action requiring verifiable randomness will be
    rejected by the session.

16. **Season Pass and Village Pass `set_approval_for_all` policies are absent.** Neither `getSeasonPassAddress()` nor
    `getVillagePassAddress()` are referenced anywhere in the onchain-agent. The NFT approval entrypoints needed for
    realm settlement and village creation are missing.

17. **Message signing policy is absent.** The `s1_eternum-Message` typed data signing policy is not included. The
    onchain-agent's `buildSessionPoliciesFromManifest` returns `{ contracts }` without a `messages` field. The agent
    cannot sign typed data messages.

18. **`dojo_name` and `world_dispatcher` entrypoints missing from ALL system contracts.** The canonical policy includes
    these Dojo framework entrypoints on every system contract. The onchain-agent includes them on zero contracts. This
    could cause failures if the Dojo runtime invokes these methods during transaction execution.

19. **`bank_systems` / `swap_systems` routing bug.** The onchain-agent maps `buy`/`sell` to `bank_systems`
    (`controller-session.ts:82-85`), but canonically these entrypoints belong to `swap_systems` (`policies.ts:542-561`).
    This means buy/sell operations would be approved for the wrong contract address. Additionally, the real
    `bank_systems` entrypoint (`create_banks`) is entirely missing.

20. **`realm_systems` / `structure_systems` routing bug.** The onchain-agent maps `level_up` to `realm_systems`
    (`controller-session.ts:96`), but canonically it belongs to `structure_systems` (`policies.ts:526-541`). The real
    `realm_systems` entrypoint (`create`) is entirely missing.

21. **Missing `resource_systems` entrypoints.** Of the 13 canonical entrypoints on `resource_systems`, the onchain-agent
    only includes 3 (`send`, `pickup`, `arrivals_offload`). Missing: `approve`, `deposit`, `withdraw`,
    `troop_troop_adjacent_transfer`, `troop_structure_adjacent_transfer`, `structure_troop_adjacent_transfer`,
    `structure_burn`, `troop_burn`, `dojo_name`, `world_dispatcher`.

22. **Missing `production_systems` burn entrypoints.** The onchain-agent includes 4 of the 9 canonical entrypoints,
    missing `burn_resource_for_labor_production`, `burn_labor_for_resource_production`, and
    `burn_resource_for_resource_production`.

23. **Missing `guild_systems` entrypoints.** The onchain-agent includes 4 of the 11 canonical entrypoints. Missing:
    `whitelist_player`, `transfer_guild_ownership`, `remove_guild_member`, `remove_player_from_whitelist`,
    `remove_member`, `dojo_name`, `world_dispatcher`.

24. **Missing `hyperstructure_systems` entrypoints.** The onchain-agent includes only `contribute` out of 7 canonical
    entrypoints. Missing: `initialize`, `claim_share_points`, `allocate_shares`, `update_construction_access`,
    `dojo_name`, `world_dispatcher`.

25. **Policy builder does not use `toSessionPolicies()` wrapper.** The canonical client imports and uses
    `toSessionPolicies` from `@cartridge/controller` to format the policy. The onchain-agent returns a raw
    `{ contracts }` object. While `SessionProvider` (node) may accept this format, it diverges from the canonical
    pattern and omits the `messages` field entirely.

26. **Tag-suffix matching via `includes()` is overly broad.** The condition `tag.includes(suffix)` at
    `controller-session.ts:151` could match unintended contracts. For example, `resource_bridge_systems` contains the
    substring `resource_systems`, so resource transfer methods (`send`, `pickup`, etc.) would be incorrectly added to
    the resource bridge contract address.

---

## Session Management & Controller Initialization

### Controller Setup (Phase 7)

The onchain-agent and canonical game client use fundamentally different session/controller mechanisms due to their
different runtimes (Node.js CLI vs. browser).

**Canonical (browser)** — `client/apps/game/src/hooks/context/starknet-provider.tsx:89-102`:

```typescript
const controller = new ControllerConnector({
  errorDisplayMode: "notification",
  propagateSessionErrors: true,
  chains: [{ rpcUrl }],
  defaultChainId: resolvedChainId,
  policies: buildPolicies(dojoConfig.manifest),
  slot, // ← VITE_PUBLIC_SLOT env var
  namespace, // ← "s1_eternum" hardcoded
});
```

Uses `ControllerConnector` from `@cartridge/connector`, which is a browser-oriented connector that integrates with
`@starknet-react/core`'s `StarknetConfig`. The connector manages wallet interaction via the Cartridge Controller
iframe/popup.

**Onchain-agent (Node.js)** — `client/apps/onchain-agent/src/session/controller-session.ts:183-199`:

```typescript
constructor(config: ControllerSessionConfig) {
  const policies = buildSessionPoliciesFromManifest(config.manifest, { gameName: config.gameName });
  this.provider = new SessionProvider({
    rpc: config.rpcUrl,
    chainId: config.chainId,
    policies,
    basePath: config.basePath ?? ".cartridge",
  });
}
```

Uses `SessionProvider` from `@cartridge/controller/session/node`, which is a Node.js-specific session provider that
performs headless session management via file-based session storage and browser-based authorization callbacks.

**Key architectural differences:**

| Aspect                     | Canonical (`ControllerConnector`)   | Onchain-agent (`SessionProvider`)     |
| -------------------------- | ----------------------------------- | ------------------------------------- |
| Runtime                    | Browser (iframe/popup)              | Node.js (file-based)                  |
| Auth flow                  | Controller iframe handles signing   | Opens browser URL, waits for callback |
| Session storage            | Browser's internal controller state | `.cartridge/` directory on disk       |
| `slot` parameter           | Passed (`VITE_PUBLIC_SLOT`)         | **Not passed**                        |
| `namespace` parameter      | Passed (`"s1_eternum"`)             | **Not passed**                        |
| `chains` parameter         | `[{ rpcUrl }]`                      | Not applicable (`rpc` string)         |
| `defaultChainId` parameter | Derived from RPC URL                | Passed as `chainId`                   |
| Policy format              | `toSessionPolicies()` output        | Raw `{ contracts: ... }` format       |
| `errorDisplayMode`         | `"notification"`                    | N/A                                   |
| `propagateSessionErrors`   | `true`                              | N/A                                   |

The `SessionProvider` constructor at `controller-session.ts:185-189` takes a simpler interface (`rpc`, `chainId`,
`policies`, `basePath`) compared to `ControllerConnector`'s richer configuration (`slot`, `namespace`, `chains`,
`defaultChainId`, `errorDisplayMode`, `propagateSessionErrors`). This is expected: `SessionProvider` is purpose-built
for headless/server use.

**Missing `slot` and `namespace`:** The onchain-agent does not pass `slot` or `namespace` to `SessionProvider`. The
`SessionProvider` API from `@cartridge/controller/session/node` may not require these parameters (they are
browser-connector-specific for routing to the correct Cartridge Controller instance). However, if `SessionProvider` uses
`slot` internally for session scoping or endpoint resolution, their absence could cause issues. This should be verified
against `@cartridge/controller/session/node` API documentation.

### Chain ID Resolution

**Canonical** (`starknet-provider.tsx:44-70`): Derives chain ID dynamically from the RPC URL via
`deriveChainFromRpcUrl()`:

- `/starknet/mainnet` -> `SN_MAIN`
- `/starknet/sepolia` -> `SN_SEPOLIA`
- `/x/{slug}/katana` -> `shortString.encodeShortString("WP_{SLUG}")` (per-world unique chain ID)

Falls back to a `fallbackChain` based on `VITE_PUBLIC_CHAIN` env var, which supports slot-specific chain IDs
(`0x57505f455445524e554d5f424c49545a5f534c4f545f33` for slot, etc.).

**Onchain-agent** (`config.ts:6-12`): Uses a static `CHAIN_ID_MAP`:

```typescript
const CHAIN_ID_MAP: Record<Chain, string> = {
  slot: "0x4b4154414e41", // "KATANA"
  slottest: "0x4b4154414e41", // "KATANA"
  local: "0x4b4154414e41", // "KATANA"
  sepolia: "0x534e5f5345504f4c4941", // "SN_SEPOLIA"
  mainnet: "0x534e5f4d41494e", // "SN_MAIN"
};
```

Chain ID is `env.CHAIN_ID ?? CHAIN_ID_MAP[chain]` (`config.ts:63`).

**Critical divergence for slot chains:** The canonical client derives per-world chain IDs like `WP_ETERNUM_BLITZ_SLOT_3`
from the RPC URL slug. The onchain-agent uses a generic `"KATANA"` (hex `0x4b4154414e41`) for all slot/slottest/local
chains. If the Cartridge session system scopes sessions by chain ID, this could cause:

1. **Session collision**: Multiple slot worlds sharing the same `KATANA` chain ID might share sessions when they
   shouldn't.
2. **Session rejection**: If the Cartridge backend expects the per-world chain ID (e.g., `WP_ETERNUM_BLITZ_SLOT_3`), a
   session created with `KATANA` might be rejected.

The canonical fallback chain IDs (`SLOT_CHAIN_ID = 0x57505f455445524e554d5f424c49545a5f534c4f545f33`) at
`starknet-provider.tsx:30-32` also differ from the agent's `0x4b4154414e41`. The canonical slot chain ID decodes to
`WP_ETERNUM_BLITZ_SLOT_3`, while the agent's decodes to `KATANA`.

**However**, the `CHAIN_ID` env var override at `config.ts:63` allows operators to set the correct chain ID manually.
When the world discovery flow runs (`index.ts:221`), the `chain` is updated from the selected world, but the `chainId`
is not re-derived -- it remains whatever was set at config load time (likely `KATANA` for slot worlds).

### World Switching (Phase 8)

**Canonical** (`starknet-provider.tsx:160-167`): Supports dynamic world switching via a `dojo-config-updated` event
listener:

```typescript
useEffect(() => {
  const onDojoConfigUpdated = () => {
    setRuntimeConfig(resolveRuntimeStarknetConfig());
  };
  window.addEventListener("dojo-config-updated", onDojoConfigUpdated);
  return () => window.removeEventListener("dojo-config-updated", onDojoConfigUpdated);
}, []);
```

When triggered, it creates a new `ControllerConnector` with fresh policies from the updated manifest.

**Onchain-agent** (`index.ts:259-390`): Has a runtime config hot-swap mechanism via `applyChangesInternal()` that
supports changing `rpcUrl`, `toriiUrl`, `worldAddress`, `manifestPath`, `gameName`, `chainId`, and `sessionBasePath` at
runtime. When any `BACKEND_KEYS` change, it calls `createRuntimeServices(candidate)` which:

1. Loads the new manifest
2. Creates a new `ControllerSession` with new policies
3. Calls `session.connect()` for a new session
4. Creates a new `EternumClient`
5. Hot-swaps the adapter via `adapter.setAdapter(nextServices.adapter)`

**Verdict: Both support world switching, via different mechanisms.** The canonical client uses DOM events; the agent
uses a config manager with queued apply operations. The agent's approach is more robust in some ways (serialized queue,
rollback on failure) but has a notable limitation: it **always re-creates the session** on backend changes, which will
trigger a browser auth flow each time (since the session file may not be valid for the new chain/policies).

**Missing:** The onchain-agent does not have a `resetBootstrap()` equivalent -- there is no explicit cleanup of old
world state (RECS world, subscriptions). The `MutableGameAdapter` at `index.ts:250` handles adapter swapping, but
ECS-level state is not mentioned.

### Session Storage & Persistence

**Session base path resolution** (`runtime-paths.ts:46-48`):

```typescript
export function resolveDefaultSessionBasePath(env): string {
  return path.join(resolveAgentHome(env), ".cartridge");
}
```

Default: `~/.eternum-agent/.cartridge/`. Configurable via `SESSION_BASE_PATH` env var or `ETERNUM_AGENT_HOME` env var.

**Session lifecycle** (`controller-session.ts:203-237`):

- `probe()`: Checks for existing valid session on disk. Returns account if valid, null otherwise. Does NOT trigger
  browser auth.
- `connect()`: Probes first, then if no session, opens a browser auth URL and waits for the user to approve. The
  `openLink` is patched at `controller-session.ts:195-198` to use `open` (macOS) or `xdg-open` (Linux) to actually
  launch the browser.
- `disconnect()`: Clears stored session.

**Session caching:** Sessions persist across agent restarts. The `SessionProvider` stores session data (keys, expiry,
account info) in the `basePath` directory. On restart, `connect()` first calls `probe()` internally, and if a valid
session file exists, it reuses it without requiring re-authorization.

**Potential issue with session invalidation:** When runtime config changes `chainId` or `sessionBasePath` via hot-swap
(`index.ts:307-327`), a new `ControllerSession` is created but the old session file may still exist on disk. If the
chain ID changes (e.g., switching from a slot world to mainnet), the old session would be invalid for the new chain, but
the file is not explicitly cleaned up. The new `SessionProvider` should handle this by probing and finding the session
invalid, then triggering re-auth.

**Contrast with canonical browser flow:** The browser `ControllerConnector` manages sessions internally via the
Cartridge Controller infrastructure (iframe communication, cookie-based session state). There is no file-based storage.
Session scoping is handled by the `slot` parameter, which the agent does not pass.

### Gaps & Issues

13. **Static `KATANA` chain ID for all slot worlds.** The `CHAIN_ID_MAP` at `config.ts:7` maps all
    `slot`/`slottest`/`local` chains to `0x4b4154414e41` (`KATANA`). The canonical client derives per-world chain IDs
    like `WP_ETERNUM_BLITZ_SLOT_3` from the RPC URL slug (`starknet-provider.tsx:59-66`). This mismatch could cause
    session scoping issues or transaction signing failures on slot chains. Even when the world discovery flow updates
    `runtimeConfig.chain` at `index.ts:221`, the `chainId` is not re-derived from the selected world's RPC URL.

14. **No `slot` or `namespace` parameters passed to session provider.** The canonical `ControllerConnector` receives
    `slot: env.VITE_PUBLIC_SLOT` and `namespace: "s1_eternum"` (`starknet-provider.tsx:100-101`). The `SessionProvider`
    in the agent receives neither. If `SessionProvider` uses these for session scoping or Cartridge API routing, their
    absence could cause incorrect session behavior.

15. **Missing token policies (entry token `token_lock`, fee token `approve`).** The canonical `buildPolicies` at
    `policies.ts:14-39` includes policies for `entryTokenAddress` (`token_lock`) and `feeTokenAddress` (`approve`). The
    agent's `buildSessionPoliciesFromManifest` at `controller-session.ts:135-178` does NOT include any token policies.
    Any transaction requiring `token_lock` on the entry token or `approve` on the fee token will fail with a policy
    violation.

16. **Missing special contract policies (VRF, Season Pass, Village Pass).** The canonical policy includes:
    - VRF Provider (`0x051f...`) -> `request_random`
    - Season Pass NFT -> `set_approval_for_all`
    - Village Pass NFT -> `set_approval_for_all`

    The agent's `POLICY_METHODS_BY_SUFFIX` at `controller-session.ts:23-104` does not include any of these. If the agent
    needs to call `request_random` (for VRF), or approve NFT transfers, those transactions will be rejected.

17. **Missing message signing policy.** The canonical `buildPolicies` wraps everything in
    `toSessionPolicies({ contracts: {...}, messages })` where `messages` is the `s1_eternum-Message` typed data signing
    policy from `signing-policy.ts`. The agent's `buildSessionPoliciesFromManifest` returns `{ contracts }` only -- no
    `messages` field. If the agent needs to sign Eternum chat messages, this will fail.

18. **Significantly reduced policy method coverage.** The agent's `POLICY_METHODS_BY_SUFFIX` covers only a subset of the
    canonical policy methods. A detailed comparison:

    | System                      | Canonical methods                             | Agent methods | Missing in agent                                                                                                                                                                         |
    | --------------------------- | --------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | blitz_realm_systems         | 6                                             | 0             | ALL (register, create, make_hyperstructures, obtain_entry_token, assign_realm_positions, settle_realms)                                                                                  |
    | bank_systems                | 3 (create_banks, dojo_name, world_dispatcher) | 2 (buy, sell) | create_banks, dojo_name, world_dispatcher **AND** agent has buy/sell which belong to swap_systems canonically                                                                            |
    | config_systems              | 27                                            | 0             | ALL                                                                                                                                                                                      |
    | dev_resource_systems        | 3                                             | 0             | ALL                                                                                                                                                                                      |
    | guild_systems               | 11                                            | 4             | whitelist_player, transfer_guild_ownership, remove_guild_member, remove_player_from_whitelist, dojo_name, world_dispatcher, remove_member                                                |
    | hyperstructure_systems      | 7                                             | 1             | initialize, claim_share_points, allocate_shares, update_construction_access, dojo_name, world_dispatcher                                                                                 |
    | name_systems                | 3                                             | 0             | ALL                                                                                                                                                                                      |
    | ownership_systems           | 4                                             | 0             | ALL                                                                                                                                                                                      |
    | production_systems          | 9                                             | 4             | burn_resource_for_labor_production, burn_labor_for_resource_production, burn_resource_for_resource_production, dojo_name, world_dispatcher                                               |
    | realm_systems               | 3 (create, dojo_name, world_dispatcher)       | 1 (level_up)  | create, dojo_name, world_dispatcher **AND** agent has level_up which belongs to structure_systems canonically                                                                            |
    | resource_systems            | 11+4 (two entries)                            | 3             | approve, deposit, withdraw, troop_troop_adjacent_transfer, troop_structure_adjacent_transfer, structure_troop_adjacent_transfer, structure_burn, troop_burn, dojo_name, world_dispatcher |
    | relic_systems               | 4                                             | 0             | ALL                                                                                                                                                                                      |
    | season_systems              | 4                                             | 0             | ALL                                                                                                                                                                                      |
    | structure_systems           | 3                                             | 0             | ALL                                                                                                                                                                                      |
    | swap_systems                | 4                                             | 0             | ALL (buy/sell are misplaced under bank_systems in agent)                                                                                                                                 |
    | village_systems             | 4                                             | 0             | ALL                                                                                                                                                                                      |
    | troop_movement_util_systems | 2                                             | 0             | ALL                                                                                                                                                                                      |

    The agent is missing `dojo_name` and `world_dispatcher` on all included systems. These are present in every
    canonical system policy. While they may not be directly called, their absence could block internal Dojo framework
    calls.

19. **`bank_systems` policy maps wrong entrypoints.** The agent's `POLICY_METHODS_BY_SUFFIX` at
    `controller-session.ts:82-85` assigns `buy` and `sell` to `bank_systems`. In the canonical policy, `bank_systems`
    has `create_banks`/`dojo_name`/`world_dispatcher`, while `buy`/`sell` belong to `swap_systems`
    (`policies.ts:542-561`). This means the agent's session would allow `buy`/`sell` on the bank contract address but
    not on the swap contract address where they actually live.

20. **`realm_systems` policy maps wrong entrypoint.** The agent assigns `level_up` to `realm_systems`
    (`controller-session.ts:96`), but canonically `level_up` belongs to `structure_systems` (`policies.ts:526-540`), and
    `realm_systems` has `create` (`policies.ts:402-417`).

21. **No `toSessionPolicies()` wrapper.** The canonical client wraps the entire policy object with `toSessionPolicies()`
    from `@cartridge/controller` (`policies.ts:42`). The agent returns raw `{ contracts }` without this wrapper.
    `toSessionPolicies()` may perform normalization, validation, or formatting required by the Cartridge session system.
    If `SessionProvider` expects the same format that `toSessionPolicies()` produces, the agent's raw format could cause
    issues.

22. **Session re-auth on every world switch.** When `createRuntimeServices` is called during hot-swap (`index.ts:310`),
    it constructs a new `ControllerSession` and calls `session.connect()`. If the prior session file is valid for the
    new configuration, `probe()` will return it. But if `chainId` changes, the old session is invalid and the user must
    re-authorize in the browser. This is unavoidable but means world-switching for the agent is not as seamless as the
    canonical browser experience where the Controller iframe handles re-scoping internally.

23. **`openLink` monkey-patching is fragile.** At `controller-session.ts:194-198`, the constructor reaches into
    `SessionProvider`'s private `_backend` property to override `openLink`. This relies on internal implementation
    details of `@cartridge/controller/session/node` that could break on library updates:
    ```typescript
    const backend = (this.provider as any)._backend;
    if (backend) {
      backend.openLink = (url: string) => { ... };
    }
    ```
