import { decodeHyperstructureShares } from "../utils/hyperstructure-shareholders";

interface ShareholderPointRows {
  gameRegistry: readonly Record<string, unknown>[];
  hyperstructures: readonly Record<string, unknown>[];
  presets: readonly Record<string, unknown>[];
  shareholders: readonly Record<string, unknown>[];
}

const POINTS_PRECISION = 1_000_000n;
const SHARE_BASIS_POINTS = 10_000n;

const scalar = (value: unknown, field: string): bigint => {
  if (!["bigint", "number", "string"].includes(typeof value)) {
    throw new Error(`${field} is not a scalar`);
  }
  try {
    return BigInt(value as bigint | number | string);
  } catch {
    throw new Error(`${field} is not an integer`);
  }
};

const record = (value: unknown, field: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${field} is not a record`);
  }
  return value as Record<string, unknown>;
};

const normalizeAddress = (value: bigint): string => `0x${value.toString(16)}`;

const gameClock = (rows: ShareholderPointRows, gameId: bigint, nowSeconds: number) => {
  const game = rows.gameRegistry.find((row) => scalar(row.game_id, "GameRegistry.game_id") === gameId);
  if (!game) throw new Error(`GameRegistry row missing for game ${gameId}`);
  const endAt = scalar(game.end_at, "GameRegistry.end_at");
  const now = BigInt(Math.floor(nowSeconds));
  return {
    currentTimestamp: endAt > 0n && now >= endAt ? endAt : now,
    presetId: scalar(game.preset_id, "GameRegistry.preset_id"),
  };
};

const pointsPerSecond = (rows: ShareholderPointRows, presetId: bigint): bigint => {
  const preset = rows.presets.find((row) => scalar(row.preset_id, "PresetConfig.preset_id") === presetId);
  if (!preset) throw new Error(`PresetConfig row missing for preset ${presetId}`);
  const grant = record(preset.victory_points_grant_config, "PresetConfig.victory_points_grant_config");
  return scalar(grant.hyp_points_per_second, "VictoryPointsGrantConfig.hyp_points_per_second");
};

const hyperstructureMultipliers = (rows: ShareholderPointRows, gameId: bigint): Map<string, bigint> =>
  new Map(
    rows.hyperstructures
      .filter((row) => scalar(row.game_id, "Hyperstructure.game_id") === gameId)
      .map((row) => [
        scalar(row.hyperstructure_id, "Hyperstructure.hyperstructure_id").toString(),
        scalar(row.points_multiplier, "Hyperstructure.points_multiplier"),
      ]),
  );

export const calculateUnregisteredShareholderPoints = (
  rows: ShareholderPointRows,
  gameIdInput: bigint | number | string,
  nowSeconds: number = Date.now() / 1_000,
): ReadonlyMap<string, number> => {
  if (rows.shareholders.length === 0) return new Map();
  const gameId = BigInt(gameIdInput);
  const clock = gameClock(rows, gameId, nowSeconds);
  const basePointsPerSecond = pointsPerSecond(rows, clock.presetId);
  const multipliers = hyperstructureMultipliers(rows, gameId);
  const points = new Map<string, number>();

  for (const row of rows.shareholders) {
    if (scalar(row.game_id, "HyperstructureShareholders.game_id") !== gameId) continue;
    const hyperstructureId = scalar(row.hyperstructure_id, "HyperstructureShareholders.hyperstructure_id").toString();
    const multiplier = multipliers.get(hyperstructureId);
    if (multiplier === undefined) throw new Error(`Hyperstructure row missing for shareholders ${hyperstructureId}`);
    const elapsed = clock.currentTimestamp - scalar(row.start_at, "HyperstructureShareholders.start_at");
    if (elapsed <= 0n) continue;
    const shares = new Map<string, bigint>();
    decodeHyperstructureShares(row.shareholders).forEach(({ playerAddress, basisPoints }) => {
      const address = normalizeAddress(playerAddress);
      shares.set(address, (shares.get(address) ?? 0n) + basisPoints);
    });
    for (const [address, basisPoints] of shares) {
      const earned =
        (basePointsPerSecond * multiplier * basisPoints * elapsed) / (POINTS_PRECISION * SHARE_BASIS_POINTS);
      points.set(address, (points.get(address) ?? 0) + Number(earned));
    }
  }

  return points;
};
