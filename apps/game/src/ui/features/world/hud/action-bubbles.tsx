import { HudBubble, HudNotice } from "@/ui/design-system/kit/hud-elements";
import {
  type StructureAction,
  useStructureActions,
} from "@/ui/features/world/containers/left-facets/use-structure-actions";
import { ORDER_KEYS } from "./hud-keys";

/**
 * Build, Production, Military and Transfer (and Trade where the game has a market) for the selected holding of the
 * player's, as the sheet's round bubbles floating over the map, each word under its bubble. Before play opens they stay
 * shown, shut, with the reason above them.
 */
export const ActionBubbles = () => {
  const actions = useStructureActions();
  if (!actions) return null;
  const refusal = actions[0]?.refusal ?? null;
  return (
    <div className="pointer-events-none flex flex-col items-center gap-2">
      {refusal && <HudNotice line={refusal} />}
      <nav aria-label="Structure actions" className="pointer-events-auto flex items-start gap-3">
        {actions.map((action) => (
          <ActionBubble key={action.id} action={action} />
        ))}
      </nav>
    </div>
  );
};

/** One action: lit while its window is open; on its rim what has arrived to collect (good), else what is on its way. */
const ActionBubble = ({ action }: { action: StructureAction }) => {
  const ready = action.badges?.find((badge) => badge.tone === "ready")?.count ?? 0;
  const pending = action.badges?.find((badge) => badge.tone === "pending")?.count ?? 0;
  return (
    <HudBubble
      icon={action.id}
      word={action.label}
      count={ready > 0 ? ready : pending}
      countTone={ready > 0 ? "good" : undefined}
      pressed={action.active}
      disabled={action.refusal !== null}
      aria-label={action.label}
      aria-keyshortcuts={ORDER_KEYS[action.id]}
      data-popover-anchor={action.id === "trade" ? "market" : action.id}
      data-tip={action.refusal ?? undefined}
      onClick={action.onClick}
    />
  );
};
