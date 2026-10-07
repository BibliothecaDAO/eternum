import { dayOf, seasonDays } from "@bibliothecadao/eternum/expeditions";
import type { FoldRow } from "../types";
import { integer, number, required, type Row } from "./values";

interface AllowanceWarning {
  event: "frontier_lords_allowance_80_percent";
  game_id: string;
  season_day: number;
  committed: string;
  allowance: string;
  remaining: string;
}

/** Observe confirmed commitments; a pre-confirmed roll must never alert operations. */
export class LordsAllowanceAlerts {
  private readonly warnedDays = new Map<string, number>();

  constructor(
    private readonly warn: (warning: AllowanceWarning) => void = (warning) => console.warn(JSON.stringify(warning)),
  ) {}

  public observe(modelRows: (model: string) => FoldRow[], confirmedTimestamp: number): void {
    for (const { value: budget } of modelRows("LordsBudget")) {
      const warning = buildAllowanceWarning(modelRows, budget, confirmedTimestamp);
      if (!warning || this.warnedDays.get(warning.game_id) === warning.season_day) continue;
      this.warn(warning);
      this.warnedDays.set(warning.game_id, warning.season_day);
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
  const startMainAt = number(game.start_main_at);
  const dayUnitSeconds = number(rules.day_unit_seconds);
  const day = dayOf({ seed: integer(game.seed), startMainAt, dayUnitSeconds }, timestamp)?.index;
  if (day === undefined) return;
  const chests = required(modelRows("ChestRules"), gameId, "ChestRules");
  const duration = BigInt(seasonDays(number(game.end_at) - startMainAt, dayUnitSeconds));
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
    season_day: day,
    committed: committed.toString(),
    allowance: allowance.toString(),
    remaining: (allowance - committed).toString(),
  };
}
