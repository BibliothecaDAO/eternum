import { hash, byteArray, RpcProvider } from "starknet";
import { FACTORY_QUERIES, buildApiUrl, fetchWithErrorHandling, SqlApi } from "@bibliothecadao/torii";

export type Chain = "slot" | "slottest" | "local" | "sepolia" | "mainnet";

export interface ResolvedWorld {
  manifest: { contracts: unknown[]; world?: { address: string }; [key: string]: unknown };
  worldAddress: string;
  toriiUrl: string;
  rpcUrl: string;
}

// ---------------------------------------------------------------------------
// Hex / felt helpers
// ---------------------------------------------------------------------------

const strip0x = (v: string) => (v.startsWith("0x") || v.startsWith("0X") ? v.slice(2) : v);

const normalizeSelector = (v: string) => {
  const body = strip0x(v).toLowerCase().padStart(64, "0");
  return `0x${body}`;
};

const nameToPaddedFelt = (name: string) => {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `0x${hex.padStart(64, "0")}`;
};

// ---------------------------------------------------------------------------
// Dojo selector computation (poseidon hash of ByteArray representations)
// ---------------------------------------------------------------------------

function computeByteArrayHash(s: string): bigint {
  const ba = byteArray.byteArrayFromString(s);
  const felts: bigint[] = [
    BigInt(ba.data.length),
    ...ba.data.map((d: unknown) => BigInt(String(d))),
    BigInt(ba.pending_word),
    BigInt(ba.pending_word_len),
  ];
  return BigInt(hash.computePoseidonHashOnElements(felts));
}

function computeSelectorFromTag(namespace: string, name: string): string {
  const h = hash.computePoseidonHashOnElements([
    computeByteArrayHash(namespace),
    computeByteArrayHash(name),
  ]);
  return `0x${BigInt(h).toString(16).padStart(64, "0")}`;
}

// ---------------------------------------------------------------------------
// Known eternum system contracts and their entrypoints
// ---------------------------------------------------------------------------

const NAMESPACE = "s1_eternum";

const KNOWN_CONTRACTS: { name: string; systems: string[] }[] = [
  { name: "blitz_realm_systems", systems: ["approve", "assign_realm_positions", "make_hyperstructures", "register", "set_approval_for_all", "settle_realms"] },
  { name: "resource_bridge_systems", systems: ["deposit", "withdraw"] },
  { name: "trade_systems", systems: ["accept_order", "cancel_order", "create_order"] },
  { name: "dev_resource_systems", systems: ["mint"] },
  { name: "structure_systems", systems: ["level_up"] },
  { name: "village_systems", systems: ["create", "request_random"] },
  { name: "realm_systems", systems: ["mint_starting_resources", "set_approval_for_all"] },
  { name: "ownership_systems", systems: ["transfer_agent_ownership", "transfer_structure_ownership"] },
  { name: "resource_systems", systems: ["approve", "arrivals_offload", "pickup", "send", "structure_burn", "structure_troop_adjacent_transfer", "troop_burn", "troop_structure_adjacent_transfer", "troop_troop_adjacent_transfer"] },
  { name: "name_systems", systems: ["set_address_name", "set_entity_name"] },
  { name: "production_systems", systems: ["burn_labor_for_resource_production", "burn_resource_for_labor_production", "burn_resource_for_resource_production", "claim_wonder_production_bonus", "create_building", "destroy_building", "pause_building_production", "resume_building_production"] },
  { name: "bank_systems", systems: ["change_owner_amm_fee", "change_owner_bridge_fee", "create_banks"] },
  { name: "swap_systems", systems: ["buy", "sell"] },
  { name: "liquidity_systems", systems: ["add", "remove"] },
  { name: "troop_management_systems", systems: ["explorer_add", "explorer_create", "explorer_delete", "explorer_explorer_swap", "explorer_guard_swap", "guard_add", "guard_delete", "guard_explorer_swap"] },
  { name: "troop_movement_systems", systems: ["explorer_extract_reward", "explorer_move"] },
  { name: "troop_battle_systems", systems: ["attack_explorer_vs_explorer", "attack_explorer_vs_guard", "attack_guard_vs_explorer"] },
  { name: "troop_raid_systems", systems: ["raid_explorer_vs_guard"] },
  { name: "guild_systems", systems: ["create_guild", "join_guild", "leave_guild", "remove_member", "update_whitelist"] },
  { name: "config_systems", systems: ["set_agent_config", "set_bank_config", "set_battle_config", "set_blitz_registration_config", "set_building_category_config", "set_building_config", "set_capacity_config", "set_donkey_speed_config", "set_factory_address", "set_game_mode_config", "set_hyperstructure_config", "set_map_config", "set_mercenaries_name_config", "set_mmr_config", "set_quest_config", "set_resource_bridge_fee_split_config", "set_resource_bridge_whitelist_config", "set_resource_factory_config", "set_resource_weight_config", "set_season_config", "set_settlement_config", "set_stamina_config", "set_stamina_refill_config", "set_starting_resources_config", "set_structure_level_config", "set_structure_max_level_config", "set_tick_config", "set_trade_config", "set_travel_food_cost_config", "set_troop_config", "set_victory_points_grant_config", "set_victory_points_win_config", "set_village_found_resources_config", "set_village_token_config", "set_vrf_config", "set_world_config"] },
  { name: "hyperstructure_systems", systems: ["allocate_shares", "claim_construction_points", "claim_share_points", "contribute", "initialize", "update_construction_access"] },
  { name: "season_systems", systems: ["season_close", "season_prize_claim"] },
  { name: "prize_distribution_systems", systems: ["blitz_prize_claim", "blitz_prize_claim_no_game", "blitz_prize_player_rank"] },
  { name: "mmr_systems", systems: ["claim_game_mmr", "commit_game_mmr_meta"] },
  { name: "quest_systems", systems: ["add_game", "claim_reward", "disable_quests", "enable_quests", "start_quest"] },
  { name: "relic_systems", systems: ["apply_relic", "open_chest"] },
];

// Pre-compute selector → contract info for fast lookup
const SELECTOR_TO_CONTRACT = new Map<string, { tag: string; systems: string[] }>();
for (const c of KNOWN_CONTRACTS) {
  const tag = `${NAMESPACE}-${c.name}`;
  const selector = computeSelectorFromTag(NAMESPACE, c.name);
  SELECTOR_TO_CONTRACT.set(normalizeSelector(selector), { tag, systems: c.systems });
}

// ---------------------------------------------------------------------------
// Factory endpoint resolution
// ---------------------------------------------------------------------------

function getFactorySqlBaseUrl(chain: Chain, cartridgeApiBase: string): string {
  switch (chain) {
    case "mainnet":
      return `${cartridgeApiBase}/x/eternum-factory-mainnet/torii/sql`;
    case "sepolia":
      return `${cartridgeApiBase}/x/eternum-factory-sepolia/torii/sql`;
    case "slot":
    case "slottest":
    case "local":
      return `${cartridgeApiBase}/x/eternum-factory-slot-a/torii/sql`;
  }
}

// ---------------------------------------------------------------------------
// Factory queries
// ---------------------------------------------------------------------------

interface FactoryContractRow {
  contract_address: string;
  contract_selector: string;
  name?: string;
}

async function resolveWorldContracts(
  factorySqlBaseUrl: string,
  gameName: string,
): Promise<Record<string, string>> {
  const paddedName = nameToPaddedFelt(gameName);
  const query = FACTORY_QUERIES.WORLD_CONTRACTS_BY_PADDED_NAME(paddedName);
  const url = buildApiUrl(factorySqlBaseUrl, query);
  const rows = await fetchWithErrorHandling<FactoryContractRow>(url, "Factory: failed to fetch world contracts");

  const map: Record<string, string> = {};
  for (const row of rows) {
    map[normalizeSelector(row.contract_selector)] = row.contract_address;
  }
  return map;
}

async function resolveWorldDeployment(
  factorySqlBaseUrl: string,
  gameName: string,
): Promise<{ worldAddress: string | null; rpcUrl: string | null }> {
  const paddedName = nameToPaddedFelt(gameName);
  const query = FACTORY_QUERIES.WORLD_DEPLOYED_BY_PADDED_NAME(paddedName);
  const url = buildApiUrl(factorySqlBaseUrl, query);

  try {
    const rows = await fetchWithErrorHandling<Record<string, unknown>>(url, "Factory: failed to fetch world deployment");
    if (rows.length === 0) return { worldAddress: null, rpcUrl: null };
    const row = rows[0];

    const extractAddress = (r: Record<string, unknown>): string | null => {
      for (const key of ["address", "contract_address", "world_address", "worldAddress"]) {
        const v = r[key];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return null;
    };

    const extractRpc = (r: Record<string, unknown>): string | null => {
      for (const key of ["rpc_url", "rpcUrl", "node_url", "nodeUrl"]) {
        const v = r[key];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return null;
    };

    return {
      worldAddress: extractAddress(row),
      rpcUrl: extractRpc(row),
    };
  } catch {
    return { worldAddress: null, rpcUrl: null };
  }
}

// ---------------------------------------------------------------------------
// Build manifest from factory data + known contract definitions
// ---------------------------------------------------------------------------

// Fallback ABI when RPC fetch fails — enough for starknet.js to detect Cairo 2.
const STUB_WORLD_ABI = [{ type: "interface", name: "dojo::world::iworld::IWorld", items: [] }];

async function fetchWorldAbi(rpcUrl: string, worldAddress: string): Promise<unknown[]> {
  try {
    const provider = new RpcProvider({ nodeUrl: rpcUrl });
    const classInfo = await provider.getClassAt(worldAddress);
    if (Array.isArray((classInfo as any).abi) && (classInfo as any).abi.length > 0) {
      return (classInfo as any).abi;
    }
  } catch (err) {
    console.warn(`  Could not fetch world ABI from RPC, using stub: ${err}`);
  }
  return STUB_WORLD_ABI;
}

function buildManifestFromFactory(
  worldAddress: string,
  contractsBySelector: Record<string, string>,
  worldAbi: unknown[],
): { contracts: unknown[]; world: { address: string; abi: unknown[] } } {
  const contracts: unknown[] = [];
  let matched = 0;

  for (const [selector, info] of SELECTOR_TO_CONTRACT) {
    const address = contractsBySelector[selector];
    if (address) {
      contracts.push({
        tag: info.tag,
        selector,
        address,
        systems: info.systems,
      });
      matched++;
    }
  }

  // Also include factory contracts that don't match known tags (with no systems)
  for (const [selector, address] of Object.entries(contractsBySelector)) {
    if (!SELECTOR_TO_CONTRACT.has(selector)) {
      contracts.push({
        tag: `unknown-${selector.slice(2, 10)}`,
        selector,
        address,
        systems: [],
      });
    }
  }

  console.log(`  Manifest: ${matched}/${KNOWN_CONTRACTS.length} known contracts matched, ${contracts.length} total`);

  return {
    world: { address: worldAddress, abi: worldAbi },
    contracts,
  };
}

// ---------------------------------------------------------------------------
// RPC URL normalization
// ---------------------------------------------------------------------------

function normalizeRpcUrl(value: string): string {
  if (!value || value.includes("/rpc/")) return value;
  try {
    const url = new URL(value);
    if (!url.hostname.endsWith("cartridge.gg")) return value;
    const p = url.pathname.replace(/\/+$/, "");
    if (p.endsWith("/katana") || /\/starknet\/(mainnet|sepolia)$/i.test(p)) {
      url.pathname = `${p}/rpc/v0_9`;
      return url.toString();
    }
  } catch {
    // ignore
  }
  return value;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

const CARTRIDGE_API_BASE = "https://api.cartridge.gg";

export async function resolveManifest(chain: Chain, gameName: string): Promise<ResolvedWorld> {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain, CARTRIDGE_API_BASE);
  const toriiUrl = `${CARTRIDGE_API_BASE}/x/${gameName}/torii/sql`;

  console.log(`Resolving world config for game "${gameName}" on chain "${chain}"...`);

  // Query factory for contracts + deployment info
  const [contractsBySelector, deployment] = await Promise.all([
    resolveWorldContracts(factorySqlBaseUrl, gameName),
    resolveWorldDeployment(factorySqlBaseUrl, gameName),
  ]);

  // Resolve world address: try target Torii first, then factory fallback
  let worldAddress: string | null = null;
  try {
    const sqlApi = new SqlApi(toriiUrl);
    const addr = await sqlApi.fetchWorldAddress();
    if (addr != null) {
      worldAddress = typeof addr === "bigint" ? `0x${addr.toString(16)}` : String(addr);
    }
  } catch {
    // ignore, try factory fallback
  }
  if (!worldAddress) {
    worldAddress = deployment.worldAddress;
  }
  if (!worldAddress) {
    worldAddress = "0x0";
    console.warn("Could not resolve world address; defaulting to 0x0");
  }

  // Resolve RPC URL
  const defaultRpcUrl =
    chain === "slot" || chain === "slottest"
      ? `${CARTRIDGE_API_BASE}/x/eternum-blitz-slot-3/katana/rpc/v0_9`
      : chain === "mainnet" || chain === "sepolia"
        ? `${CARTRIDGE_API_BASE}/x/starknet/${chain}/rpc/v0_9`
        : "http://localhost:5050";
  const rpcUrl = normalizeRpcUrl(deployment.rpcUrl ?? defaultRpcUrl);

  // Fetch the real world ABI from the RPC (falls back to stub on failure)
  const worldAbi = await fetchWorldAbi(rpcUrl, worldAddress);

  // Build manifest from factory data + known contract definitions
  const manifest = buildManifestFromFactory(worldAddress, contractsBySelector, worldAbi);

  console.log(`  World address: ${worldAddress}`);
  console.log(`  Torii: ${toriiUrl}`);
  console.log(`  RPC: ${rpcUrl}`);
  console.log(`  Factory contracts: ${Object.keys(contractsBySelector).length}`);

  return {
    manifest: manifest as ResolvedWorld["manifest"],
    worldAddress,
    toriiUrl,
    rpcUrl,
  };
}
