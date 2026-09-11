import {
  calculateUnregisteredShareholderPoints,
  createEmptyActivityBreakdown,
  type HeraldLeaderboard,
} from "@bibliothecadao/eternum/game-sync";
import type { FoldRow } from "./types";

/** Current scores come from the fold; history contributes only activity counts and breakdowns. */
export function buildLiveLeaderboard(
  modelRows: (model: string) => FoldRow[],
  gameId: string,
  timestamp: number,
  history: HeraldLeaderboard | null,
): HeraldLeaderboard {
  const id = BigInt(gameId);
  const rows = (model: string) => modelRows(model).map((row) => row.value);
  const gameRows = (model: string) => rows(model).filter((row) => BigInt(row.game_id as string) === id);
  const live = calculateUnregisteredShareholderPoints(
    {
      gameRegistry: gameRows("GameRegistry"),
      hyperstructures: gameRows("Hyperstructure"),
      presets: rows("PresetConfig"),
      shareholders: gameRows("HyperstructureShareholders"),
    },
    id,
    timestamp,
  );
  const points = new Map(live);
  for (const row of gameRows("PlayerRegisteredPoints")) {
    const address = normalizedAddress(row.address);
    points.set(address, (live.get(address) ?? 0) + Number(BigInt(row.registered_points as string)) / 1_000_000);
  }
  for (const row of gameRows("BlitzSettlement")) {
    const address = normalizedAddress(row.player);
    if (!points.has(address)) points.set(address, 0);
  }
  const activity = new Map(
    history?.entries.map((entry) => [normalizedAddress(entry.address), entry.activityBreakdown]),
  );
  const entries = [...points]
    .map(([address, totalPoints]) => ({
      address,
      totalPoints,
      rank: 0,
      activityBreakdown: activity.get(address) ?? createEmptyActivityBreakdown(),
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints || left.address.localeCompare(right.address));
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    entry.rank =
      index > 0 && entry.totalPoints === entries[index - 1].totalPoints ? entries[index - 1].rank : index + 1;
  }
  return { game_id: id.toString(), entries };
}

const normalizedAddress = (address: unknown): string => `0x${BigInt(address as string).toString(16)}`;
