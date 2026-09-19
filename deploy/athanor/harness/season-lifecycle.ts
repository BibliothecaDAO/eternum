import { completeNativeBatches, type BatchTransactionReceipt } from "@bibliothecadao/provider";
import { LeaderboardManager, type GameClient } from "@bibliothecadao/eternum";
import type { HarnessProvider } from "./provider";
import type { HarnessAccount } from "./account-factory";
import type { HarnessGame } from "./harness-game";
import { trackTransaction } from "./driver";

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
  client: GameClient;
  game: HarnessGame;
  provider: HarnessProvider;
}): Promise<SeasonFinalizationEvidence> {
  const { client, game } = options;
  const { store } = client.setup;
  const game_id = client.gameId;
  const clock = store.require("GameRegistry", { game_id });
  if (clock.dev_mode_on) throw new Error("Eternum lifecycle verification requires dev mode off");
  const threshold = store.require("SeasonWinThreshold", { game_id }).points;
  if (threshold <= 0n) throw new Error("Eternum victory target is missing");
  const pointsForWin = Number(threshold) / 1_000_000;
  const scores = new LeaderboardManager(store).pointsPerPlayer;
  const leader = options.accounts
    .map((account) => ({ account, points: scores.get(BigInt(account.address)) ?? 0 }))
    .sort((a, b) => b.points - a.points)[0];
  const evidence: SeasonFinalizationEvidence = {
    gameId: game_id,
    status: "target-not-reached",
    pointsForWin,
    highestBotPoints: leader?.points ?? 0,
  };
  if (!leader || leader.points < pointsForWin) return evidence;
  const signer = leader.account.account;
  const transaction = await completeNativeBatches(async () => {
    let applied: Promise<BatchTransactionReceipt> | undefined;
    const tracked = await trackTransaction({
      botId: leader.account.botId,
      gameId: game_id,
      provider: options.provider,
      kind: "season_close",
      stage: "setup",
      send: () =>
        game.submit(signer, () => {
          applied = client.setup.systemCalls.end_game({ signer });
          return applied;
        }),
    });
    if (tracked.outcome !== "completed") throw new Error(`Season close failed: ${tracked.error ?? tracked.outcome}`);
    if (!applied) throw new Error("Season close did not submit a command");
    return { ...tracked, remaining: (await applied).remaining };
  });
  const endAt = await game.waitFor(
    () => {
      const ended = store.require("GameRegistry", { game_id });
      return ended.end_at < clock.end_at ? Number(ended.end_at) : undefined;
    },
    120_000,
    () => `Closed season ${game_id}`,
  );
  const total = [...store.inGame("PlayerPoints", game_id)].reduce((sum, row) => sum + row.points, 0n);
  if (store.require("PointsTotal", { game_id }).total !== total)
    throw new Error("Final registered points do not match the season total");
  return {
    ...evidence,
    status: "closed",
    winner: leader.account.address,
    transactionHash: transaction.transactionHash,
    endAt,
  };
}
