import type { Chain } from "@contracts";

import { extractContractAddress, extractNameFelt, decodePaddedFeltAscii, fetchFactoryRows } from "./factory-sql";
import { getFactorySqlBaseUrl } from "./factory-endpoints";
import type { FactoryIndexedWorld } from "./types";

const FACTORY_WORLDS_QUERY = `SELECT name, address FROM [wf-WorldDeployed] LIMIT 1000;`;

export const listFactoryWorlds = async (chain: Chain): Promise<FactoryIndexedWorld[]> => {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
  if (!factorySqlBaseUrl) return [];

  const rows = await fetchFactoryRows(factorySqlBaseUrl, FACTORY_WORLDS_QUERY);
  const seenNames = new Set<string>();
  const worlds: FactoryIndexedWorld[] = [];

  for (const row of rows) {
    const nameFelt = extractNameFelt(row);
    if (!nameFelt) continue;

    const decodedName = decodePaddedFeltAscii(nameFelt);
    if (!decodedName || seenNames.has(decodedName)) continue;

    seenNames.add(decodedName);
    worlds.push({
      name: decodedName,
      chain,
      worldAddress: extractContractAddress(row),
    });
  }

  return worlds;
};
