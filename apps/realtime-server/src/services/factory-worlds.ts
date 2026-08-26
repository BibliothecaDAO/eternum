import { decodePaddedFeltAscii, extractNameFelt, fetchFactoryRows, getFactorySqlBaseUrl } from "./factory-sql";

const GAME_REGISTRY_QUERY = `SELECT game_id, name FROM "s2-GameRegistry" ORDER BY game_id LIMIT 1000;`;

export interface FactoryWorldDeployment {
  gameId: number;
  name: string;
  worldAddress: string | null;
}

export async function fetchFactoryWorldDeployments(
  chain: string,
  timeoutMs: number,
): Promise<FactoryWorldDeployment[]> {
  const baseUrl = getFactorySqlBaseUrl(chain);
  const rows = await fetchFactoryRows(baseUrl, GAME_REGISTRY_QUERY, timeoutMs);

  const worlds: FactoryWorldDeployment[] = [];
  for (const row of rows) {
    const nameFelt = extractNameFelt(row);
    if (!nameFelt) continue;

    const decodedName = decodePaddedFeltAscii(nameFelt);
    const gameId = Number(row.game_id);
    if (decodedName && Number.isSafeInteger(gameId)) {
      worlds.push({
        gameId,
        name: decodedName,
        worldAddress: null,
      });
    }
  }

  return worlds;
}
