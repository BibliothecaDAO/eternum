import { Coord, Direction, getAllHexDirections, HexGrid } from "@bibliothecadao/types";
import { BANK_COUNT, BANK_NAME_PREFIX, BANK_STEPS_FROM_CENTER, CARTRIDGE_API_BASE } from "../constants";

const WORLD_CONFIG_TABLE = "s1_eternum-WorldConfig";
const WORLD_MAP_CENTER_OFFSET_QUERY = `SELECT "map_center_offset" AS map_center_offset FROM "${WORLD_CONFIG_TABLE}" LIMIT 1;`;

function parseMaybeHexToNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = value.startsWith("0x") ? Number.parseInt(value, 16) : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function buildWorldToriiSqlUrl(worldName: string, query: string): string {
  return `${CARTRIDGE_API_BASE}/x/${worldName}/torii/sql?query=${encodeURIComponent(query)}`;
}

function resolveWorldMapCenterCoord(mapCenterOffset: number): Coord {
  return new Coord(HexGrid.CENTER - mapCenterOffset, HexGrid.CENTER - mapCenterOffset);
}

function buildAdminBankCoord(center: Coord, direction: Direction) {
  const coord = center.travel(direction, BANK_STEPS_FROM_CENTER);

  return {
    alt: false,
    x: coord.x,
    y: coord.y,
  };
}

export async function fetchWorldMapCenterOffset(worldName: string): Promise<number> {
  const response = await fetch(buildWorldToriiSqlUrl(worldName, WORLD_MAP_CENTER_OFFSET_QUERY));
  if (!response.ok) {
    throw new Error(`Failed to fetch map_center_offset for "${worldName}" (HTTP ${response.status})`);
  }

  const [row] = (await response.json()) as Array<Record<string, unknown>>;
  const mapCenterOffset = parseMaybeHexToNumber(row?.map_center_offset);

  if (mapCenterOffset == null) {
    throw new Error(`WorldConfig.map_center_offset is missing for "${worldName}"`);
  }

  return mapCenterOffset;
}

export function buildAdminBanksForMapCenterOffset(mapCenterOffset: number) {
  const center = resolveWorldMapCenterCoord(mapCenterOffset);

  return getAllHexDirections()
    .slice(0, BANK_COUNT)
    .map((direction, index) => ({
      name: `${BANK_NAME_PREFIX} ${index + 1}`,
      coord: buildAdminBankCoord(center, direction),
    }));
}
