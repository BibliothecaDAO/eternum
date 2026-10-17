import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { Transaction } from "@/hooks/store/use-transaction-store";
import { formatTilePanelTitle } from "@/ui/features/world/components/bottom-right-panel/tile-panel-title";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { feltEquals } from "@bibliothecadao/eternum/game-client";
import { TransactionType } from "@bibliothecadao/provider";
import type { PointsGrants } from "@/ui/features/world/hud/points-goal";

/**
 * What an Events row says happened: not only the action, but what came of it, in points and goods, so the player
 * learns what scores from what they did ("Explored · (4, 6): +5 points, +200 Essence"; "Army lost: 1,000 Knights").
 * The points grants are read only by a row that scores, as the game's rules set them.
 */

/** A done explore whose find, if any, has not arrived: the points every explore scores. */
export const sendOutcome = (transaction: Transaction, grants: () => PointsGrants): string | null =>
  transaction.type === TransactionType.EXPLORE && transaction.status === "success"
    ? `Explored: +${grants().exploreTile.toLocaleString()} points`
    : null;

/** A story's row with its outcome, for the stories whose outcome is worth a line; null keeps the story's own words. */
export const storyOutcome = (event: ProcessedStoryEvent, grants: () => PointsGrants): string | null => {
  const payload = event.storyPayload;
  switch (event.story) {
    case "ExplorationReward":
      return `${exploredTile(payload.coord)}: +${grants().exploreTile.toLocaleString()} points, ${event.presentation.title}`;
    case "RelicChestOpened":
      return `${event.presentation.title} · +${grants().openRelicCrate.toLocaleString()} points`;
    case "StructureCapturedStory":
      return captureLine(event, Number(payload.points ?? 0));
    default:
      return null;
  }
};

const exploredTile = (coord: unknown): string => {
  const { x, y } = (coord ?? {}) as { x?: unknown; y?: unknown };
  return x === undefined || y === undefined
    ? "Explored"
    : formatTilePanelTitle("Explored", { col: Number(x), row: Number(y) });
};

/** Who took what, what went with it, and the points it paid (taking a camp, rift or Hyperstructure from The Vanguard). */
const captureLine = (event: ProcessedStoryEvent, points: number): string =>
  [event.presentation.title, event.presentation.description, points > 0 ? `+${points.toLocaleString()} points` : null]
    .filter(Boolean)
    .join(" · ");

const TROOP_PLURALS: Record<string, string> = { Knight: "Knights", Paladin: "Paladins", Crossbowman: "Crossbowmen" };

/** The viewer's side of a fight, when it fell: "Army lost: 1,000 Knights". Null when it stood, or is not theirs. */
export const lostArmyLine = (payload: Record<string, unknown>, viewer: string | null): string | null => {
  const side = [payload.attacker, payload.defender].find(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && feltEquals((entry as Record<string, unknown>).player, viewer),
  );
  if (!side || BigInt(String(side.after ?? 1)) !== 0n) return null;
  const troops = divideByPrecision(Number(side.before ?? 0)).toLocaleString();
  const category = String(side.category ?? "");
  return `Army lost: ${troops} ${TROOP_PLURALS[category] ?? "troops"}`;
};
