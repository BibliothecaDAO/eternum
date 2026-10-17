import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  type StructureAction,
  useStructureActions,
} from "@/ui/features/world/containers/left-facets/use-structure-actions";
import { ORDER_KEYS } from "./hud-keys";
import { Medallion } from "./medallion";

/**
 * Build, Production, Military and Transfer (and Trade where the game has a market) for the selected holding of the
 * player's, as round bubbles floating over the map, each word under its bubble. Before play opens they stay shown,
 * shut, with the reason above them.
 */
export const ActionBubbles = ({ className }: { className?: string }) => {
  const actions = useStructureActions();
  if (!actions) return null;
  const refusal = actions[0]?.refusal ?? null;
  return (
    <div className={cn("pointer-events-none flex flex-col items-center gap-2", className)}>
      {refusal && (
        <p role="status" className="rounded-full bg-kit-plate px-3 py-1 text-sm font-semibold text-kit-gold">
          {refusal}
        </p>
      )}
      <nav aria-label="Structure actions" className="flex items-start gap-3">
        {actions.map((action) => (
          <ActionBubble key={action.id} action={action} />
        ))}
      </nav>
    </div>
  );
};

const ActionBubble = ({ action }: { action: StructureAction }) => {
  const key = ORDER_KEYS[action.id];
  const ready = action.badges?.find((badge) => badge.tone === "ready")?.count ?? 0;
  const pending = action.badges?.find((badge) => badge.tone === "pending")?.count ?? 0;
  return (
    <button
      type="button"
      data-popover-anchor={action.id === "trade" ? "market" : action.id}
      aria-label={action.label}
      aria-pressed={action.active}
      disabled={action.refusal !== null}
      data-tip={action.refusal ?? undefined}
      aria-keyshortcuts={key}
      onClick={action.onClick}
      className="hud-bubble"
    >
      <Medallion
        icon={action.id}
        size="lg"
        tone={action.active ? "lit" : ready > 0 ? "ready" : "plain"}
        corner={ready > 0 ? ready : pending > 0 ? pending : undefined}
      />
      <span>{action.label}</span>
    </button>
  );
};
