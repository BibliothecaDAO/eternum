// Generate per-game world configuration calls (sozo-ready) using addresses from factory Torii
import * as fs from "node:fs";
import * as Torii from "../../../packages/torii/dist/index.js";
import { getFactorySqlBaseUrl as sharedFactorySqlBase } from "../../../common/factory/endpoints.ts";
import { EternumProvider } from "../../../packages/provider/dist/index.js";

interface Params {
  chain: string;
  worldName: string;
  adminAddress: string;
  startMainAt?: number;
  vrfProviderAddress?: string;
  cartridgeApiBase?: string;
}

const FACTORY_QUERIES = (Torii as any).FACTORY_QUERIES as {
  WORLD_CONTRACTS_BY_PADDED_NAME: (padded: string) => string;
  WORLD_DEPLOYED_BY_PADDED_NAME: (padded: string) => string;
};
const buildApiUrl = (Torii as any).buildApiUrl as (base: string, q: string) => string;
const fetchWithErrorHandling = (Torii as any).fetchWithErrorHandling as (url: string, msg: string) => Promise<any[]>;

const strip0x = (v: string): string => (v.startsWith("0x") || v.startsWith("0X") ? v.slice(2) : v);
const normalizeHex = (v: string): string => `0x${strip0x(v).toLowerCase().padStart(64, "0")}`;
const nameToPaddedFelt = (name: string): string => {
  const enc = new TextEncoder();
  const bytes = enc.encode(name);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `0x${hex.padStart(64, "0")}`;
};

function loadManifest(chain: string): any {
  const manifestPath = `contracts/game/manifest_${chain}.json`;
  const text = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(text);
}

function findConfigSelector(manifest: any): string | undefined {
  if (!Array.isArray(manifest?.contracts)) return undefined;
  const byExact = manifest.contracts.find(
    (c: any) => typeof c?.tag === "string" && c.tag.endsWith("-config_systems"),
  );
  if (byExact?.selector) return byExact.selector;
  const byInclude = manifest.contracts.find(
    (c: any) => typeof c?.tag === "string" && c.tag.includes("config_systems"),
  );
  return byInclude?.selector;
}

async function resolveContractsBySelectorWithRetry(
  chain: string,
  worldName: string,
  requiredSelectorHex?: string,
  maxRetries = 30,
  intervalMs = 2000,
): Promise<Record<string, string>> {
  const base = getFactorySqlBaseUrl(chain);
  for (let i = 0; i < maxRetries; i++) {
    const padded = nameToPaddedFelt(worldName);
    const query = FACTORY_QUERIES.WORLD_CONTRACTS_BY_PADDED_NAME(padded);
    const url = buildApiUrl(base, query);
    const rows = await fetchWithErrorHandling(url, "Factory SQL failed");
    const map: Record<string, string> = {};
    for (const r of rows as any[]) map[normalizeHex(r.contract_selector)] = r.contract_address;
    if (!requiredSelectorHex || (requiredSelectorHex && map[normalizeHex(requiredSelectorHex)])) {
      return map;
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error("Factory contracts not indexed yet; timed out waiting for config_systems address");
}

async function resolveWorldAddressFromFactory(chain: string, worldName: string): Promise<string | null> {
  const base = getFactorySqlBaseUrl(chain);
  const padded = nameToPaddedFelt(worldName);
  const query = FACTORY_QUERIES.WORLD_DEPLOYED_BY_PADDED_NAME(padded);
  const url = buildApiUrl(base, query);
  try {
    const rows = await fetchWithErrorHandling(url, "Factory SQL failed");
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0] as any;
    return row.address || row.contract_address || null;
  } catch {
    return null;
  }
}

function getFactorySqlBaseUrl(chain: string): string {
  const base = process.env.CARTRIDGE_API_BASE || "https://api.cartridge.gg";
  return sharedFactorySqlBase(chain, base);
}

function patchManifestWithFactory(baseManifest: any, worldAddress: string | null, map: Record<string, string>) {
  const manifest = JSON.parse(JSON.stringify(baseManifest));
  if (manifest?.world) manifest.world.address = worldAddress || manifest?.world?.address || "0x0";
  if (Array.isArray(manifest?.contracts)) {
    manifest.contracts = manifest.contracts.map((c: any) => {
      if (!c?.selector) return c;
      const key = normalizeHex(c.selector);
      const addr = map[key];
      return addr ? { ...c, address: addr } : c;
    });
  }
  return manifest;
}

function toFeltish(v: any): (string | number)[] {
  if (v === undefined || v === null) return [];
  if (typeof v === "boolean") return [v ? 1 : 0];
  if (typeof v === "bigint") return [v.toString()];
  if (typeof v === "number" || typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap((x) => toFeltish(x));
  if (typeof v === "object" && "pending_word_len" in v && "pending_word" in v && "data" in v) {
    const data = Array.isArray((v as any).data) ? (v as any).data : [];
    return [data.length, ...data, (v as any).pending_word ?? "0x0", (v as any).pending_word_len ?? 0];
  }
  if (typeof v === "object" && "low" in v && "high" in v) {
    return [(v as any).low, (v as any).high];
  }
  try {
    return [String(v)];
  } catch {
    return ["0"];
  }
}

export async function generateWorldConfigCalldata(p: Params) {
  const baseManifest = loadManifest(p.chain);
  const cfgSelector = findConfigSelector(baseManifest);
  const map = await resolveContractsBySelectorWithRetry(p.chain, p.worldName, cfgSelector);
  const worldAddr = await resolveWorldAddressFromFactory(p.chain, p.worldName);
  const manifest = patchManifestWithFactory(baseManifest, worldAddr, map);

  const provider: any = new EternumProvider(manifest, undefined, p.vrfProviderAddress);
  provider.collected = [] as any[];
  provider.executeAndCheckTransaction = async (_signer: any, details: any) => {
    const arr = Array.isArray(details) ? details : [details];
    provider.collected.push(...arr);
    return { statusReceipt: "COLLECTED" } as any;
  };

  // Load and override chain config
  const cfgPath = `config/environments/data/${p.chain}.json`;
  const confObj = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const configuration = confObj.configuration || confObj;
  if (p.startMainAt && configuration?.season) configuration.season.startMainAt = p.startMainAt;
  if (p.vrfProviderAddress && configuration?.vrf)
    configuration.vrf.vrfProviderAddress = p.vrfProviderAddress;

  const account = { address: p.adminAddress } as any;
  const ctx = { account, provider, config: configuration } as any;

  // Import config functions dynamically to avoid ESM/CJS friction
  const ConfigMod: any = await import("../../../config/deployer/config.ts");
  const C: any = (ConfigMod as any).default ?? (ConfigMod as any);

  // Same order as UI
  await C.setWorldConfig(ctx);
  await C.setVRFConfig(ctx);
  await C.setGameModeConfig(ctx);
  await C.setBlitzPreviousGame(ctx);
  await C.setVictoryPointsConfig(ctx);
  await C.setDiscoverableVillageSpawnResourcesConfig(ctx);
  await C.setBlitzRegistrationConfig(ctx);
  await C.setWonderBonusConfig(ctx);
  await C.setAgentConfig(ctx);
  await C.setVillageControllersConfig(ctx);
  await C.setTradeConfig(ctx);
  await C.setSeasonConfig(ctx);
  await C.setResourceBridgeFeesConfig(ctx);
  await C.setBattleConfig(ctx);
  await C.setStructureMaxLevelConfig(ctx);
  await C.setupGlobals(ctx);
  await C.setCapacityConfig(ctx);
  await C.setSpeedConfig(ctx);
  await C.setHyperstructureConfig(ctx);
  await C.setSettlementConfig(ctx);
  await C.setStartingResourcesConfig(ctx);
  await C.setWeightConfig(ctx);
  await C.setRealmUpgradeConfig(ctx);
  await C.setTroopConfig(ctx);
  await C.setBuildingConfig(ctx);

  const outDir = `contracts/game/factory/${p.chain}/calldata/${p.worldName}`;
  fs.mkdirSync(outDir, { recursive: true });
  const calls = provider.collected as Array<{ contractAddress: string; entrypoint: string; calldata: any[] }>; 
  fs.writeFileSync(`${outDir}/world_config_calls.json`, JSON.stringify(calls, null, 2));
  if (worldAddr) fs.writeFileSync(`${outDir}/world_address.txt`, String(worldAddr));

  const fmtArgs = (arr: any[]) => toFeltish(arr).map((x) => String(x)).join(" ");
  const segments = calls.map((c) => `${c.contractAddress} ${c.entrypoint} ${fmtArgs(c.calldata || [])}`.trim());
  const multicall = segments.join(" / ");
  fs.writeFileSync(`${outDir}/world_config_multicall.txt`, multicall);

  const lines = calls.map((c) => `sozo execute --profile ${p.chain} ${c.contractAddress} ${c.entrypoint} ${fmtArgs(c.calldata || [])}`);
  fs.writeFileSync(`${outDir}/world_config_calls.sh`, `#!/usr/bin/env bash\nset -euo pipefail\n${lines.join("\n")}\n`);

  const prettyLines: string[] = [];
  // Use the explicit admin the user provided for set_world_config
  const prettySegments = calls.map((c) => {
    const flat = toFeltish(c.calldata || []).map(String);
    if (c.entrypoint === "set_world_config" && flat.length > 0) flat[0] = p.adminAddress;
    return `${c.contractAddress} ${c.entrypoint} ${flat.join(" ")}`.trim();
  });
  prettySegments.forEach((seg, idx) => {
    const prefix = idx === 0 ? "  " : "  / ";
    const cont = idx === segments.length - 1 ? "" : " \\\n";
    prettyLines.push(prefix + seg + cont);
  });
  const prettyScript = `#!/usr/bin/env bash\nset -euo pipefail\nsozo execute --profile ${p.chain} \\\n+${prettyLines.join("")}`;
  fs.writeFileSync(`${outDir}/world_config_execute_multiline.sh`, prettyScript + "\n");
}
