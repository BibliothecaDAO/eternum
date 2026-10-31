import type { RealmSkin } from "@/three/structures/realm-skins";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { heldAgainstNeed } from "@/ui/design-system/kit/words";
import { describeCastleLevel } from "@/ui/modules/entity-details/realm/castle-level";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { HudButton, HudIconButton } from "@/ui/design-system/kit/hud-elements";
import { type RealmLevelUp, useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { formatIncomingEta } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { ID, type Structure, formatExact, resourceName } from "@bibliothecadao/types";
import clsx from "clsx";

import { type MouseEvent } from "react";

export type StructureWithMetadata = Structure & {
  displayName: string;
  originalName: string;
  realmLevel: number;
  realmSkin?: RealmSkin;
  realmLevelLabel: string | null;
  population: number;
  guardCount: number | undefined;
  /** Field armies alive today; an army from an earlier expedition day is dead by rule and never counts. */
  explorerCount: number;
  populationCapacity: number;
  buildingTilesOccupied: number | null;
  buildingTilesTotal: number | null;
  isFavorite: boolean;
  canUpgrade: boolean;
  /**
   * Per-building-type counts read off StructureBuildings.packed_counts_*. Used
   * by the suggestion engine to recommend construction targets (wheat farms,
   * resource farms, worker huts) without extra read calls.
   */
  buildingCounts: {
    wheat: number;
    wood: number;
    coal: number;
    copper: number;
    crossbowmanT1: number;
    knightT1: number;
    market: number;
    paladinT1: number;
    workerHut: number;
  };
};

/**
 * What a realm's next level asks for and gives: why the step cannot be taken now (when it cannot), each cost against
 * what the realm holds and what is on its way, or that it costs nothing, and what the level brings. Never a blank.
 */
export const LevelUpRequirements = ({ step }: { step: RealmLevelUp }) => {
  if (step.mode === "max") {
    return <div className="text-hud-body text-hud-muted">Castle fully upgraded.</div>;
  }

  return (
    <div className="min-w-56 space-y-2 text-hud-ink">
      <div className="flex items-center justify-between">
        <span className="text-hud-body text-hud-muted">Upgrade</span>
        {step.nextLevelName && <span className="text-hud-body text-hud-muted">to {step.nextLevelName}</span>}
      </div>
      {step.refusal && <p className="text-hud-body text-hud-bad">{step.refusal}</p>}
      {step.requirements.length === 0 && <p className="text-hud-body text-hud-ink">Nothing to pay for this level.</p>}
      <div className="space-y-1">
        {step.requirements.map((req) => {
          const isMet = req.current !== undefined && req.current >= req.amount;
          return (
            <div
              key={`${req.resource}-${req.amount}`}
              className={clsx("rounded border px-2 py-1", isMet ? "border-hud-divider bg-hud-hover" : "border-hud-bad")}
            >
              <div className="flex items-center gap-2">
                <ResourceIcon resource={req.resource} size="xs" withTooltip={false} />
                <span className="flex-1 text-hud-body text-hud-ink">{resourceName(req.resource)}</span>
                <span className={clsx("text-hud-strong ", isMet ? "text-hud-ink" : "text-hud-bad")}>
                  {heldAgainstNeed(req.current, req.amount)}
                </span>
              </div>
              {req.incoming && (
                <div className="pl-6 text-hud-body text-hud-good">
                  +{formatExact(Math.floor(req.incoming.amount))} in transit,{" "}
                  {formatIncomingEta(req.incoming.etaSeconds)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {step.nextLevel > 0 && (
        <p className="text-hud-body text-hud-muted">
          {step.nextLevelName ?? "It"} gives {describeCastleLevel(step.nextLevel)}.
        </p>
      )}
    </div>
  );
};

type StructureRealmActionsProps = {
  structureEntityId: ID | null;
  className?: string;
};

/**
 * The realm's level-up step beside its chip: one button that provisions a fresh Blitz realm or levels it up, as the
 * realm's own step says (useRealmLevelUp), with its requirements a hover away. The button says why it waits.
 */
export const StructureRealmActions = ({ structureEntityId, className }: StructureRealmActionsProps) => {
  const step = useRealmLevelUp(typeof structureEntityId === "number" ? structureEntityId : null);
  const setTooltip = useTooltipStore((state) => state.setTooltip);

  if (!step) {
    return null;
  }

  const requirementsContent = <LevelUpRequirements step={step} />;

  const showRequirementsTooltip = (event: MouseEvent<HTMLButtonElement>) => {
    setTooltip({
      anchorElement: event.currentTarget,
      position: "bottom",
      content: requirementsContent,
    });
  };

  const hideRequirementsTooltip = () => setTooltip(null);

  const renderIcon = () => {
    if (step.loading) return <SemanticIcon name="refresh" className="h-3.5 w-3.5 animate-spin" />;
    if (step.mode === "max") return <SemanticIcon name="defend" className="h-3.5 w-3.5" />;
    if (step.mode === "provision") return <SemanticIcon name="pickaxe" className="h-3.5 w-3.5" />;
    if (step.nextLevel >= 3) {
      return (
        <span className="relative flex h-4 w-4 items-center justify-center">
          <SemanticIcon name="chevron-up" className="absolute h-3 w-3 -translate-y-1.5" />
          <SemanticIcon name="chevron-up" className="absolute h-3 w-3" />
          <SemanticIcon name="chevron-up" className="absolute h-3 w-3 translate-y-1.5" />
        </span>
      );
    }
    if (step.nextLevel === 2) return <SemanticIcon name="chevron-up" className="h-3.5 w-3.5" />;
    return <SemanticIcon name="chevron-up" className="h-3.5 w-3.5" />;
  };

  const takeStep = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    step.run();
  };

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      {/* Ready reads as a secondary outline, never the gold primary: the screen's one gold button is Next up's. */}
      <HudButton
        kind="secondary"
        size="sm"
        onClick={takeStep}
        disabled={!step.ready}
        aria-label={step.word}
        title={step.refusal ?? step.word}
      >
        {renderIcon()}
      </HudButton>
      <HudIconButton
        icon="info"
        label="View upgrade requirements"
        kind="quiet"
        size="sm"
        onMouseEnter={showRequirementsTooltip}
        onMouseLeave={hideRequirementsTooltip}
        onFocus={showRequirementsTooltip as never}
        onBlur={hideRequirementsTooltip}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
};
