import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY, HUD_BODY_MUTED, HUD_LABEL, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { ProductionModal } from "@/ui/features/settlement";
import { useRealmActions } from "@/ui/modules/entity-details/hooks/use-realm-actions";
import { Position } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { type ID } from "@bibliothecadao/types";
import Lightbulb from "lucide-react/dist/esm/icons/lightbulb";
import { memo, useCallback, useMemo, useState } from "react";
import { type EmpireSuggestion, useEmpireSuggestions } from "./use-empire-suggestions";

const DEFAULT_VISIBLE_SUGGESTIONS = 6;

const SuggestionChip = ({
  suggestion,
  onClick,
  isPending,
}: {
  suggestion: EmpireSuggestion;
  onClick: (suggestion: EmpireSuggestion) => void;
  isPending: boolean;
}) => {
  const Icon = suggestion.icon;
  const isPrimary = suggestion.emphasis === "primary";

  return (
    <button
      type="button"
      onClick={() => onClick(suggestion)}
      disabled={isPending}
      title={suggestion.reason}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition",
        isPrimary
          ? "border-gold/60 bg-gold/10 hover:border-gold hover:bg-gold/20 shadow-[0_0_10px_rgba(223,170,84,0.18)]"
          : "border-gold/20 bg-black/30 hover:border-gold/40 hover:bg-black/40",
        isPending && "cursor-not-allowed opacity-60 hover:bg-transparent",
      )}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", isPrimary ? "text-gold" : "text-gold/70")} />
      <span className="min-w-0 flex-1">
        <span className={cn("block leading-tight", isPrimary ? HUD_VALUE : HUD_BODY)}>
          <span className="text-gold/55">{suggestion.realmName}</span>
          <span className="text-gold/40"> · </span>
          {suggestion.label}
        </span>
        {suggestion.reason && (
          <span className={cn("block leading-tight not-italic text-gold/55", HUD_BODY_MUTED)}>
            {suggestion.reason}
          </span>
        )}
      </span>
    </button>
  );
};

/**
 * Empire-wide Suggested Actions panel. Lives directly under the structure
 * list in the left rail — surfaces the top suggestions across every owned
 * realm so the player has one mission-control list, not a per-card recap.
 *
 * Each chip:
 *  1. Selects that realm as the active structure (camera + state).
 *  2. Fires the appropriate action: upgrade / provision / multicall directly,
 *     or open the right modal (Military, Construction, Production).
 */
export const EmpireSuggestions = memo(() => {
  const suggestions = useEmpireSuggestions();
  const { setup } = useDojo();
  const { isMapView } = useQuery();
  const goToStructure = useGoToStructure(setup);

  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const { fireUpgrade, fireProvision, fireUpgradeAndProvision, pendingRealmId } = useRealmActions();
  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(
    () => (showAll ? suggestions : suggestions.slice(0, DEFAULT_VISIBLE_SUGGESTIONS)),
    [showAll, suggestions],
  );

  const focusRealm = useCallback(
    (realmId: ID) => {
      const target = playerStructures.find((structure) => structure.entityId === realmId);
      const coords = target?.structure?.base;
      if (coords && coords.coord_x !== undefined && coords.coord_y !== undefined) {
        const col = Number(coords.coord_x);
        const row = Number(coords.coord_y);
        if (Number.isFinite(col) && Number.isFinite(row)) {
          setSelectedHex({ col, row });
        }
        void goToStructure(
          realmId,
          new Position({ x: coords.coord_x, y: coords.coord_y }),
          isMapView,
        );
      } else {
        setStructureEntityId(realmId);
      }
    },
    [goToStructure, isMapView, playerStructures, setSelectedHex, setStructureEntityId],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: EmpireSuggestion) => {
      focusRealm(suggestion.realmId);

      switch (suggestion.action) {
        case "upgrade-and-provision":
          void fireUpgradeAndProvision(suggestion.realmId);
          return;
        case "upgrade":
          void fireUpgrade(suggestion.realmId);
          return;
        case "provision":
          void fireProvision(suggestion.realmId);
          return;
        case "garrison":
          setLeftNavigationView(LeftView.MilitaryView);
          return;
        case "build-first":
        case "expand-population":
          setLeftNavigationView(LeftView.ConstructionView);
          return;
        default:
          toggleModal(<ProductionModal preSelectedRealmId={Number(suggestion.realmId)} />);
      }
    },
    [
      fireProvision,
      fireUpgrade,
      fireUpgradeAndProvision,
      focusRealm,
      setLeftNavigationView,
      toggleModal,
    ],
  );

  const hiddenCount = Math.max(suggestions.length - DEFAULT_VISIBLE_SUGGESTIONS, 0);

  return (
    <InfoBubble title="Suggested actions" icon={Lightbulb} cue={`${suggestions.length}`}>
      {suggestions.length === 0 ? (
        <p className={HUD_BODY_MUTED}>No suggestions right now — empire looks healthy.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map((suggestion) => (
            <SuggestionChip
              key={suggestion.id}
              suggestion={suggestion}
              onClick={handleSuggestionClick}
              isPending={pendingRealmId === suggestion.realmId}
            />
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className={cn(
                "mt-1 self-center rounded border border-gold/20 bg-black/30 px-2 py-1 transition hover:border-gold/40 hover:text-gold",
                HUD_LABEL,
              )}
            >
              {showAll ? "Show fewer" : `Show ${hiddenCount} more`}
            </button>
          )}
        </div>
      )}
    </InfoBubble>
  );
});

EmpireSuggestions.displayName = "EmpireSuggestions";
