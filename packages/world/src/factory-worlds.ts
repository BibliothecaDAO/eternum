import { decodePaddedFeltAscii } from "./parsers";

export const extractFactoryWorldNames = (rows: Record<string, unknown>[]): string[] => {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const feltHex: string | undefined =
      (row?.name as string) ||
      (row?.["data.name"] as string) ||
      ((row?.data as Record<string, unknown>)?.name as string);

    if (!feltHex || typeof feltHex !== "string") continue;

    const decoded = decodePaddedFeltAscii(feltHex);
    if (!decoded || seen.has(decoded)) continue;

    seen.add(decoded);
    names.push(decoded);
  }

  return names;
};

export const fetchFactoryWorldNames = async (factorySqlBaseUrl: string, limit: number = 200): Promise<string[]> => {
  if (!factorySqlBaseUrl) return [];

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 200;
  const query = `SELECT name FROM [wf-WorldDeployed] LIMIT ${safeLimit};`;
  const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Factory query failed: ${response.status} ${response.statusText}`);
  }

  const rows = (await response.json()) as Record<string, unknown>[];
  return extractFactoryWorldNames(rows);
};
