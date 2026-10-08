import type { FoldRow } from "../types";
import { integer, type Row } from "./values";

interface CeilingWarning {
  event: "frontier_lords_ceiling_80_percent";
  game_id: string;
  day: string;
  spent: string;
  ceiling: string;
  pool_left: string;
}

/**
 * Observe confirmed budgets: once a day's chests hold 80% of its surge ceiling, the next ruins that day are about to be
 * refused. A pre-confirmed roll must never alert operations.
 */
export class LordsCeilingAlerts {
  private readonly warnedDays = new Map<string, string>();

  constructor(
    private readonly warn: (warning: CeilingWarning) => void = (warning) => console.warn(JSON.stringify(warning)),
  ) {}

  public observe(modelRows: (model: string) => FoldRow[]): void {
    for (const { value: budget } of modelRows("LordsBudget")) {
      const warning = buildCeilingWarning(budget);
      if (!warning || this.warnedDays.get(warning.game_id) === warning.day) continue;
      this.warn(warning);
      this.warnedDays.set(warning.game_id, warning.day);
    }
  }
}

function buildCeilingWarning(budget: Row): CeilingWarning | undefined {
  const spent = integer(budget.spent);
  const ceiling = integer(budget.ceiling);
  if (spent < 0n || spent > ceiling) throw new Error("Frontier LORDS chests exceed the day's ceiling");
  if (ceiling === 0n || 5n * spent < 4n * ceiling) return;
  return {
    event: "frontier_lords_ceiling_80_percent",
    game_id: integer(budget.game_id).toString(),
    day: integer(budget.day).toString(),
    spent: spent.toString(),
    ceiling: ceiling.toString(),
    pool_left: integer(budget.pool_left).toString(),
  };
}
