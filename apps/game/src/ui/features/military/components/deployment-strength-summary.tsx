import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { configManager } from "@bibliothecadao/eternum";
import { TroopTier, formatExact } from "@bibliothecadao/types";

import { useId, useState } from "react";

interface DeploymentStrengthSummaryProps {
  structureLevel?: number | null;
  troopTier: TroopTier;
  troopCount: number;
  maxTroopSize?: number | null;
  capacityRemaining?: number | null;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

const LEVEL_LABELS = ["Settlement", "City", "Kingdom", "Empire"] as const;

/** A structure level the deployment caps cover; armies and unknown structures have none. */
const isDeploymentLevel = (level: number | null | undefined): level is number =>
  typeof level === "number" && LEVEL_LABELS[level] !== undefined;

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded border border-hud-divider bg-hud-well px-2 py-1">
    <div className="text-hud-label uppercase text-hud-muted">{label}</div>
    <div className="mt-1 text-hud-label text-hud-accent">{value}</div>
  </div>
);

export const DeploymentStrengthSummary = ({
  structureLevel,
  troopTier,
  troopCount,
  maxTroopSize,
  capacityRemaining,
  className,
  collapsible = false,
  defaultExpanded = true,
}: DeploymentStrengthSummaryProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const metricsId = useId();
  const hasDeploymentLevel = isDeploymentLevel(structureLevel);
  const deploymentCap = hasDeploymentLevel ? configManager.getDeploymentCap(structureLevel) : undefined;
  const tierStrength = configManager.getTierStrength(troopTier);
  const projectedArmyStrength = Math.max(0, Math.floor(Number.isFinite(troopCount) ? troopCount : 0)) * tierStrength;
  const resolvedMaxTroopSize =
    typeof maxTroopSize === "number" && Number.isFinite(maxTroopSize) ? Math.max(0, Math.floor(maxTroopSize)) : null;
  const resolvedCapacityRemaining =
    typeof capacityRemaining === "number" && Number.isFinite(capacityRemaining)
      ? Math.max(0, Math.floor(capacityRemaining))
      : null;
  const metrics = (
    <div className="grid grid-cols-2 gap-2">
      <Metric
        label={hasDeploymentLevel ? `${LEVEL_LABELS[structureLevel]} cap` : "Deployment cap"}
        value={deploymentCap === undefined ? "—" : `${formatExact(deploymentCap)} strength`}
      />
      <Metric label="Tier strength" value={`${troopTier} = ${tierStrength}`} />
      <Metric label="Projected strength" value={formatExact(projectedArmyStrength)} />
      <Metric
        label="Max troops (tier)"
        value={resolvedMaxTroopSize !== null ? formatExact(resolvedMaxTroopSize) : "—"}
      />
      {resolvedCapacityRemaining !== null && (
        <Metric label="Cap remaining" value={formatExact(resolvedCapacityRemaining)} />
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <div className={cn("rounded border border-hud-line bg-hud-well px-2 py-2", className)}>
        <div className="text-hud-label uppercase text-hud-muted">Deployment & Strength</div>
        <div className="mt-2">{metrics}</div>
      </div>
    );
  }

  return (
    <div className={cn("rounded border border-hud-line bg-hud-well", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-2 py-2 text-left transition hover:bg-hud-well"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        aria-controls={metricsId}
      >
        <span className="flex items-center gap-2">
          <span className="text-hud-label uppercase text-hud-muted">Deployment & Strength</span>
          <span className="text-hud-label uppercase text-hud-cue">{isExpanded ? "Hide details" : "Show details"}</span>
        </span>
        <SemanticIcon
          name="chevron-down"
          className={cn("h-4 w-4 text-hud-muted transition-transform", isExpanded && "rotate-180")}
        />
      </button>
      {isExpanded ? (
        <div id={metricsId} className="border-t border-hud-divider px-2 py-2">
          {metrics}
        </div>
      ) : null}
    </div>
  );
};
