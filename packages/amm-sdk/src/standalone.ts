import mainnetSeasonAddresses from "../../../contracts/common/addresses/mainnet.json";

export interface StandaloneAmmResource {
  address: string;
  id: number;
  key: string;
  name: string;
}

const RESOURCE_NAME_OVERRIDES: Record<string, string> = {
  ALCHEMICALSILVER: "Alchemical Silver",
  ANCIENTFRAGMENT: "Ancient Fragment",
  COLDIRON: "Cold Iron",
  CROSSBOWMAN: "Crossbowman",
  CROSSBOWMAN2: "Crossbowman II",
  CROSSBOWMAN3: "Crossbowman III",
  DEEPCRYSTAL: "Deep Crystal",
  DRAGONHIDE: "Dragonhide",
  ETHEREALSILICA: "Ethereal Silica",
  HARTWOOD: "Hartwood",
  IGNIUM: "Ignium",
  IRONWOOD: "Ironwood",
  KNIGHT: "Knight",
  KNIGHT2: "Knight II",
  KNIGHT3: "Knight III",
  LORDS: "LORDS",
  PALADIN: "Paladin",
  PALADIN2: "Paladin II",
  PALADIN3: "Paladin III",
  TRUEICE: "True Ice",
  TWILIGHTQUARTZ: "Twilight Quartz",
};

function normalizeAddress(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, "");
  const normalizedHex = hex.replace(/^0+/, "") || "0";
  return `0x${normalizedHex}`;
}

function formatStandaloneResourceKey(resourceKey: string): string {
  const override = RESOURCE_NAME_OVERRIDES[resourceKey];

  if (override) {
    return override;
  }

  const withVersionSuffix = resourceKey.replace(/(\d+)$/, " $1");
  return withVersionSuffix.charAt(0) + withVersionSuffix.slice(1).toLowerCase();
}

function buildStandaloneAmmResources(): StandaloneAmmResource[] {
  return Object.entries(mainnetSeasonAddresses.resources).map(([resourceKey, [resourceId, tokenAddress]]) => ({
    key: resourceKey,
    id: Number(resourceId),
    address: normalizeAddress(String(tokenAddress)),
    name: formatStandaloneResourceKey(resourceKey),
  }));
}

const STANDALONE_AMM_RESOURCE_ENTRIES = buildStandaloneAmmResources();
const STANDALONE_AMM_RESOURCE_NAME_BY_ADDRESS = new Map(
  STANDALONE_AMM_RESOURCE_ENTRIES.map((resource) => [resource.address, resource.name]),
);

export const DEFAULT_STANDALONE_AMM_ADDRESS =
  "0x04a11ce000000000000000000000000000000000000000000000000000000000" as const;
export const DEFAULT_STANDALONE_AMM_INDEXER_URL = "http://127.0.0.1:3001" as const;
export const DEFAULT_STANDALONE_AMM_LORDS_ADDRESS = normalizeAddress(mainnetSeasonAddresses.lords);

export const STANDALONE_AMM_RESOURCES = STANDALONE_AMM_RESOURCE_ENTRIES.filter(
  (resource) => resource.address !== DEFAULT_STANDALONE_AMM_LORDS_ADDRESS,
);

export function resolveStandaloneAmmTokenName(tokenAddress: string): string | null {
  return STANDALONE_AMM_RESOURCE_NAME_BY_ADDRESS.get(normalizeAddress(tokenAddress)) ?? null;
}
