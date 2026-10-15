import { memo } from "react";
import { commandArt } from "@/ui/design-system/painted/hud-art";
import { type StructureAction, useStructureActions } from "./use-structure-actions";

export const StructureActionsPanel = memo(() => {
  const actions = useStructureActions();
  return actions ? <StructureActionsPanelView actions={actions} /> : null;
});
StructureActionsPanel.displayName = "StructureActionsPanel";

export function StructureActionsPanelView({ actions }: { actions: StructureAction[] }) {
  return (
    <nav className="action-dock" aria-label="Realm actions" data-group="Realm actions">
      {actions.map((action) => (
        <ActionTile key={action.id} action={action} variant="panel" />
      ))}
      {actions[0]?.refusal && <p role="status">{actions[0].refusal}</p>}
    </nav>
  );
}

export function ActionTile({ action, variant }: { action: StructureAction; variant: "panel" | "compact" }) {
  return (
    <button
      type="button"
      data-notice
      data-command={action.id}
      data-variant={variant}
      data-popover-anchor={action.id === "transfer" ? "logistics" : action.id === "trade" ? "market" : action.id}
      aria-label={action.label}
      aria-pressed={action.active}
      disabled={action.refusal !== null}
      title={action.refusal ?? undefined}
      onClick={action.onClick}
    >
      <span className="action-circle">
        <img src={commandArt[action.id]} alt="" />
      </span>
      <span>{action.label}</span>
      {action.badges
        ?.filter((badge) => badge.count > 0)
        .map((badge) => (
          <small key={badge.tone} aria-label={`${badge.count} ${badge.tone}`}>
            {badge.count}
          </small>
        ))}
    </button>
  );
}
