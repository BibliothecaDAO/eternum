# World Profile & Cartridge Controller Policy Pipeline

**The complete reference** for how Eternum dynamically builds world profiles from factory data, patches manifests, and
constructs the Cartridge controller policy used for transaction signing and approval.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Map](#2-file-map)
3. [Data Types](#3-data-types)
4. [Phase 1 — Name Encoding](#4-phase-1--name-encoding)
5. [Phase 2 — Factory SQL Queries](#5-phase-2--factory-sql-queries)
6. [Phase 3 — World Torii Queries](#6-phase-3--world-torii-queries)
7. [Phase 4 — Profile Assembly](#7-phase-4--profile-assembly)
8. [Phase 5 — Manifest Patching](#8-phase-5--manifest-patching)
9. [Phase 6 — Policy Construction](#9-phase-6--policy-construction)
10. [Phase 7 — Controller Initialization](#10-phase-7--controller-initialization)
11. [Phase 8 — World Switching & Dynamic Updates](#11-phase-8--world-switching--dynamic-updates)
12. [Fallback Behavior](#12-fallback-behavior)
13. [Reproducing the Pipeline with curl](#13-reproducing-the-pipeline-with-curl)
14. [Appendix: Factory SQL Schema](#14-appendix-factory-sql-schema)
15. [Appendix: Full Policy Method List](#15-appendix-full-policy-method-list)

---

## 1. Architecture Overview

```
                         ┌─────────────────────┐
                         │  URL: /play/<name>   │
                         └─────────┬───────────┘
                                   │ deriveWorldFromPath()
                                   ▼
                         ┌─────────────────────┐
                         │  nameToPaddedFelt()  │
                         │  "monday-life" →     │
                         │  0x00...6d6f6e...    │
                         └─────────┬───────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼               ▼
          ┌─────────────┐  ┌────────────┐  ┌─────────────┐
          │  Factory    │  │  Factory   │  │  World's    │
          │  SQL:       │  │  SQL:      │  │  own Torii: │
          │  WorldCont- │  │  WorldDe-  │  │  /sql       │
          │  ract table │  │  ployed    │  │  (contracts │
          │             │  │  table     │  │   table)    │
          └──────┬──────┘  └─────┬──────┘  └──────┬──────┘
                 │               │                │
                 │ selector→     │ worldAddress   │ worldAddress
                 │ address map   │ rpcUrl         │ (confirmation)
                 │               │                │
                 └───────┬───────┘────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  WorldProfile {      │        ┌───────────────────────┐
              │    name, chain,      │        │  WorldConfig query    │
              │    worldAddress,     │◄───────│  from world's Torii   │
              │    contractsBySel,   │        │  → entryTokenAddress  │
              │    toriiBaseUrl,     │        │  → feeTokenAddress    │
              │    rpcUrl,           │        └───────────────────────┘
              │    entryTokenAddr,   │
              │    feeTokenAddr      │
              │  }                   │
              └──────────┬───────────┘
                         │
                         │ saveWorldProfile() → localStorage
                         │
                         ▼
              ┌──────────────────────┐
              │  patchManifestWith-  │
              │  Factory()           │
              │                      │
              │  base manifest +     │
              │  worldAddress +      │
              │  contractsBySelector │
              │  → patched manifest  │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  buildPolicies(      │
              │    patchedManifest)  │
              │                      │
              │  For each system:    │
              │    getContractByName │
              │    → patched address │
              │    → allowed methods │
              │                      │
              │  + token policies    │
              │  + message signing   │
              │  → toSessionPolicies │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  new Controller-     │
              │  Connector({         │
              │    policies,         │
              │    slot, namespace,  │
              │    chains, chainId   │
              │  })                  │
              └──────────────────────┘
```

---

## 2. File Map

Every file involved in the pipeline, grouped by responsibility.

### Bootstrap & Entry Point

| File                     | Purpose                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/init/bootstrap.tsx` | Main orchestrator. Calls `buildWorldProfile()`, `patchManifestWithFactory()`, updates `dojoConfig`, dispatches `dojo-config-updated` event, calls `setup()`.                     |
| `dojo-config.ts`         | Creates initial `dojoConfig`. On load, checks localStorage for a cached world profile and patches the manifest early so the controller has addresses before bootstrap completes. |

### World Profile Resolution

| File                                     | Purpose                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/runtime/world/profile-builder.ts`   | `buildWorldProfile(chain, name)` — fetches from factory + Torii, assembles `WorldProfile`, saves to localStorage.         |
| `src/runtime/world/factory-resolver.ts`  | `resolveWorldContracts()` and `resolveWorldDeploymentFromFactory()` — executes factory SQL queries, normalizes selectors. |
| `src/runtime/world/factory-endpoints.ts` | Re-exports `getFactorySqlBaseUrl()` from `common/factory/endpoints.ts`.                                                   |
| `common/factory/endpoints.ts`            | `getFactorySqlBaseUrl(chain)` — maps chain to factory Torii SQL URL.                                                      |
| `src/runtime/world/normalize.ts`         | `normalizeHex()`, `normalizeSelector()`, `nameToPaddedFelt()`, `normalizeRpcUrl()`, `isRpcUrlCompatibleForChain()`.       |
| `src/runtime/world/types.ts`             | `WorldProfile` and `WorldProfilesMap` TypeScript interfaces.                                                              |
| `src/runtime/world/store.ts`             | localStorage CRUD for world profiles. Keys: `ACTIVE_WORLD_NAME`, `ACTIVE_WORLD_CHAIN`, `WORLD_PROFILES`.                  |

### Shared Torii Utilities

| File                                        | Purpose                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/torii/src/queries/sql/factory.ts` | `FACTORY_QUERIES` — the raw SQL strings for `[wf-WorldContract]` and `[wf-WorldDeployed]`. |
| `packages/torii/src/queries/sql/api.ts`     | `SqlApi` class. `fetchWorldAddress()` queries `contracts WHERE contract_type = 'WORLD'`.   |
| `packages/torii/src/utils/sql.ts`           | `buildApiUrl()`, `fetchWithErrorHandling()`, `formatAddressForQuery()`, `encodeQuery()`.   |

### Manifest & Patching

| File                                    | Purpose                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/runtime/world/manifest-patcher.ts` | `patchManifestWithFactory(baseManifest, worldAddress, contractsBySelector)` — deep clones, patches `world.address` and all `contracts[].address`. |
| `contracts/game/manifest_slot.json`     | Static base manifest for slot chain.                                                                                                              |
| `contracts/game/manifest_sepolia.json`  | Static base manifest for sepolia.                                                                                                                 |
| `contracts/game/manifest_mainnet.json`  | Static base manifest for mainnet.                                                                                                                 |
| `contracts/utils/utils.ts`              | `getGameManifest(chain)` — returns the correct static manifest for a chain.                                                                       |

### Policy Construction

| File                                  | Purpose                                                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/context/policies.ts`       | `buildPolicies(manifest)` — builds the contract→methods policy map from the patched manifest. Calls `getContractByName()` to resolve addresses. Calls `getTokenPolicies()` for dynamic token addresses. Wraps everything in `toSessionPolicies()`. |
| `src/hooks/context/signing-policy.ts` | `messages` — the typed data signing policy for `s1_eternum-Message`.                                                                                                                                                                               |
| `src/utils/addresses.ts`              | `getSeasonPassAddress()`, `getVillagePassAddress()` — used in policy for NFT approval entrypoints.                                                                                                                                                 |

### Controller Initialization

| File                                      | Purpose                                                                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/context/starknet-provider.tsx` | `StarknetProvider` component. Creates `ControllerConnector` with `buildPolicies(dojoConfig.manifest)`. Listens for `dojo-config-updated` to rebuild controller on world switch. |

---

## 3. Data Types

### WorldProfile (`src/runtime/world/types.ts`)

```typescript
interface WorldProfile {
  name: string; // Human-readable, e.g. "wednesday-war-prep"
  chain: "sepolia" | "mainnet" | "slot" | "slottest" | "local";
  toriiBaseUrl: string; // e.g. "https://api.cartridge.gg/x/wednesday-war-prep/torii"
  rpcUrl?: string; // Resolved from factory deployment or env
  worldAddress: string; // Hex address of the world contract
  contractsBySelector: Record<string, string>; // Normalized selector → deployed address
  entryTokenAddress?: string; // From WorldConfig Torii query
  feeTokenAddress?: string; // From WorldConfig Torii query
  fetchedAt: number; // Date.now() when profile was built
}
```

### FactoryContractRow (`src/runtime/world/types.ts`)

```typescript
interface FactoryContractRow {
  contract_address: string; // Deployed address
  contract_selector: string; // Hex selector (may need normalization)
  name?: string; // World name felt (from factory table)
}
```

### Manifest Structure (simplified)

```typescript
{
  world: {
    address: string;           // ← PATCHED with worldAddress
    class_hash: string;
    abi: [...];
  },
  contracts: [
    {
      selector: string;        // Felt256 hex — used as lookup key
      address: string;         // ← PATCHED with factory address
      tag: string;             // e.g. "s1_eternum-bank_systems"
      class_hash: string;
      abi: [...];
      systems: string[];
    },
    // ... 33 contracts total
  ],
  models: [...],
  events: [...]
}
```

---

## 4. Phase 1 — Name Encoding

**File:** `src/runtime/world/normalize.ts`

The world name (ASCII string from the URL path) must be converted to a felt-hex value left-padded to 64 hex characters
(32 bytes) for factory SQL queries.

```typescript
export const nameToPaddedFelt = (name: string) => {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  const padded = leftPadHex(hex, 64);
  return `0x${padded}`;
};
```

**Example:**

```
"wednesday-war-prep"
→ ASCII hex: 7765646e65736461792d7761722d70726570
→ Padded:    0x00000000000000000000000000007765646e65736461792d7761722d70726570
```

---

## 5. Phase 2 — Factory SQL Queries

### Factory Endpoint Resolution

**File:** `common/factory/endpoints.ts`

```typescript
function getFactorySqlBaseUrl(chain: Chain): string {
  const base = "https://api.cartridge.gg";
  switch (chain) {
    case "mainnet":
      return `${base}/x/eternum-factory-mainnet/torii/sql`;
    case "sepolia":
      return `${base}/x/eternum-factory-sepolia/torii/sql`;
    case "slot":
    case "slottest":
    case "local":
      return `${base}/x/eternum-factory-slot-a/torii/sql`;
  }
}
```

### Query 1: World Contracts (`resolveWorldContracts`)

**File:** `src/runtime/world/factory-resolver.ts` (lines 16-33)

Uses `FACTORY_QUERIES.WORLD_CONTRACTS_BY_PADDED_NAME` from `packages/torii/src/queries/sql/factory.ts`:

```sql
SELECT contract_address, contract_selector, name
FROM [wf-WorldContract]
WHERE name = "0x00000000000000000000000000007765646e65736461792d7761722d70726570"
LIMIT 1000;
```

**Returns:** Array of `{ contract_address, contract_selector }` rows.

The code normalizes each selector to `0x` + 64-char lowercase hex and builds a `Record<string, string>` map of
`normalizedSelector → contractAddress`.

### Query 2: World Deployment (`resolveWorldDeploymentFromFactory`)

**File:** `src/runtime/world/factory-resolver.ts` (lines 123-144)

Uses `FACTORY_QUERIES.WORLD_DEPLOYED_BY_PADDED_NAME`:

```sql
SELECT * FROM [wf-WorldDeployed]
WHERE name = "0x00000000000000000000000000007765646e65736461792d7761722d70726570"
LIMIT 1;
```

**Returns:** A single row with `address` (world contract address) and optionally `rpc_url`/`rpcUrl`/`node_url` fields.

The resolver has extensive fallback logic to extract addresses from multiple possible field names (including nested
`data` JSON objects), making it resilient to schema changes.

---

## 6. Phase 3 — World Torii Queries

After resolving factory data, the code queries the **world's own Torii** (not the factory) for confirmation and
additional configuration.

### Torii Base URL

Constructed from the world name:

```
https://api.cartridge.gg/x/{worldName}/torii
```

### Query 3: World Address Confirmation

**File:** `packages/torii/src/queries/sql/api.ts` (lines 604-614)

```sql
SELECT contract_address FROM contracts WHERE contract_type = 'WORLD';
```

This queries the world's own Torii `contracts` table. If successful, the result confirms (or overrides) the factory's
world address. If the Torii is unavailable, the factory address is used as fallback.

### Query 4: WorldConfig (Token Addresses)

**File:** `src/runtime/world/profile-builder.ts` (lines 53-66)

```sql
SELECT "blitz_registration_config.entry_token_address" AS entry_token_address,
       "blitz_registration_config.fee_token" AS fee_token
FROM "s1_eternum-WorldConfig"
LIMIT 1;
```

This fetches the entry token (used for `token_lock` policy) and fee token (used for `approve` policy) from the world's
configuration. If unavailable, falls back to environment variable defaults.

---

## 7. Phase 4 — Profile Assembly

**File:** `src/runtime/world/profile-builder.ts`

```typescript
export const buildWorldProfile = async (chain: Chain, name: string): Promise<WorldProfile> => {
  // 1) Factory queries
  const contractsBySelector = await resolveWorldContracts(factorySqlBaseUrl, name);
  const deployment = await resolveWorldDeploymentFromFactory(factorySqlBaseUrl, name);

  // 2) Torii world address (with factory fallback)
  let worldAddress = await sqlApi.fetchWorldAddress(); // try Torii
  if (!worldAddress) worldAddress = deployment?.worldAddress; // fallback to factory
  if (!worldAddress) worldAddress = "0x0"; // last resort

  // 3) Token addresses from WorldConfig (optional)
  // ... fetched via direct SQL query to world's Torii

  // 4) RPC URL resolution (chain-specific defaults)
  const rpcUrl = normalizeRpcUrl(deployment?.rpcUrl ?? fallbackRpcUrl);

  // 5) Assemble and persist
  const profile: WorldProfile = {
    name,
    chain,
    toriiBaseUrl,
    rpcUrl,
    worldAddress,
    contractsBySelector,
    entryTokenAddress,
    feeTokenAddress,
    fetchedAt: Date.now(),
  };
  saveWorldProfile(profile);
  return profile;
};
```

### RPC URL Resolution Priority

| Chain           | Priority 1       | Priority 2                             | Priority 3                                       |
| --------------- | ---------------- | -------------------------------------- | ------------------------------------------------ |
| slot/slottest   | Factory `rpcUrl` | `VITE_PUBLIC_NODE_URL` (if compatible) | `api.cartridge.gg/x/eternum-blitz-slot-3/katana` |
| mainnet/sepolia | Factory `rpcUrl` | `VITE_PUBLIC_NODE_URL` (if compatible) | `api.cartridge.gg/x/starknet/{chain}`            |
| local           | Factory `rpcUrl` | `VITE_PUBLIC_NODE_URL`                 | `VITE_PUBLIC_NODE_URL`                           |

All Cartridge URLs are normalized with `/rpc/v0_9` suffix via `normalizeRpcUrl()`.

### localStorage Persistence

Profiles are cached in localStorage under key `WORLD_PROFILES` as a JSON map keyed by world name. The active world name
is stored under `ACTIVE_WORLD_NAME`. This allows `dojo-config.ts` to patch the manifest on page load before bootstrap
runs.

---

## 8. Phase 5 — Manifest Patching

**File:** `src/runtime/world/manifest-patcher.ts`

```typescript
export const patchManifestWithFactory = (
  baseManifest: AnyManifest,
  worldAddress: string,
  contractsBySelector: Record<string, string>,
): AnyManifest => {
  const manifest = JSON.parse(JSON.stringify(baseManifest)); // deep clone

  // Patch world address
  manifest.world.address = worldAddress;

  // Patch each contract address by selector lookup
  manifest.contracts = manifest.contracts.map((c: any) => {
    const key = normalizeSelector(c.selector);
    const addr = contractsBySelector[key];
    if (addr) return { ...c, address: addr };
    return c;
  });

  return manifest;
};
```

### What Gets Patched

1. **`manifest.world.address`** — the world contract address (e.g., `0x7570fb...` → `0x021e9e...`)
2. **`manifest.contracts[i].address`** — each system contract's deployed address, matched by normalizing the manifest's
   `selector` field against the factory's `contractsBySelector` map

### Where Patching Happens

1. **`dojo-config.ts`** (line 23-25) — early patching from cached localStorage profile on page load
2. **`bootstrap.tsx`** (lines 150-156) — authoritative patching with freshly fetched profile data during bootstrap
3. **`src/ui/features/admin/pages/factory.tsx`** — admin panel patching for per-world configuration

### Example

Before (static manifest):

```json
{
  "world": { "address": "0x7570fb2557b518f3bfff6bbea6af0adf031f65662f57fdd032a60599e0a3fd" },
  "contracts": [
    {
      "selector": "0x03b4cc14cbb49692c85e1b132ac8536fe7d0d1361cd2fb5ba8df29f726ca02d2",
      "address": "0x62c7cef2c8733452eb79d7061d9cbec39ca76f594f9df1692f219e7b665da59",
      "tag": "s1_eternum-blitz_realm_systems"
    }
  ]
}
```

After (patched for `wednesday-war-prep`):

```json
{
  "world": { "address": "0x021e9e1216aa603434b8126c0baedefd01ccb54f5aeb3a3a77e7181a0b030f5c" },
  "contracts": [
    {
      "selector": "0x03b4cc14cbb49692c85e1b132ac8536fe7d0d1361cd2fb5ba8df29f726ca02d2",
      "address": "0x0585c04cf0240f8a91...",
      "tag": "s1_eternum-blitz_realm_systems"
    }
  ]
}
```

---

## 9. Phase 6 — Policy Construction

**File:** `src/hooks/context/policies.ts`

`buildPolicies(manifest)` constructs the Cartridge session policy from the **patched** manifest. It uses
`getContractByName(manifest, "s1_eternum", "<system_name>")` from `@dojoengine/core` to look up each contract by its tag
and extract the **patched** address.

### Structure

```typescript
buildPolicies(manifest) → toSessionPolicies({
  contracts: {
    [entryTokenAddress]:        { methods: [{ entrypoint: "token_lock" }] },
    [feeTokenAddress]:          { methods: [{ entrypoint: "approve" }] },
    [blitz_realm_systems.addr]: { methods: [...6 methods] },
    [bank_systems.addr]:        { methods: [...3 methods] },
    [config_systems.addr]:      { methods: [...25 methods] },
    // ... 20+ more system contracts
    [VRF_PROVIDER_ADDRESS]:     { methods: [{ entrypoint: "request_random" }] },
    [seasonPassAddress]:        { methods: [{ entrypoint: "set_approval_for_all" }] },
    [villagePassAddress]:       { methods: [{ entrypoint: "set_approval_for_all" }] },
  },
  messages: [{ /* Eternum Message Signing typed data */ }]
})
```

### Token Policies (Dynamic)

**File:** `src/hooks/context/policies.ts` (lines 9-46)

Token policies are read from `getActiveWorld()` at **call time**, not module load time. This ensures that when the
active world changes, the token addresses in the policy update accordingly.

```typescript
const getTokenPolicies = () => {
  const activeWorld = getActiveWorld();
  const entryTokenAddress = activeWorld?.entryTokenAddress || env.VITE_PUBLIC_ENTRY_TOKEN_ADDRESS;
  const feeTokenAddress = activeWorld?.feeTokenAddress || env.VITE_PUBLIC_FEE_TOKEN_ADDRESS;
  // ... build policy objects
};
```

### Message Signing Policy

**File:** `src/hooks/context/signing-policy.ts`

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

---

## 10. Phase 7 — Controller Initialization

**File:** `src/hooks/context/starknet-provider.tsx` (lines 128-155)

```typescript
const resolveRuntimeStarknetConfig = (): RuntimeStarknetConfig => {
  const rpcUrl = normalizeRpcUrl(baseRpcUrl);
  const resolvedChain = deriveChainFromRpcUrl(rpcUrl) ?? resolveFallbackChain();
  const resolvedChainId = resolvedChain.chainId;

  const controller = new ControllerConnector({
    errorDisplayMode: "notification",
    propagateSessionErrors: true,
    chains: [{ rpcUrl }],
    defaultChainId: resolvedChainId,
    policies: buildPolicies(dojoConfig.manifest), // ← PATCHED manifest
    slot: env.VITE_PUBLIC_SLOT,
    namespace: "s1_eternum",
  });

  return { rpcUrl, resolvedChain, resolvedChainId, controller };
};
```

The `policies` parameter contains the complete allowlist of contracts and entrypoints. The Cartridge controller enforces
these at signing time — only transactions targeting an address+entrypoint listed in the policy can be signed.

### Chain ID Resolution

The chain ID for the controller is derived from the RPC URL when possible:

| RPC URL pattern     | Chain ID                                     |
| ------------------- | -------------------------------------------- |
| `/starknet/mainnet` | `SN_MAIN`                                    |
| `/starknet/sepolia` | `SN_SEPOLIA`                                 |
| `/x/{slug}/katana`  | `shortString.encodeShortString("WP_{SLUG}")` |

If derivation fails, falls back to the active world's chain from the profile.

---

## 11. Phase 8 — World Switching & Dynamic Updates

**File:** `src/hooks/context/starknet-provider.tsx` (lines 160-167)

```typescript
useEffect(() => {
  const onDojoConfigUpdated = () => {
    setRuntimeConfig(resolveRuntimeStarknetConfig());
  };
  window.addEventListener("dojo-config-updated", onDojoConfigUpdated);
  return () => window.removeEventListener("dojo-config-updated", onDojoConfigUpdated);
}, []);
```

**File:** `src/init/bootstrap.tsx` (lines 169-176)

```typescript
window.dispatchEvent(
  new CustomEvent("dojo-config-updated", {
    detail: { rpcUrl: dojoConfig.rpcUrl, toriiUrl: dojoConfig.toriiUrl },
  }),
);
```

When a user switches worlds:

1. `bootstrap.tsx` detects world name changed → calls `resetBootstrap()` (clears RECS world, subscriptions, stores)
2. `buildWorldProfile()` fetches new factory data for the new world
3. `patchManifestWithFactory()` patches manifest with new addresses
4. `dojoConfig.manifest` is updated in place
5. `dojo-config-updated` event is dispatched
6. `StarknetProvider` listener fires → calls `resolveRuntimeStarknetConfig()` → creates new `ControllerConnector` with
   fresh `buildPolicies(dojoConfig.manifest)`
7. New controller has policies with the new world's contract addresses

If the **chain** changes (not just the world), a full page reload is triggered instead.

---

## 12. Fallback Behavior

| Data point          | Primary source                    | Fallback 1                                | Fallback 2                       |
| ------------------- | --------------------------------- | ----------------------------------------- | -------------------------------- |
| World address       | World's Torii (`contracts` table) | Factory `[wf-WorldDeployed].address`      | `"0x0"`                          |
| Contract addresses  | Factory `[wf-WorldContract]`      | Static manifest (unpatched)               | —                                |
| Entry token address | World's Torii (`WorldConfig`)     | `VITE_PUBLIC_ENTRY_TOKEN_ADDRESS` env var | —                                |
| Fee token address   | World's Torii (`WorldConfig`)     | `VITE_PUBLIC_FEE_TOKEN_ADDRESS` env var   | —                                |
| RPC URL             | Factory deployment `rpcUrl` field | `VITE_PUBLIC_NODE_URL` env var            | Chain-specific Cartridge default |
| Torii URL           | Constructed from world name       | `VITE_PUBLIC_TORII` env var               | —                                |

---

## 13. Reproducing the Pipeline with curl

Here is the complete pipeline reproduced manually with `curl` for the world `wednesday-war-prep` on the `slot` chain.

### Step 1: Encode World Name to Padded Felt

```bash
python3 -c "
name = 'wednesday-war-prep'
hex_str = name.encode('ascii').hex()
padded = hex_str.zfill(64)
print(f'0x{padded}')
"
# Output: 0x00000000000000000000000000007765646e65736461792d7761722d70726570
```

### Step 2: Query Factory for Contract Selectors

```bash
PADDED="0x00000000000000000000000000007765646e65736461792d7761722d70726570"

curl -s "https://api.cartridge.gg/x/eternum-factory-slot-a/torii/sql?query=$(
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" \
  "SELECT contract_address, contract_selector FROM [wf-WorldContract] WHERE name = \"${PADDED}\" LIMIT 1000;"
)" | python3 -m json.tool
```

**Expected output:** Array of 33 objects with `contract_address` and `contract_selector`.

### Step 3: Query Factory for World Deployment

```bash
curl -s "https://api.cartridge.gg/x/eternum-factory-slot-a/torii/sql?query=$(
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" \
  "SELECT * FROM [wf-WorldDeployed] WHERE name = \"${PADDED}\" LIMIT 1;"
)" | python3 -m json.tool
```

**Expected output:** Single-element array with `address` (world address), `block_number`, `tx_hash`, etc.

Example result:

```json
[
  {
    "address": "0x021e9e1216aa603434b8126c0baedefd01ccb54f5aeb3a3a77e7181a0b030f5c",
    "name": "0x00000000000000000000000000007765646e65736461792d7761722d70726570",
    "internal_created_at": "2026-02-11 09:41:28"
  }
]
```

### Step 4: Query World's Torii for World Address

```bash
curl -s "https://api.cartridge.gg/x/wednesday-war-prep/torii/sql?query=$(
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" \
  "SELECT contract_address FROM contracts WHERE contract_type = 'WORLD';"
)" | python3 -m json.tool
```

**Expected output (if Torii is live):**

```json
[{ "contract_address": "0x021e9e1216aa603434b8126c0baedefd01ccb54f5aeb3a3a77e7181a0b030f5c" }]
```

**If Torii is down:** Returns JSON-RPC error → code falls back to factory address.

### Step 5: Query World's Torii for Token Addresses

```bash
curl -s "https://api.cartridge.gg/x/wednesday-war-prep/torii/sql?query=$(
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" \
  'SELECT "blitz_registration_config.entry_token_address" AS entry_token_address, "blitz_registration_config.fee_token" AS fee_token FROM "s1_eternum-WorldConfig" LIMIT 1;'
)" | python3 -m json.tool
```

**Expected output (if Torii is live):**

```json
[
  {
    "entry_token_address": "0x04627cf29889112600f5b6803e80bef132af8d77e65e3c47f174223cb1409b31",
    "fee_token": "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
  }
]
```

### Step 6: Simulate Manifest Patching

```bash
# Save factory contracts to file first
PADDED="0x00000000000000000000000000007765646e65736461792d7761722d70726570"
curl -s "https://api.cartridge.gg/x/eternum-factory-slot-a/torii/sql?query=$(
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" \
  "SELECT contract_address, contract_selector FROM [wf-WorldContract] WHERE name = \"${PADDED}\" LIMIT 1000;"
)" > /tmp/factory_contracts.json

# Patch the manifest
python3 -c "
import json

with open('contracts/game/manifest_slot.json') as f:
    base = json.load(f)

with open('/tmp/factory_contracts.json') as f:
    factory_rows = json.load(f)

def normalize(v):
    return '0x' + v.replace('0x','').lower().zfill(64)

factory_map = {normalize(r['contract_selector']): r['contract_address'] for r in factory_rows}
world_addr = '0x021e9e1216aa603434b8126c0baedefd01ccb54f5aeb3a3a77e7181a0b030f5c'

manifest = json.loads(json.dumps(base))
manifest['world']['address'] = world_addr

patched = 0
for c in manifest['contracts']:
    key = normalize(c.get('selector',''))
    if key in factory_map:
        c['address'] = factory_map[key]
        patched += 1

print(f'Patched {patched}/{len(manifest[\"contracts\"])} contracts')
print(f'World address set to: {world_addr}')

with open('/tmp/patched_manifest.json', 'w') as f:
    json.dump(manifest, f, indent=2)
print('Saved to /tmp/patched_manifest.json')
"
```

### Step 7: Inspect Final Policy (what the controller receives)

```bash
python3 -c "
import json

with open('/tmp/patched_manifest.json') as f:
    manifest = json.load(f)

def find_contract(tag_suffix):
    tag = f's1_eternum-{tag_suffix}'
    for c in manifest['contracts']:
        if c.get('tag') == tag:
            return c['address']
    return '???'

# This is the structure that buildPolicies() produces
systems = [
    ('blitz_realm_systems',         ['register','create','make_hyperstructures','obtain_entry_token','assign_realm_positions','settle_realms']),
    ('bank_systems',                ['create_banks']),
    ('config_systems',              ['set_agent_config','set_world_config','set_season_config','set_troop_config','...(25 total)']),
    ('guild_systems',               ['create_guild','join_guild','leave_guild','whitelist_player','transfer_guild_ownership','remove_guild_member']),
    ('hyperstructure_systems',      ['initialize','contribute','claim_share_points','allocate_shares']),
    ('liquidity_systems',           ['add','remove']),
    ('name_systems',                ['set_address_name']),
    ('ownership_systems',           ['transfer_structure_ownership','transfer_agent_ownership']),
    ('production_systems',          ['create_building','destroy_building','pause_building_production','resume_building_production']),
    ('realm_systems',               ['create']),
    ('resource_systems',            ['approve','send','pickup','arrivals_offload','structure_burn','troop_burn']),
    ('relic_systems',               ['open_chest','apply_relic']),
    ('season_systems',              ['register_to_leaderboard','claim_leaderboard_rewards']),
    ('structure_systems',           ['level_up']),
    ('swap_systems',                ['buy','sell']),
    ('trade_systems',               ['create_order','accept_order','cancel_order']),
    ('troop_battle_systems',        ['attack_explorer_vs_explorer','attack_explorer_vs_guard','attack_guard_vs_explorer']),
    ('troop_management_systems',    ['guard_add','guard_delete','explorer_create','explorer_add','explorer_delete']),
    ('troop_movement_systems',      ['explorer_move','explorer_extract_reward']),
    ('troop_raid_systems',          ['raid_explorer_vs_guard']),
    ('village_systems',             ['upgrade','create']),
]

print('=== FINAL CARTRIDGE CONTROLLER POLICY ===')
print()
print('TOKEN POLICIES:')
print('  entry_token → [token_lock]')
print('  fee_token   → [approve]')
print()
print('GAME SYSTEM POLICIES:')
for name, methods in systems:
    addr = find_contract(name)
    print(f'  {name:40s} {addr[:24]}...  →  {methods[:3]}...')
print()
print('SPECIAL:')
print('  VRF Provider     → [request_random]')
print('  Season Pass NFT  → [set_approval_for_all]')
print('  Village Pass NFT → [set_approval_for_all]')
print()
print('MESSAGE SIGNING:')
print('  primaryType: s1_eternum-Message')
print('  domain: { name: Eternum, version: 1, chainId: SN_SEPOLIA }')
"
```

### Discovering Available Worlds

To list all deployed worlds on a chain:

```bash
# List recent worlds on slot
curl -s "https://api.cartridge.gg/x/eternum-factory-slot-a/torii/sql?query=$(
  python3 -c "import urllib.parse; print(urllib.parse.quote(
    'SELECT name, address, internal_created_at FROM [wf-WorldDeployed] ORDER BY internal_created_at DESC LIMIT 20;'
  ))"
)" | python3 -c "
import json, sys
for row in json.load(sys.stdin):
    raw = row['name'].replace('0x','').lstrip('0')
    if len(raw) % 2: raw = '0' + raw
    try: name = bytes.fromhex(raw).decode('ascii')
    except: name = '???'
    print(f'{row[\"internal_created_at\"]}  {name:30s}  {row[\"address\"][:24]}...')
"
```

### Checking if a World's Torii is Live

```bash
WORLD_NAME="wednesday-war-prep"
curl -s --max-time 5 "https://api.cartridge.gg/x/${WORLD_NAME}/torii/sql?query=$(
  python3 -c "import urllib.parse; print(urllib.parse.quote(
    \"SELECT contract_address FROM contracts WHERE contract_type = 'WORLD';\"
  ))"
)" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list) and len(d) > 0:
        print(f'LIVE: {d[0][\"contract_address\"]}')
    else:
        print('DOWN or EMPTY')
except:
    print('DOWN or ERROR')
"
```

---

## 14. Appendix: Factory SQL Schema

### `[wf-WorldContract]` Table

| Column                | Type       | Description                              |
| --------------------- | ---------- | ---------------------------------------- |
| `name`                | hex string | World name as padded felt (64 hex chars) |
| `contract_address`    | hex string | Deployed contract address                |
| `contract_selector`   | hex string | Contract selector (felt256)              |
| `internal_created_at` | timestamp  | When the record was indexed              |
| `block_number`        | hex string | Block in which the contract was deployed |
| `tx_hash`             | hex string | Deployment transaction hash              |

### `[wf-WorldDeployed]` Table

| Column                | Type              | Description                         |
| --------------------- | ----------------- | ----------------------------------- |
| `name`                | hex string        | World name as padded felt           |
| `address`             | hex string        | World contract address              |
| `block_number`        | hex string        | Deployment block                    |
| `tx_hash`             | hex string        | Deployment transaction              |
| `internal_created_at` | timestamp         | Index timestamp                     |
| `rpc_url` / `rpcUrl`  | string (optional) | RPC URL if specified at deploy time |

### `contracts` Table (World's own Torii)

| Column             | Type       | Description                      |
| ------------------ | ---------- | -------------------------------- |
| `contract_address` | hex string | Contract address                 |
| `contract_type`    | string     | `"WORLD"` for the world contract |

### `s1_eternum-WorldConfig` Table (World's own Torii)

| Column                                          | Type       | Description          |
| ----------------------------------------------- | ---------- | -------------------- |
| `blitz_registration_config.entry_token_address` | hex string | Entry token contract |
| `blitz_registration_config.fee_token`           | hex string | Fee token contract   |

---

## 15. Appendix: Full Policy Method List

Every entrypoint allowed by the Cartridge controller policy, grouped by system contract.

| System Contract                         | Allowed Entrypoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **blitz_realm_systems**                 | `register`, `create`, `make_hyperstructures`, `obtain_entry_token`, `assign_realm_positions`, `settle_realms`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **bank_systems**                        | `create_banks`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **config_systems**                      | `set_agent_config`, `set_world_config`, `set_mercenaries_name_config`, `set_season_config`, `set_vrf_config`, `set_starting_resources_config`, `set_map_config`, `set_capacity_config`, `set_resource_weight_config`, `set_tick_config`, `set_resource_factory_config`, `set_donkey_speed_config`, `set_battle_config`, `set_hyperstructure_config`, `set_bank_config`, `set_troop_config`, `set_building_config`, `set_building_category_config`, `set_resource_bridge_config`, `set_resource_bridge_fee_split_config`, `set_resource_bridge_whitelist_config`, `set_structure_max_level_config`, `set_structure_level_config`, `set_settlement_config`, `set_trade_config`, `dojo_name`, `world_dispatcher` |
| **dev_resource_systems**                | `mint`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **guild_systems**                       | `create_guild`, `join_guild`, `leave_guild`, `whitelist_player`, `transfer_guild_ownership`, `remove_guild_member`, `remove_player_from_whitelist`, `dojo_name`, `world_dispatcher`, `update_whitelist`, `remove_member`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **hyperstructure_systems**              | `initialize`, `contribute`, `claim_share_points`, `allocate_shares`, `update_construction_access`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **liquidity_systems**                   | `add`, `remove`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **name_systems**                        | `set_address_name`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **ownership_systems**                   | `transfer_structure_ownership`, `transfer_agent_ownership`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **production_systems**                  | `create_building`, `destroy_building`, `pause_building_production`, `resume_building_production`, `burn_resource_for_labor_production`, `burn_labor_for_resource_production`, `burn_resource_for_resource_production`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **realm_systems**                       | `create`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **resource_systems** (deposit/withdraw) | `deposit`, `withdraw`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **resource_systems** (transfers/burns)  | `approve`, `send`, `pickup`, `arrivals_offload`, `troop_troop_adjacent_transfer`, `troop_structure_adjacent_transfer`, `structure_troop_adjacent_transfer`, `dojo_name`, `world_dispatcher`, `structure_burn`, `troop_burn`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **relic_systems**                       | `open_chest`, `apply_relic`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **season_systems**                      | `register_to_leaderboard`, `claim_leaderboard_rewards`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **structure_systems**                   | `level_up`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **swap_systems**                        | `buy`, `sell`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **trade_systems**                       | `create_order`, `accept_order`, `cancel_order`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **troop_battle_systems**                | `attack_explorer_vs_explorer`, `attack_explorer_vs_guard`, `attack_guard_vs_explorer`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **troop_management_systems**            | `guard_add`, `guard_delete`, `explorer_create`, `explorer_add`, `explorer_delete`, `explorer_explorer_swap`, `explorer_guard_swap`, `guard_explorer_swap`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **troop_movement_systems**              | `explorer_move`, `explorer_extract_reward`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **troop_movement_util_systems**         | `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **troop_raid_systems**                  | `raid_explorer_vs_guard`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **village_systems**                     | `upgrade`, `create`, `dojo_name`, `world_dispatcher`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Special Contracts

| Contract         | Entrypoint             | Source                                                                              |
| ---------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| Entry Token      | `token_lock`           | Address from `WorldConfig.entry_token_address` or `VITE_PUBLIC_ENTRY_TOKEN_ADDRESS` |
| Fee Token        | `approve`              | Address from `WorldConfig.fee_token` or `VITE_PUBLIC_FEE_TOKEN_ADDRESS`             |
| VRF Provider     | `request_random`       | Hardcoded: `0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f`     |
| Season Pass NFT  | `set_approval_for_all` | From `getSeasonPassAddress()` (chain-dependent)                                     |
| Village Pass NFT | `set_approval_for_all` | From `getVillagePassAddress()` (chain-dependent)                                    |

### Message Signing

| Field          | Value                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Primary Type   | `s1_eternum-Message`                                                                                         |
| Domain Name    | `Eternum`                                                                                                    |
| Domain Version | `1`                                                                                                          |
| Chain ID       | `SN_MAIN` (mainnet) or `SN_SEPOLIA` (all others)                                                             |
| Message Fields | `identity` (ContractAddress), `channel` (shortstring), `content` (string), `timestamp` (felt), `salt` (felt) |
