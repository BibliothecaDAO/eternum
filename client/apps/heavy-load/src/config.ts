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
  realmsByAccount: {} as Record<string, number>,
  errors: [] as string[],
};

// Configuration options
export const CONFIG = {
  nodeUrl: normalizeUrl(process.env.VITE_PUBLIC_NODE_URL, "http://localhost:5050"),
  graphqlUrl: normalizeUrl(process.env.VITE_PUBLIC_TORII, "http://localhost:8080") + "/graphql",
  startRealmId: 30,
  realmDistribution: {
    firstAccount: 1, // First account gets exactly this many realms
    middleAccountsMin: 1, // Middle accounts get between min and max
    middleAccountsMax: 1,
    lastAccount: 1, // Last account gets exactly this many realms
  },
  lordsPerRealm: 1000,
  logSummary: true,
  summaryFile: "./metrics.json",
};

export const SYSTEM_ADDRESSES = {
  realmSystems: getContractByName(manifest, `${NAMESPACE}-realm_systems`),
  devResourceSystems: getContractByName(manifest, `${NAMESPACE}-dev_resource_systems`),
  troopManagementSystems: getContractByName(manifest, `${NAMESPACE}-troop_management_systems`),
  troopMovementSystems: getContractByName(manifest, `${NAMESPACE}-troop_movement_systems`),
};
