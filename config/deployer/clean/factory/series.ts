import { getFactorySqlBaseUrl } from "../../../../common/factory/endpoints";
import { shortString } from "starknet";
import type { DeploymentChain } from "../types";

const SERIES_EXISTS_QUERY = (encodedSeriesName: string) =>
  `SELECT name FROM [wf-Series] WHERE name = "${encodedSeriesName}" LIMIT 1;`;
const SERIES_LAST_GAME_QUERY = (encodedSeriesName: string) =>
  `SELECT game_number FROM [wf-SeriesGame] WHERE name = "${encodedSeriesName}" ORDER BY game_number DESC LIMIT 1;`;

export interface FactorySeriesState {
  exists: boolean;
  lastGameNumber: number;
}

function encodeSeriesName(seriesName: string): string {
  return shortString.encodeShortString(seriesName.trim());
}

function readGameNumber(row: Record<string, unknown> | undefined): number | null {
  if (!row) {
    return null;
  }

  const value =
    row.game_number ??
    (typeof row.data === "object" && row.data ? (row.data as Record<string, unknown>).game_number : null);
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }

  return null;
}

async function fetchFactoryRows(factorySqlBaseUrl: string, query: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`);

  if (!response.ok) {
    throw new Error(`Factory query failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Factory query returned unexpected payload");
  }

  return payload as Record<string, unknown>[];
}

export async function readFactorySeriesState(params: {
  chain: DeploymentChain;
  seriesName: string;
  cartridgeApiBase?: string;
}): Promise<FactorySeriesState> {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(params.chain, params.cartridgeApiBase);
  if (!factorySqlBaseUrl) {
    return {
      exists: false,
      lastGameNumber: 0,
    };
  }

  const encodedSeriesName = encodeSeriesName(params.seriesName);
  const [seriesRows, lastGameRows] = await Promise.all([
    fetchFactoryRows(factorySqlBaseUrl, SERIES_EXISTS_QUERY(encodedSeriesName)),
    fetchFactoryRows(factorySqlBaseUrl, SERIES_LAST_GAME_QUERY(encodedSeriesName)).catch(() => []),
  ]);

  return {
    exists: seriesRows.length > 0,
    lastGameNumber: readGameNumber(lastGameRows[0]) ?? 0,
  };
}
