import { getContractByName, NAMESPACE } from "@bibliothecadao/eternum";

process.env.VITE_PUBLIC_NETWORK = process.env.VITE_PUBLIC_NETWORK || "local";
const manifest =
  process.env.VITE_PUBLIC_NETWORK === "local"
    ? require("../../../../contracts/game/manifest_local.json")
    : require("../../../../contracts/game/manifest_sepolia.json");

function normalizeUrl(url: string | undefined, defaultUrl: string): string {
  if (!url) return defaultUrl;
  return url.replace(/127\.0\.0\.1/g, "localhost");
}

// Summary storage
export const summary = {
  totalRealmsCreated: 0,
  totalLordsAttached: 0,
  totalArmiesCreated: 0,
  totalExplorersMoved: 0,
  realmsByAccount: {} as Record<string, number>,
  lordsAttachedByAccount: {} as Record<string, number>,
  armiesByAccount: {} as Record<string, number>,
  explorersByAccount: {} as Record<string, number>,
  errors: [] as string[],
};

// Worker status tracking
export const workerStatus: Record<
  string,
  {
    stage: string;
    completed?: number;
    total?: number;
    lastUpdate: Date;
  }
> = {};

// Configuration options
export const CONFIG = {
  nodeUrl: normalizeUrl(process.env.VITE_PUBLIC_NODE_URL, "http://localhost:5050"),
  graphqlUrl: normalizeUrl(process.env.VITE_PUBLIC_TORII, "http://localhost:8080") + "/graphql",
  startRealmId: 500,
  realmDistribution: {
    firstAccount: 10, // First account gets exactly this many realms
    middleAccountsMin: 10, // Middle accounts get between min and max
    middleAccountsMax: 10,
    lastAccount: 10, // Last account gets exactly this many realms
  },
  lordsPerRealm: 1000,
  logSummary: true,
  summaryFile: "./metrics.json",
  spawnRealms: true,
  mintLords: true,
  spawnExplorers: true,
  moveExplorers: true,
  levelUpRealms: true,
  createBuildings: true,
};

export const SYSTEM_ADDRESSES = {
  realmSystems: getContractByName(manifest, `${NAMESPACE}-realm_systems`),
  devResourceSystems: getContractByName(manifest, `${NAMESPACE}-dev_resource_systems`),
  troopManagementSystems: getContractByName(manifest, `${NAMESPACE}-troop_management_systems`),
  troopMovementSystems: getContractByName(manifest, `${NAMESPACE}-troop_movement_systems`),
  productionSystems: getContractByName(manifest, `${NAMESPACE}-production_systems`),
  structureSystems: getContractByName(manifest, `${NAMESPACE}-structure_systems`),
  tradeSystems: getContractByName(manifest, `${NAMESPACE}-trade_systems`),
};
