import type { HeraldFrontierLeaderboard, HeraldFrontierPrizeBoard } from "@bibliothecadao/eternum/game-sync";
import type { HistoryStore } from "../history-store";
import { buildFrontierLeaderboard, prizeOf } from "./frontier-leaderboard";
import { frontierCompetitionCutoff } from "@bibliothecadao/eternum/game-sync";
import type { FoldRow } from "../types";
import { integer, number } from "./values";

export function competitionOf(chain: string, modelRows: (model: string) => FoldRow[]) {
  return modelRows("GameRegistry").flatMap(({ value: game }) => {
    const cutoff = frontierCompetitionCutoff(chain, number(game.game_id), {
      presetId: Number(game.preset_id),
      start: Number(game.start_main_at),
      seed: String(game.seed),
    });
    return cutoff === undefined ? [] : [{ game_id: integer(game.game_id).toString(), cutoff }];
  });
}

/** Capture current facts before SQL awaits; historical standings and current award status have separate authority. */
export async function readFrontierCompetitionBoard(input: {
  chain: string;
  gameId: string;
  head: number;
  confirmedAt: number | null;
  modelRows: (model: string) => FoldRow[];
  history: Pick<HistoryStore, "frontierHistory" | "frontierPrizeBoard">;
}): Promise<HeraldFrontierLeaderboard> {
  const facts = new Map(
    ["GameRegistry", "Structure", "CampaignHome", "FrontierPrize", "ChestRules", "LordsWithdrawal"].map((model) => [
      model,
      input.modelRows(model),
    ]),
  );
  const read = (model: string) => facts.get(model) ?? [];
  const competition = competitionOf(input.chain, read).find((item) => item.game_id === input.gameId);
  if (competition && input.confirmedAt === null) throw new Error("Competition clock unavailable");
  if (competition && input.confirmedAt !== null && input.confirmedAt >= competition.cutoff) {
    const frozen = await input.history.frontierPrizeBoard(input.gameId, competition.cutoff);
    return frozenLeaderboard(read, competition, input.confirmedAt, frozen);
  }
  const history = await input.history.frontierHistory(input.gameId, input.head);
  const board = buildFrontierLeaderboard(read, input.gameId, history);
  if (competition && input.confirmedAt !== null)
    board.competition = { status: "live", confirmed_at: input.confirmedAt, cutoff: competition.cutoff };
  return board;
}

function frozenLeaderboard(
  read: (model: string) => FoldRow[],
  competition: { game_id: string; cutoff: number },
  confirmedAt: number,
  frozen: HeraldFrontierPrizeBoard | null,
): HeraldFrontierLeaderboard {
  return {
    mode: "frontier",
    game_id: competition.game_id,
    entries: frozen?.entries ?? [],
    prize: prizeOf(read, competition.game_id),
    competition: frozen
      ? {
          status: "final",
          confirmed_at: confirmedAt,
          cutoff: frozen.cutoff,
          confirmed_block: frozen.confirmed_block,
          block_hash: frozen.block_hash,
        }
      : { status: "confirming", confirmed_at: confirmedAt, cutoff: competition.cutoff },
  };
}
