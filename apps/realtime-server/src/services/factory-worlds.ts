import {
  decodePaddedFeltAscii,
  extractContractAddress,
  extractNameFelt,
  fetchFactoryRows,
  getFactorySqlBaseUrl,
} from "./factory-sql";

const FACTORY_WORLDS_QUERY = `SELECT name, address FROM [wf-WorldDeployed] LIMIT 1000;`;

export interface FactoryWorldDeployment {
  name: string;
  worldAddress: string | null;
}

export async function fetchFactoryWorldDeployments(
  chain: string,
  timeoutMs: number,
): Promise<FactoryWorldDeployment[]> {
  const baseUrl = getFactorySqlBaseUrl(chain);
  if (!baseUrl) return [];

  const rows = await fetchFactoryRows(baseUrl, FACTORY_WORLDS_QUERY, timeoutMs);

  const worlds: FactoryWorldDeployment[] = [];
  for (const row of rows) {
    const nameFelt = extractNameFelt(row);
    if (!nameFelt) continue;

    const decodedName = decodePaddedFeltAscii(nameFelt);
    if (decodedName) {
      worlds.push({
        name: decodedName,
        worldAddress: extractContractAddress(row),
      });
    }
  }

  return worlds;
}
