/**
 * Shared bootstrap sequence used by both the CLI agent (`axis run`) and
 * the MCP server (`axis mcp`).
 *
 * Orchestrates: config -> world discovery -> auth -> clients -> game config
 * -> map loop -> automation loop -> ToolContext assembly.
 *
 * @module
 */

import { EternumClient } from "@bibliothecadao/client";
import { EternumProvider } from "@bibliothecadao/provider";
import type { GameConfig } from "@bibliothecadao/torii";
import type { AccountInterface } from "starknet";
import { homedir } from "node:os";
import { join } from "node:path";

import { loadConfig, type AgentConfig } from "./config.js";
import { getManifest } from "../auth/embedded-data.js";
import { discoverWorld, patchManifest } from "../world/discovery.js";
import { bootstrapDataDir } from "./bootstrap.js";
import { getAccount } from "../auth/session.js";
import { createMapLoop } from "../map/loop.js";
import { createAutomationLoop } from "../automation/loop.js";
import type { MapContext } from "../map/context.js";
import type { ToolContext } from "../tools/core/context.js";
import type { AutomationStatusMap } from "../automation/status.js";

// ── Public interfaces ────────────────────────────────────────────────

/** Options to customise the bootstrap sequence. */
export interface BootstrapOptions {
  /** Wait up to 30s for the first map snapshot before returning. Default `true`. */
  waitForMap?: boolean;
  /** Start the background map refresh loop automatically. Default `true`. */
  startMapLoop?: boolean;
  /** Callback invoked when the auth flow prints a URL (e.g. Cartridge login link). */
  onAuthUrl?: (url: string) => void;
}

/** Everything produced by {@link bootstrap}. */
export interface BootstrapResult {
  config: AgentConfig;
  client: EternumClient;
  provider: EternumProvider;
  account: AccountInterface;
  gameConfig: GameConfig;
  mapCtx: MapContext;
  mapLoop: { start(): void; stop(): void; refresh(): Promise<void> };
  automationLoop: ReturnType<typeof createAutomationLoop>;
  automationStatus: AutomationStatusMap;
  toolCtx: ToolContext;
}

// ── Implementation ───────────────────────────────────────────────────

const BASE_MAP_CENTER = 2147483646;

/**
 * Execute the full agent bootstrap sequence.
 *
 * 1. Load config and optionally discover the world via the factory.
 * 2. Bootstrap the data directory with default files.
 * 3. Load and patch the manifest.
 * 4. Authenticate with Cartridge (with `onAuthUrl` callback for URL detection).
 * 5. Create `EternumClient` + `EternumProvider`.
 * 6. Fetch game config (building costs, recipes).
 * 7. Query `map_center_offset` for coordinate conversion.
 * 8. Query donkey capacity and resource weights for transport calculations.
 * 9. Create the map loop (started if `startMapLoop` is true).
 * 10. Optionally wait for the first map snapshot.
 * 11. Create the automation loop (not started).
 * 12. Assemble `ToolContext`.
 *
 * @param opts - Optional overrides; see {@link BootstrapOptions}.
 * @returns Everything the caller needs to operate tools and drive the agent.
 */
export async function bootstrap(opts: BootstrapOptions = {}): Promise<BootstrapResult> {
  const { waitForMap = true, startMapLoop = true, onAuthUrl } = opts;

  // 1. Config + world discovery
  const config = loadConfig();

  let contractsBySelector: Record<string, string> | undefined;
  if (config.worldName && (!config.toriiUrl || !config.worldAddress)) {
    console.error(`Discovering world "${config.worldName}" on ${config.chain}...`);
    const info = await discoverWorld(config.chain, config.worldName);
    config.toriiUrl = info.toriiUrl;
    config.worldAddress = info.worldAddress;
    config.rpcUrl = info.rpcUrl;
    contractsBySelector = info.contractsBySelector;
    config.dataDir = join(homedir(), ".axis", "worlds", info.worldAddress);
    console.error(`  Discovered: torii=${info.toriiUrl}, world=${info.worldAddress}`);
    console.error(`  RPC: ${info.rpcUrl}`);
    console.error(`  Resolved ${Object.keys(info.contractsBySelector).length} contract addresses from factory`);
  }

  // 2. Bootstrap data directory
  bootstrapDataDir(config.dataDir);

  // 3. Manifest
  let manifest = getManifest(config.chain);
  if (contractsBySelector) {
    manifest = patchManifest(manifest, config.worldAddress, contractsBySelector);
  }

  // 4. Auth — intercept console.log to capture auth URLs
  let restoreConsoleLog: (() => void) | undefined;
  if (onAuthUrl) {
    const _origLog = console.log;
    console.log = (...a: any[]) => {
      const msg = a.map(String).join(" ");
      const urlMatch = msg.match(/https?:\/\/\S+/);
      if (urlMatch) {
        onAuthUrl(urlMatch[0]);
      }
      _origLog(...a);
    };
    restoreConsoleLog = () => {
      console.log = _origLog;
    };
  }

  const account = await getAccount({
    chain: config.chain,
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    basePath: join(config.dataDir, ".cartridge"),
    manifest,
  });

  if (restoreConsoleLog) restoreConsoleLog();

  console.error(`  Account: ${account.address}`);

  // 5. Clients
  const client = await EternumClient.create({ toriiUrl: config.toriiUrl });
  const provider = new EternumProvider(manifest, config.rpcUrl, config.vrfProviderAddress);

  // 6. Game config
  const gameConfig: GameConfig = await (client.sql as any).fetchGameConfig();
  console.error(
    `  Game config: ${Object.keys(gameConfig.buildingCosts).length} buildings, ` +
      `${Object.keys(gameConfig.resourceFactories).length} recipes, ` +
      `cost scale ${gameConfig.buildingBaseCostPercentIncrease}`,
  );

  // 7. Map center offset
  let mapCenter = BASE_MAP_CENTER;
  try {
    const sql = client.sql as any;
    const baseUrl = sql.baseUrl ?? config.toriiUrl + "/sql";
    const res = await fetch(
      `${baseUrl}?query=${encodeURIComponent("SELECT `map_center_offset` FROM `s1_eternum-WorldConfig` LIMIT 1")}`,
    );
    if (res.ok) {
      const rows = (await res.json()) as any[];
      if (rows[0]?.map_center_offset != null) {
        mapCenter = BASE_MAP_CENTER - Number(rows[0].map_center_offset);
        console.error(`  Map center: ${mapCenter} (offset ${rows[0].map_center_offset})`);
      }
    }
  } catch {
    /* non-critical — coords will use raw values */
  }

  // 8. Donkey capacity and resource weights
  let donkeyCapacityGrams = 50_000;
  const resourceWeightGrams = new Map<number, number>();
  try {
    const sql = client.sql as any;
    const baseUrl = sql.baseUrl ?? config.toriiUrl + "/sql";
    const capRes = await fetch(
      `${baseUrl}?query=${encodeURIComponent("SELECT `capacity_config.donkey_capacity` as cap FROM `s1_eternum-WorldConfig` LIMIT 1")}`,
    );
    if (capRes.ok) {
      const rows = (await capRes.json()) as any[];
      if (rows[0]?.cap != null) donkeyCapacityGrams = Number(rows[0].cap);
    }
    const weightRes = await fetch(
      `${baseUrl}?query=${encodeURIComponent("SELECT resource_type, weight_gram FROM `s1_eternum-WeightConfig`")}`,
    );
    if (weightRes.ok) {
      const rows = (await weightRes.json()) as any[];
      for (const row of rows) {
        resourceWeightGrams.set(Number(row.resource_type), Number(BigInt(row.weight_gram)));
      }
    }
    console.error(
      `  Transport config: donkey capacity ${donkeyCapacityGrams}g, ${resourceWeightGrams.size} resource weights loaded`,
    );
  } catch {
    /* non-critical */
  }

  // 9. Shared contexts
  const mapFilePath = join(config.dataDir, "map.txt");
  const mapCtx: MapContext = { snapshot: null, protocol: null, filePath: mapFilePath };
  const automationStatus: AutomationStatusMap = new Map();

  // Build ToolContext — snapshot is mutable, updated each map tick
  const toolCtx: ToolContext = {
    client,
    provider,
    signer: account,
    playerAddress: account.address,
    gameConfig,
    snapshot: null as any, // set once map loop produces the first snapshot
    mapCenter,
    donkeyCapacityGrams,
    resourceWeightGrams,
  };

  // 10. Map loop
  const mapLoop = createMapLoop(client, mapCtx, account.address, undefined, gameConfig.stamina, undefined, mapCenter);

  // Wire mapCtx.refresh to also sync toolCtx.snapshot
  mapCtx.refresh = async () => {
    await mapLoop.refresh();
    if (mapCtx.snapshot) toolCtx.snapshot = mapCtx.snapshot;
  };

  if (startMapLoop) {
    mapLoop.start();
  }

  // 11. Wait for first map snapshot
  if (waitForMap) {
    console.error("Waiting for first map load...");
    for (let i = 0; i < 30; i++) {
      if (mapCtx.snapshot) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (mapCtx.snapshot) {
      toolCtx.snapshot = mapCtx.snapshot;
      console.error(
        `  Map loaded: ${mapCtx.snapshot.rowCount} rows x ${mapCtx.snapshot.colCount} cols, ${mapCtx.snapshot.tiles.length} tiles`,
      );
    } else {
      console.error("  WARNING: Map failed to load within 30s, starting anyway");
    }
  }

  // 12. Automation loop (created but NOT started — caller decides)
  const automationLoop = createAutomationLoop(
    client,
    provider,
    account,
    account.address,
    config.dataDir,
    mapCtx,
    gameConfig,
    undefined,
    automationStatus,
  );

  return {
    config,
    client,
    provider,
    account,
    gameConfig,
    mapCtx,
    mapLoop,
    automationLoop,
    automationStatus,
    toolCtx,
  };
}
