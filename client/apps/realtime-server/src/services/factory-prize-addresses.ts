import { decodePaddedFeltAscii, fetchFactoryRows, getFactorySqlBaseUrl } from "./factory-sql";

const PRIZE_DISTRIBUTION_SELECTOR = "0x042230b5f7ccc6ce02a4ecb99c31d92ddd0f24ab472896afd617a2a763cf4179";

const PRIZE_ADDRESS_QUERY = `
  SELECT name, contract_address
  FROM [wf-WorldContract]
  WHERE LOWER(contract_selector) = '${PRIZE_DISTRIBUTION_SELECTOR}'
  LIMIT 1000
`;

function extractAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const big = BigInt(trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`);
    if (big === 0n) return null;
    return `0x${big.toString(16)}`;
  } catch {
    return null;
  }
}

/**
 * Bulk-fetch prize distribution contract addresses for every world on a given chain.
 * Returns a `worldName → prizeAddress` map (world names are decoded from padded felts).
 * One SQL query per chain per poll cycle.
 */
export async function fetchFactoryPrizeAddresses(chain: string, timeoutMs: number): Promise<Map<string, string>> {
  const baseUrl = getFactorySqlBaseUrl(chain);
  if (!baseUrl) return new Map();

  let rows: Record<string, unknown>[];
  try {
    rows = await fetchFactoryRows(baseUrl, PRIZE_ADDRESS_QUERY, timeoutMs);
  } catch {
    return new Map();
  }

  const map = new Map<string, string>();
  for (const row of rows) {
    const nameFelt = typeof row.name === "string" ? row.name : null;
    if (!nameFelt) continue;

    const worldName = decodePaddedFeltAscii(nameFelt);
    if (!worldName || map.has(worldName)) continue;

    const address = extractAddress(row.contract_address);
    if (!address) continue;

    map.set(worldName, address);
  }

  return map;
}
