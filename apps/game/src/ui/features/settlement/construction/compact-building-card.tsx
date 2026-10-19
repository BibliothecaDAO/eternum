import { BuildingThumbnail } from "./building-thumbnail";
import type { BuildingType } from "@bibliothecadao/types";
import { useState, type ReactNode } from "react";
import { HudButton, HudChip, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { RequirementChips, type ResourceRequirement } from "@/ui/design-system/molecules/requirement-chips";

interface BuildingAction {
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
}

interface CompactBuildingCardProps {
  name: string;
  building: BuildingType;
  count: number;
  status?: string;
  requirements: ResourceRequirement[] | undefined;
  disabledReason?: string;
  details: ReactNode;
  active: boolean;
  onPlace?: () => void;
  build: BuildingAction;
  production: BuildingAction & { paused?: boolean };
  destroy: BuildingAction;
}

/**
 * Costs are visible before building; management remains available even when another building is unaffordable. Destroy
 * acts at once, as on the desktop card: Blitz and Eternum ask no confirmation.
 */
export const CompactBuildingCard = ({
  name,
  building,
  count,
  status,
  requirements,
  disabledReason,
  details,
  active,
  onPlace,
  build,
  production,
  destroy,
}: CompactBuildingCardProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <HudPanel kind="section" collapsible={false}>
      <div className="flex items-center gap-3">
        <BuildingThumbnail building={building} alt="" className="h-14 w-14 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-hud-title">
            {name}
            {active && <HudChip>Chosen</HudChip>}
          </h3>
          <p className="text-hud-label text-hud-muted">
            {count} built{status && ` · ${status}`}
          </p>
        </div>
        <HudButton
          kind="primary"
          aria-label={`Build ${name}`}
          disabled={build.disabled || build.pending}
          onClick={build.onClick}
        >
          {build.pending ? "Building…" : "Build"}
        </HudButton>
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <p className="text-hud-label text-hud-muted">Cost · owned / needed</p>
        <RequirementChips requirements={requirements} />
        {disabledReason && <p className="text-hud-muted">{disabledReason}</p>}
      </div>
      <details
        className="mt-2 border-t border-hud-divider"
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-hud-accent underline underline-offset-4">
          Details & management
        </summary>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {onPlace && (
              <HudButton kind="secondary" disabled={build.disabled || build.pending} onClick={onPlace}>
                Place on map
              </HudButton>
            )}
            {production.onClick && (
              <HudButton
                kind="secondary"
                disabled={production.disabled || production.pending}
                onClick={production.onClick}
              >
                {production.pending ? "Updating…" : production.paused ? "Resume all" : "Pause all"}
              </HudButton>
            )}
            {destroy.onClick && (
              <HudButton kind="danger" disabled={destroy.disabled || destroy.pending} onClick={destroy.onClick}>
                {destroy.pending ? "Destroying…" : "Destroy one"}
              </HudButton>
            )}
          </div>
          {detailsOpen && details}
        </div>
      </details>
    </HudPanel>
  );
};
