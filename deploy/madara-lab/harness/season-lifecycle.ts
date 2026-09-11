import type { RpcProvider } from "starknet";
import { calculateUnregisteredShareholderPoints } from "../../../packages/core/src/sync/shareholder-points";
import type { HarnessAccount } from "./account-factory";
import { HeraldObserver } from "./herald-observer";
import { executeMadaraAndWait } from "./transactions";

export interface SeasonFinalizationEvidence {
  gameId: number;
  status: "closed" | "target-not-reached";
  pointsForWin: number;
  highestBotPoints: number;
  winner?: string;
  transactionHash?: string;
  endAt?: number;
}

export async function closeHarnessSeason(options: {
  accounts: HarnessAccount[];
  gameId: number;
  heraldUrl: string;
  provider: RpcProvider;
  seasonSystemAddress: string;
}): Promise<SeasonFinalizationEvidence> {
  const observer = new HeraldObserver(options.heraldUrl, "madara");
  const { models, pointsForWin } = await readSeasonTarget(observer, options.gameId);
  const block = await options.provider.getBlock("latest");
  const scores = readScores(models, options.gameId, Number(block.timestamp));
  const candidates = options.accounts
    .map((account) => ({ account, points: scores.get(normalize(account.address)) ?? 0 }))
    .sort((a, b) => b.points - a.points);
  const leader = candidates[0];
  const evidence: SeasonFinalizationEvidence = {
    gameId: options.gameId,
    status: "target-not-reached",
    pointsForWin,
    highestBotPoints: leader?.points ?? 0,
  };
  if (!leader || leader.points < pointsForWin) return evidence;

  const transactionHash = await executeMadaraAndWait(
    leader.account.account,
    {
      contractAddress: options.seasonSystemAddress,
      entrypoint: "season_close",
      calldata: [options.gameId.toString()],
    },
    `close Eternum game ${options.gameId}`,
  );
  const endAt = await verifyClosedSeason(observer, options.gameId);
  return { ...evidence, status: "closed", winner: leader.account.address, transactionHash, endAt };
}

async function readSeasonTarget(observer: HeraldObserver, gameId: number) {
  const models = await observer.readModelRows(gameId, [
    "GameRegistry",
    "PresetConfig",
    "Hyperstructure",
    "HyperstructureShareholders",
    "PlayerRegisteredPoints",
  ]);
  const game = models.get("GameRegistry")![0];
  if (!game || game.dev_mode_on !== false) throw new Error("Eternum lifecycle verification requires dev mode off");
  const preset = models
    .get("PresetConfig")!
    .find((row) => BigInt(row.preset_id as string) === BigInt(game.preset_id as string));
  const winConfig = preset?.victory_points_win_config as { points_for_win?: string } | undefined;
  if (!winConfig?.points_for_win || BigInt(winConfig.points_for_win) <= 0n)
    throw new Error("Eternum victory target is missing");
  const pointsForWin = Number(BigInt(winConfig.points_for_win)) / 1_000_000;
  return { models, pointsForWin };
}

async function verifyClosedSeason(observer: HeraldObserver, gameId: number): Promise<number> {
  const final = await observer.waitForModelRows(
    gameId,
    ["GameRegistry", "PlayerRegisteredPoints", "SeasonPrize", "Hyperstructure", "HyperstructureShareholders"],
    (rows) => rows.get("GameRegistry")!.some(isEnded),
    120_000,
  );
  const endAt = Number(final.get("GameRegistry")![0].end_at);
  const total = final
    .get("PlayerRegisteredPoints")!
    .reduce((sum, row) => sum + BigInt(row.registered_points as string), 0n);
  const pool = final.get("SeasonPrize")![0];
  if (!pool || total !== BigInt(pool.total_registered_points as string))
    throw new Error("Final registered points do not match the season total");
  const completed = new Set(
    final
      .get("Hyperstructure")!
      .filter((row) => row.completed === true)
      .map((row) => String(row.hyperstructure_id)),
  );
  if (
    final
      .get("HyperstructureShareholders")!
      .some((row) => completed.has(String(row.hyperstructure_id)) && Number(row.start_at) < endAt)
  )
    throw new Error("Finalization left unregistered shareholder points");
  return endAt;
}

function isEnded(row: Record<string, unknown>): boolean {
  return row.status === "Ended" || (typeof row.status === "object" && row.status !== null && "Ended" in row.status);
}

function readScores(
  models: Map<string, Record<string, unknown>[]>,
  gameId: number,
  timestamp: number,
): Map<string, number> {
  const pending = calculateUnregisteredShareholderPoints(
    {
      gameRegistry: models.get("GameRegistry")!,
      presets: models.get("PresetConfig")!,
      hyperstructures: models.get("Hyperstructure")!,
      shareholders: models.get("HyperstructureShareholders")!,
    },
    gameId,
    timestamp,
  );
  const scores = new Map(pending);
  for (const row of models.get("PlayerRegisteredPoints")!) {
    const address = normalize(String(row.address));
    scores.set(address, (pending.get(address) ?? 0) + Number(BigInt(row.registered_points as string)) / 1_000_000);
  }
  return scores;
}

const normalize = (address: string) => `0x${BigInt(address).toString(16)}`;
