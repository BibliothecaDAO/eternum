import { decodePaddedFeltAscii, extractNameFelt, fetchFactoryRows, getFactorySqlBaseUrl } from "./factory-sql";

const FACTORY_WORLDS_QUERY = `SELECT name, address FROM [wf-WorldDeployed] LIMIT 1000;`;

export async function fetchFactoryWorldNames(chain: string, timeoutMs: number): Promise<string[]> {
  const baseUrl = getFactorySqlBaseUrl(chain);
  if (!baseUrl) return [];

  const rows = await fetchFactoryRows(baseUrl, FACTORY_WORLDS_QUERY, timeoutMs);

  const names: string[] = [];
  for (const row of rows) {
    const nameFelt = extractNameFelt(row);
    if (!nameFelt) continue;

    const decodedName = decodePaddedFeltAscii(nameFelt);
    if (decodedName) names.push(decodedName);
  }

  return names;
}
