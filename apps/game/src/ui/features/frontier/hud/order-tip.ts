import { computeEffectiveStaminaCost } from "@/hooks/exploration-automation-planner";
import { formatExact } from "@/ui/design-system/kit/amount";
import { ARMY, ATTACK, EXPLORE, MOVE, STAMINA, TRANSFER, UNEXPLORED } from "@/ui/design-system/kit/words";
import { type ActionPath, ActionPaths, ActionType } from "@bibliothecadao/eternum";

/**
 * What a highlighted tile is, in one line, before any click: the order the selected army has there and the stamina
 * it costs. The map's highlight colours mean these and nothing else; the tooltip is their legend.
 */
export const orderTipLine = ({
  path,
  target,
  exploreStamina,
}: {
  path: ActionPath[] | undefined;
  /** What stands on the tile, as its card names it; an army when it is no site. */
  target: string | null;
  exploreStamina: number;
}): string | null => {
  if (!path || path.length < 2) return null;
  const actionType = ActionPaths.getActionType(path);
  const stamina = `${formatExact(computeEffectiveStaminaCost(path.slice(1), actionType, exploreStamina))} ${STAMINA}`;
  if (actionType === ActionType.Explore) return [UNEXPLORED, EXPLORE, stamina].join(SEPARATOR);
  if (actionType === ActionType.Move) return [MOVE, stamina].join(SEPARATOR);
  if (actionType === ActionType.Attack) return [target ?? ARMY, ATTACK, stamina].join(SEPARATOR);
  if (actionType === ActionType.Help) return [target ?? ARMY, TRANSFER].join(SEPARATOR);
  return null;
};

const SEPARATOR = " · ";
