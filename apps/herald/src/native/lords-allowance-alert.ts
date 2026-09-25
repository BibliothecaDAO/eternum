import { absoluteEpoch, seasonDay } from "@bibliothecadao/eternum/expeditions";
import type { FoldRow } from "../types";
import { integer, number, required, type Row } from "./values";

interface AllowanceWarning {
  event: "frontier_lords_allowance_80_percent";
  game_id: string;
  absolute_epoch: number;
  season_day: number;
  committed: string;
  allowance: string;
  remaining: string;
}

/** Observe confirmed commitments; a pre-confirmed roll must never alert operations. */
export class LordsAllowanceAlerts {
  private readonly warnedEpochs = new Map<string, number>();

  constructor(
    private readonly warn: (warning: AllowanceWarning) => void = (warning) => console.warn(JSON.stringify(warning)),
  ) {}

  public observe(modelRows: (model: string) => FoldRow[], confirmedTimestamp: number): void {
    for (const { value: budget } of modelRows("LordsBudget")) {
      const warning = buildAllowanceWarning(modelRows, budget, confirmedTimestamp);
      if (!warning || this.warnedEpochs.get(warning.game_id) === warning.absolute_epoch) continue;
      this.warn(warning);
      this.warnedEpochs.set(warning.game_id, warning.absolute_epoch);
    }
  }
}

function buildAllowanceWarning(
  modelRows: (model: string) => FoldRow[],
  budget: Row,
  timestamp: number,
): AllowanceWarning | undefined {
  const gameId = integer(budget.game_id).toString();
  const game = required(modelRows("GameRegistry"), gameId, "GameRegistry");
  const rules = required(modelRows("SliceRules"), gameId, "SliceRules");
  const clock = { epochSeconds: number(rules.epoch_seconds), startMainAt: number(game.start_main_at) };
  if (timestamp < clock.startMainAt) return;
  const day = seasonDay(clock, timestamp);
  const chests = required(modelRows("ChestRules"), gameId, "ChestRules");
  const duration = integer(chests.season_epochs);
  const pool = integer(chests.lords_pool);
  if (duration <= 0n || pool <= 0n) throw new Error("Invalid Frontier LORDS budget rules");
  const released = BigInt(day + 1) < duration ? BigInt(day + 1) : duration;
  const allowance = (pool * released) / duration;
  const committed = integer(budget.lords_committed);
  if (committed < 0n || committed > allowance) throw new Error("Frontier LORDS commitment exceeds allowance");
  if (allowance === 0n || 5n * committed < 4n * allowance) return;
  return {
    event: "frontier_lords_allowance_80_percent",
    game_id: gameId,
    absolute_epoch: absoluteEpoch(clock, timestamp),
    season_day: day,
    committed: committed.toString(),
    allowance: allowance.toString(),
    remaining: (allowance - committed).toString(),
  };
}
