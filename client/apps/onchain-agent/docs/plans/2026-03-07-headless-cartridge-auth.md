# Headless Cartridge Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up `@cartridge/controller/session/node` so the agent can authenticate via Cartridge Controller and execute on-chain transactions with the same session policies as the game client.

**Architecture:** Two new files in `src/auth/`. `policies.ts` reads the Dojo manifest JSON and season addresses JSON for the configured chain, then builds the exact same `SessionPolicies` the game client uses. `session.ts` wraps `SessionProvider` to provide a single `getAccount()` function that returns a ready-to-use `WalletAccount`. First run opens a browser for one-time auth; subsequent runs reconnect from disk.

**Tech Stack:** `@cartridge/controller/session/node` (SessionProvider, NodeBackend), `@cartridge/controller` (toSessionPolicies), starknet.js (WalletAccount), Dojo manifest JSONs from `contracts/game/`.

---

## Task 1: Create `src/auth/policies.ts`

**Files:**
- Create: `src/auth/policies.ts`
- Reference: `client/apps/game/src/hooks/context/policies.ts` (game client's version)
- Reference: `contracts/utils/utils.ts` (getGameManifest, getSeasonAddresses)
- Reference: `contracts/game/manifest_mainnet.json` (manifest structure)
- Reference: `contracts/common/addresses/mainnet.json` (season addresses structure)

**Step 1: Write the file**

This mirrors the game client's `policies.ts` but for Node.js. It reads manifest JSON and season addresses to build policies. The contract addresses are resolved by searching the manifest's `contracts` array for entries whose `tag` matches `{namespace}-{name}`.

```typescript
import type { SessionPolicies } from "@cartridge/controller";

// ── Manifest types (subset of what we need) ──

interface ManifestContract {
  tag: string;
  address: string;
  selector: string;
}

interface Manifest {
  world: { address: string };
  contracts: ManifestContract[];
}

interface SeasonAddresses {
  seasonPass: string;
  villagePass: string;
  [key: string]: unknown;
}

// ── Chain config ──

export type Chain = "sepolia" | "mainnet" | "slot" | "slottest" | "local";

function loadManifest(chain: Chain): Manifest {
  // Dynamic import would be async; use require-style for JSON.
  // These paths are relative to the monorepo root where the JSON lives.
  // We use createRequire to load JSON from outside the package.
  const { createRequire } = await import("node:module");
  // Can't use top-level await in a sync function, so we make this async below.
  throw new Error("Use loadManifestAsync");
}

// Actually — since this is ESM and JSON imports need assertions, we'll use
// fs.readFileSync which is fine for startup-time config loading.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Walk up from src/auth/ to the monorepo root (6 levels). */
function monorepoRoot(): string {
  // src/auth/policies.ts → client/apps/onchain-agent/src/auth/
  // monorepo root is 5 dirs up: auth → src → onchain-agent → apps → client → root
  return resolve(__dirname, "..", "..", "..", "..", "..");
}

function loadManifestJson(chain: Chain): Manifest {
  const file = resolve(monorepoRoot(), "contracts", "game", `manifest_${chain}.json`);
  return JSON.parse(readFileSync(file, "utf-8"));
}

function loadSeasonAddresses(chain: Chain): SeasonAddresses {
  const file = resolve(monorepoRoot(), "contracts", "common", "addresses", `${chain}.json`);
  return JSON.parse(readFileSync(file, "utf-8"));
}

// ── Contract resolution ──

function getContractAddress(manifest: Manifest, namespace: string, name: string): string {
  const tag = `${namespace}-${name}`;
  const contract = manifest.contracts.find((c) => c.tag === tag);
  if (!contract) {
    throw new Error(`Contract "${tag}" not found in manifest`);
  }
  return contract.address;
}

function addr(manifest: Manifest, name: string): string {
  return getContractAddress(manifest, "s1_eternum", name);
}

// ── Method helper ──

type Method = { name: string; entrypoint: string; description?: string };

function m(entrypoint: string, name?: string, description?: string): Method {
  return { name: name ?? entrypoint, entrypoint, ...(description ? { description } : {}) };
}

/** Common dojo methods appended to every system contract. */
const DOJO_METHODS: Method[] = [m("dojo_name"), m("world_dispatcher")];

function methods(...entrypoints: string[]): Method[] {
  return [...entrypoints.map((e) => m(e)), ...DOJO_METHODS];
}

// ── VRF contract (fixed address across all chains) ──

const VRF_ADDRESS = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";

// ── Build policies ──

export function buildPolicies(chain: Chain): SessionPolicies {
  const manifest = loadManifestJson(chain);
  const season = loadSeasonAddresses(chain);

  const contracts: Record<string, { methods: Method[] }> = {
    // ── Blitz / Realm setup ──
    [addr(manifest, "blitz_realm_systems")]: {
      methods: methods(
        "make_hyperstructures", "register", "obtain_entry_token",
        "create", "assign_realm_positions", "settle_realms",
      ),
    },

    // ── Bank ──
    [addr(manifest, "bank_systems")]: {
      methods: methods("create_banks"),
    },

    // ── Config ──
    [addr(manifest, "config_systems")]: {
      methods: methods(
        "set_agent_config", "set_world_config", "set_mercenaries_name_config",
        "set_season_config", "set_vrf_config", "set_starting_resources_config",
        "set_map_config", "set_capacity_config", "set_resource_weight_config",
        "set_tick_config", "set_resource_factory_config", "set_donkey_speed_config",
        "set_battle_config", "set_hyperstructure_config", "set_bank_config",
        "set_troop_config", "set_building_config", "set_building_category_config",
        "set_resource_bridge_config", "set_resource_bridge_fee_split_config",
        "set_resource_bridge_whitelist_config", "set_structure_max_level_config",
        "set_structure_level_config", "set_settlement_config", "set_trade_config",
      ),
    },

    // ── Dev resources ──
    [addr(manifest, "dev_resource_systems")]: {
      methods: methods("mint"),
    },

    // ── Guild ──
    [addr(manifest, "guild_systems")]: {
      methods: methods(
        "create_guild", "join_guild", "leave_guild", "whitelist_player",
        "transfer_guild_ownership", "remove_guild_member",
        "remove_player_from_whitelist", "update_whitelist", "remove_member",
      ),
    },

    // ── Hyperstructure ──
    [addr(manifest, "hyperstructure_systems")]: {
      methods: methods(
        "initialize", "contribute", "claim_share_points",
        "allocate_shares", "update_construction_access",
      ),
    },

    // ── Liquidity ──
    [addr(manifest, "liquidity_systems")]: {
      methods: methods("add", "remove"),
    },

    // ── Name ──
    [addr(manifest, "name_systems")]: {
      methods: methods("set_address_name"),
    },

    // ── Ownership ──
    [addr(manifest, "ownership_systems")]: {
      methods: methods("transfer_structure_ownership", "transfer_agent_ownership"),
    },

    // ── Production ──
    [addr(manifest, "production_systems")]: {
      methods: methods(
        "create_building", "destroy_building",
        "pause_building_production", "resume_building_production",
        "burn_resource_for_labor_production", "burn_labor_for_resource_production",
        "burn_resource_for_resource_production",
      ),
    },

    // ── Realm ──
    [addr(manifest, "realm_systems")]: {
      methods: methods("create"),
    },

    // ── Resources ──
    [addr(manifest, "resource_systems")]: {
      methods: methods(
        "deposit", "withdraw", "approve", "send", "pickup",
        "arrivals_offload", "troop_troop_adjacent_transfer",
        "troop_structure_adjacent_transfer", "structure_troop_adjacent_transfer",
        "structure_burn", "troop_burn",
      ),
    },

    // ── Relic ──
    [addr(manifest, "relic_systems")]: {
      methods: methods("open_chest", "apply_relic"),
    },

    // ── Season ──
    [addr(manifest, "season_systems")]: {
      methods: methods("register_to_leaderboard", "claim_leaderboard_rewards"),
    },

    // ── Structure ──
    [addr(manifest, "structure_systems")]: {
      methods: methods("level_up"),
    },

    // ── Swap ──
    [addr(manifest, "swap_systems")]: {
      methods: methods("buy", "sell"),
    },

    // ── Trade ──
    [addr(manifest, "trade_systems")]: {
      methods: methods("create_order", "accept_order", "cancel_order"),
    },

    // ── Troop battle ──
    [addr(manifest, "troop_battle_systems")]: {
      methods: methods(
        "attack_explorer_vs_explorer", "attack_explorer_vs_guard",
        "attack_guard_vs_explorer",
      ),
    },

    // ── Troop management ──
    [addr(manifest, "troop_management_systems")]: {
      methods: methods(
        "guard_add", "guard_delete", "explorer_create", "explorer_add",
        "explorer_delete", "explorer_explorer_swap", "explorer_guard_swap",
        "guard_explorer_swap",
      ),
    },

    // ── Troop movement ──
    [addr(manifest, "troop_movement_systems")]: {
      methods: methods("explorer_move", "explorer_extract_reward"),
    },

    // ── Troop movement util ──
    [addr(manifest, "troop_movement_util_systems")]: {
      methods: [m("dojo_name"), m("world_dispatcher")],
    },

    // ── Troop raid ──
    [addr(manifest, "troop_raid_systems")]: {
      methods: methods("raid_explorer_vs_guard"),
    },

    // ── Village ──
    [addr(manifest, "village_systems")]: {
      methods: methods("upgrade", "create"),
    },

    // ── VRF ──
    [VRF_ADDRESS]: {
      methods: [m("request_random", "VRF", "Verifiable Random Function")],
    },

    // ── NFT passes ──
    [season.seasonPass]: {
      methods: [m("set_approval_for_all")],
    },
    [season.villagePass]: {
      methods: [m("set_approval_for_all")],
    },
  };

  return { contracts };
}
```

**Step 2: Verify it loads without error**

Run: `NODE_OPTIONS='--experimental-wasm-modules --disable-warning=ExperimentalWarning' npx tsx -e "import { buildPolicies } from './src/auth/policies.js'; const p = buildPolicies('mainnet'); console.log(Object.keys(p.contracts).length, 'contracts'); console.log('OK')"`

Expected: prints contract count and `OK`.

**Step 3: Commit**

```bash
git add src/auth/policies.ts
git commit -m "feat: add session policies mirroring game client"
```

---

## Task 2: Create `src/auth/session.ts`

**Files:**
- Create: `src/auth/session.ts`
- Reference: `node_modules/@cartridge/controller/dist/node/index.js` (SessionProvider source)

**Step 1: Write the file**

```typescript
import SessionProvider from "@cartridge/controller/session/node";
import type { WalletAccount } from "starknet";
import { buildPolicies, type Chain } from "./policies.js";

export interface SessionConfig {
  /** Chain name — determines manifest and RPC. */
  chain: Chain;
  /** Starknet RPC URL. */
  rpcUrl: string;
  /** Starknet chain ID (hex or name like "SN_MAIN"). */
  chainId: string;
  /** Directory for session persistence. Default: ".cartridge" */
  basePath?: string;
}

let provider: SessionProvider | null = null;

/**
 * Get or create the SessionProvider singleton.
 *
 * On first call, builds policies from the Dojo manifest for the given chain,
 * creates a SessionProvider, and returns it. Subsequent calls return the
 * same instance.
 */
export function getProvider(config: SessionConfig): SessionProvider {
  if (provider) return provider;

  const policies = buildPolicies(config.chain);

  provider = new SessionProvider({
    rpc: config.rpcUrl,
    chainId: config.chainId,
    policies,
    basePath: config.basePath ?? ".cartridge",
  });

  return provider;
}

/**
 * Connect and return an authenticated WalletAccount.
 *
 * First run: prints a URL to open in a browser for one-time session approval.
 * Subsequent runs: reconnects from saved session on disk.
 *
 * Throws if connection fails or session is expired and re-auth is not completed.
 */
export async function getAccount(config: SessionConfig): Promise<WalletAccount> {
  const p = getProvider(config);
  const account = await p.connect();
  if (!account) {
    throw new Error(
      "Cartridge session not established. Open the printed URL in a browser to authorize.",
    );
  }
  return account;
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/auth/session.ts` (or the project-level `pnpm build`)

Expected: no errors.

**Step 3: Commit**

```bash
git add src/auth/session.ts
git commit -m "feat: add headless Cartridge session provider"
```

---

## Task 3: Update `.env.example`

**Files:**
- Modify: `.env.example`

**Step 1: Add the required env vars**

```env
# Chain name: mainnet, sepolia, slot, slottest, local
CHAIN=mainnet

# Starknet RPC URL
RPC_URL=https://api.cartridge.gg/x/starknet/mainnet

# Starknet chain ID
CHAIN_ID=SN_MAIN
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "feat: add auth env vars to .env.example"
```

---

## Task 4: Integration smoke test

**Files:**
- Create: `test/auth/policies.test.ts`

**Step 1: Write a test that verifies policy building works for mainnet**

```typescript
import { describe, it, expect } from "vitest";
import { buildPolicies } from "../../src/auth/policies.js";

describe("buildPolicies", () => {
  it("builds mainnet policies with all expected system contracts", () => {
    const policies = buildPolicies("mainnet");

    // Should have contracts
    const addresses = Object.keys(policies.contracts ?? {});
    expect(addresses.length).toBeGreaterThan(20);

    // VRF contract should be present
    const vrf = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";
    expect(policies.contracts?.[vrf]).toBeDefined();
    expect(policies.contracts?.[vrf]?.methods).toContainEqual(
      expect.objectContaining({ entrypoint: "request_random" }),
    );

    // Troop battle should have the 3 attack methods + dojo methods
    const battleAddr = addresses.find((a) => {
      const methods = policies.contracts?.[a]?.methods ?? [];
      return methods.some((m: any) => m.entrypoint === "attack_explorer_vs_explorer");
    });
    expect(battleAddr).toBeDefined();
  });

  it("includes season pass and village pass", () => {
    const policies = buildPolicies("mainnet");
    const addresses = Object.keys(policies.contracts ?? {});

    // Look for set_approval_for_all methods (season pass + village pass)
    const approvalContracts = addresses.filter((a) => {
      const methods = policies.contracts?.[a]?.methods ?? [];
      return methods.some((m: any) => m.entrypoint === "set_approval_for_all");
    });
    expect(approvalContracts.length).toBe(2);
  });

  it("throws for invalid chain", () => {
    expect(() => buildPolicies("invalid" as any)).toThrow();
  });
});
```

**Step 2: Run the test**

Run: `pnpm test -- test/auth/policies.test.ts`

Expected: all 3 tests pass.

**Step 3: Commit**

```bash
git add test/auth/policies.test.ts
git commit -m "test: add policies build verification"
```
