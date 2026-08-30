import type {
  HeraldGameDirectory,
  HeraldGameDirectoryEntry,
  HeraldGameStatus,
} from "@bibliothecadao/eternum/game-sync";

import type { FoldRow } from "./types";

interface GameDirectorySource {
  modelRows: (model: string) => FoldRow[];
}

const asRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Herald directory expected ${field} to be an object`);
  }
  return value as Record<string, unknown>;
};

const asNumber = (value: unknown, field: string): number => {
  try {
    const parsed = Number(BigInt(value as string | number | bigint));
    if (Number.isSafeInteger(parsed)) return parsed;
  } catch {
    // The field-specific error below is more useful than BigInt's parser error.
  }
  throw new Error(`Herald directory expected ${field} to be a safe integer`);
};

const asBoolean = (value: unknown, field: string): boolean => {
  if (typeof value === "boolean") return value;
  if (value === 0 || value === 0n || value === "0x0") return false;
  if (value === 1 || value === 1n || value === "0x1") return true;
  throw new Error(`Herald directory expected ${field} to be a boolean`);
};

const asAddress = (value: unknown, field: string): string | null => {
  const numeric = BigInt(value as string | number | bigint);
  if (numeric === 0n) return null;
  if (numeric < 0n) throw new Error(`Herald directory expected ${field} to be an address`);
  return `0x${numeric.toString(16)}`;
};

const asStatus = (value: unknown): HeraldGameStatus => {
  if (["Created", "Registration", "Live", "Ended", "Settled"].includes(String(value))) {
    return String(value) as HeraldGameStatus;
  }
  throw new Error(`Herald directory received unknown game status ${String(value)}`);
};

const decodeShortString = (value: unknown): string => {
  const hex = BigInt(value as string | number | bigint).toString(16);
  const padded = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = padded.match(/.{2}/g) ?? [];
  return String.fromCharCode(...bytes.map((byte) => Number.parseInt(byte, 16)));
};

const gameIdOf = (row: FoldRow): number => asNumber(row.value.game_id, "game_id");

const structureCategory = (row: FoldRow): number => {
  const base = asRecord(row.value.base, "Structure.base");
  return asNumber(base.category, "Structure.base.category");
};

const rowsByGame = (rows: FoldRow[]): Map<number, Record<string, unknown>> =>
  new Map(rows.map((row) => [gameIdOf(row), row.value]));

const countSettledStructures = (
  rows: FoldRow[],
): Map<number, { players: Set<string>; realms: number; villages: number }> => {
  const counts = new Map<number, { players: Set<string>; realms: number; villages: number }>();
  for (const row of rows) {
    const gameId = gameIdOf(row);
    const category = structureCategory(row);
    if (category !== 1 && category !== 5) continue;
    const owner = asAddress(row.value.owner, "Structure.owner");
    if (!owner) continue;
    const count = counts.get(gameId) ?? { players: new Set<string>(), realms: 0, villages: 0 };
    count.players.add(owner);
    if (category === 1) count.realms += 1;
    else count.villages += 1;
    counts.set(gameId, count);
  }
  return counts;
};

const gamesWithRealmOwnedByPlayer = (rows: FoldRow[], playerAddress: string | undefined): Set<number> => {
  if (!playerAddress) return new Set();
  return new Set(
    rows.flatMap((row) =>
      structureCategory(row) === 1 && asAddress(row.value.owner, "Structure.owner") === playerAddress
        ? [gameIdOf(row)]
        : [],
    ),
  );
};

const gamesRegisteredByPlayer = (rows: FoldRow[], playerAddress: string | undefined): Set<number> => {
  if (!playerAddress) return new Set();
  return new Set(
    rows.flatMap((row) =>
      asAddress(row.value.player, "BlitzSettlement.player") === playerAddress ? [gameIdOf(row)] : [],
    ),
  );
};

const buildGameEntry = (
  registry: Record<string, unknown>,
  worldConfig: Record<string, unknown> | undefined,
  structureCounts: { players: Set<string>; realms: number; villages: number } | undefined,
  playerState: { registered: boolean; settled: boolean } | null,
): HeraldGameDirectoryEntry => {
  const blitz = worldConfig ? asBoolean(worldConfig.blitz_mode_on, "WorldConfig.blitz_mode_on") : null;
  const registration = worldConfig
    ? asRecord(worldConfig.blitz_registration_config, "WorldConfig.blitz_registration_config")
    : null;
  const blitzSettlement = worldConfig
    ? asRecord(worldConfig.blitz_settlement_config, "WorldConfig.blitz_settlement_config")
    : null;
  const settlement = worldConfig ? asRecord(worldConfig.settlement_config, "WorldConfig.settlement_config") : null;

  return {
    clock: {
      end_at: asNumber(registry.end_at, "GameRegistry.end_at"),
      end_grace_seconds: asNumber(registry.end_grace_seconds, "GameRegistry.end_grace_seconds"),
      registration_grace_seconds: asNumber(
        registry.registration_grace_seconds,
        "GameRegistry.registration_grace_seconds",
      ),
      start_main_at: asNumber(registry.start_main_at, "GameRegistry.start_main_at"),
      start_settling_at: asNumber(registry.start_settling_at, "GameRegistry.start_settling_at"),
    },
    dev_mode_on: asBoolean(registry.dev_mode_on, "GameRegistry.dev_mode_on"),
    game_id: asNumber(registry.game_id, "GameRegistry.game_id"),
    mode: blitz === null ? null : blitz ? "blitz" : "eternum",
    name: decodeShortString(registry.name),
    player_count: structureCounts?.players.size ?? 0,
    player_state: playerState,
    preset_id: asNumber(registry.preset_id, "GameRegistry.preset_id"),
    registration: registration
      ? {
          count: asNumber(registration.registration_count, "WorldConfig.registration_count"),
          max: asNumber(registration.registration_count_max, "WorldConfig.registration_count_max"),
          start_at: asNumber(registration.registration_start_at, "WorldConfig.registration_start_at"),
        }
      : null,
    settled_realms_count: structureCounts?.realms ?? 0,
    settled_villages_count: structureCounts?.villages ?? 0,
    settlement:
      blitzSettlement && settlement
        ? {
            base_distance: asNumber(settlement.base_distance, "WorldConfig.settlement_config.base_distance"),
            layer_max: asNumber(settlement.layer_max, "WorldConfig.settlement_config.layer_max"),
            layers_skipped: asNumber(settlement.layers_skipped, "WorldConfig.settlement_config.layers_skipped"),
            map_center_offset: asNumber(worldConfig!.map_center_offset, "WorldConfig.map_center_offset"),
            single_realm_mode: asBoolean(
              blitzSettlement.single_realm_mode,
              "WorldConfig.blitz_settlement_config.single_realm_mode",
            ),
            spires_layer_distance: asNumber(
              settlement.spires_layer_distance,
              "WorldConfig.settlement_config.spires_layer_distance",
            ),
            spires_max_count: asNumber(settlement.spires_max_count, "WorldConfig.settlement_config.spires_max_count"),
            spires_settled_count: asNumber(
              settlement.spires_settled_count,
              "WorldConfig.settlement_config.spires_settled_count",
            ),
            two_player_mode: asBoolean(
              blitzSettlement.two_player_mode,
              "WorldConfig.blitz_settlement_config.two_player_mode",
            ),
          }
        : null,
    status: asStatus(registry.status),
  };
};

export const buildGameDirectory = (input: {
  chain: string;
  confirmedBlock: number;
  fold: GameDirectorySource;
  playerAddress?: string;
}): HeraldGameDirectory => {
  const configsByGame = rowsByGame(input.fold.modelRows("WorldConfig"));
  const structureRows = input.fold.modelRows("Structure");
  const structureCounts = countSettledStructures(structureRows);
  const playerSettledGames = gamesWithRealmOwnedByPlayer(structureRows, input.playerAddress);
  const playerRegisteredGames = input.playerAddress
    ? gamesRegisteredByPlayer(input.fold.modelRows("BlitzSettlement"), input.playerAddress)
    : new Set<number>();
  const games = input.fold
    .modelRows("GameRegistry")
    .map(({ value }) => {
      const gameId = asNumber(value.game_id, "GameRegistry.game_id");
      return buildGameEntry(
        value,
        configsByGame.get(gameId),
        structureCounts.get(gameId),
        input.playerAddress
          ? { registered: playerRegisteredGames.has(gameId), settled: playerSettledGames.has(gameId) }
          : null,
      );
    })
    .sort((left, right) => right.game_id - left.game_id);

  return {
    chain: input.chain,
    confirmed_block: input.confirmedBlock,
    games,
  };
};
