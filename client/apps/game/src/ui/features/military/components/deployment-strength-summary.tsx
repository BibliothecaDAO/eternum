import { cn } from "@/ui/design-system/atoms/lib/utils";
import { configManager } from "@bibliothecadao/eternum";
import { TroopTier } from "@bibliothecadao/types";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
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

const FALLBACK_STRENGTH_BY_TIER: Record<number, number> = {
  1: 1,
  2: 3,
  3: 9,
};

const LEVEL_LABELS = ["Settlement", "City", "Kingdom", "Empire"] as const;

const resolveTierNumber = (tier: TroopTier): number => {
  const asString = String(tier).toUpperCase();
  if (asString.startsWith("T")) {
    const parsed = Number(asString.replace("T", ""));
    return Number.isFinite(parsed) ? parsed : 1;
  }

  const parsed = Number(asString);
  return Number.isFinite(parsed) ? parsed : 1;
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded border border-gold/15 bg-black/20 px-2 py-1">
    <div className="text-[10px] uppercase tracking-[0.12em] text-gold/60">{label}</div>
    <div className="mt-1 text-xs font-semibold text-gold">{value}</div>
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
  const limitConfig = configManager.getTroopConfig().troop_limit_config;
  const resolvedLevel = typeof structureLevel === "number" && Number.isFinite(structureLevel) ? structureLevel : 0;
  const resolvedTierNumber = resolveTierNumber(troopTier);
  const levelLabel = LEVEL_LABELS[resolvedLevel] ?? LEVEL_LABELS[0];

  const deploymentCapByLevel = [
    Number(limitConfig.settlement_deployment_cap ?? 0),
    Number(limitConfig.city_deployment_cap ?? 0),
    Number(limitConfig.kingdom_deployment_cap ?? 0),
    Number(limitConfig.empire_deployment_cap ?? 0),
  ];

  const deploymentCap = Math.max(0, deploymentCapByLevel[resolvedLevel] ?? deploymentCapByLevel[0] ?? 0);

  const tierStrength =
    resolvedTierNumber === 1
      ? Number(limitConfig.t1_tier_strength ?? 0)
      : resolvedTierNumber === 2
        ? Number(limitConfig.t2_tier_strength ?? 0)
        : Number(limitConfig.t3_tier_strength ?? 0);

  const safeTierStrength = tierStrength > 0 ? tierStrength : (FALLBACK_STRENGTH_BY_TIER[resolvedTierNumber] ?? 1);
  const safeTroopCount = Math.max(0, Math.floor(Number.isFinite(troopCount) ? troopCount : 0));
  const projectedArmyStrength = safeTroopCount * safeTierStrength;
  const resolvedMaxTroopSize =
    typeof maxTroopSize === "number" && Number.isFinite(maxTroopSize) ? Math.max(0, Math.floor(maxTroopSize)) : null;
  const resolvedCapacityRemaining =
    typeof capacityRemaining === "number" && Number.isFinite(capacityRemaining)
      ? Math.max(0, Math.floor(capacityRemaining))
      : null;
  const metrics = (
    <div className="grid grid-cols-2 gap-2">
      <Metric label={`${levelLabel} cap`} value={`${deploymentCap.toLocaleString()} strength`} />
      <Metric label="Tier strength" value={`T${resolvedTierNumber} = ${safeTierStrength}`} />
      <Metric label="Projected strength" value={projectedArmyStrength.toLocaleString()} />
      <Metric
        label="Max troops (tier)"
        value={resolvedMaxTroopSize !== null ? resolvedMaxTroopSize.toLocaleString() : "—"}
      />
      {resolvedCapacityRemaining !== null && (
        <Metric label="Cap remaining" value={resolvedCapacityRemaining.toLocaleString()} />
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <div className={cn("rounded border border-gold/20 bg-black/35 px-2 py-2", className)}>
        <div className="text-[10px] uppercase tracking-[0.16em] text-gold/60">Deployment & Strength</div>
        <div className="mt-2">{metrics}</div>
      </div>
    );
  }

  return (
    <div className={cn("rounded border border-gold/20 bg-black/35", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-2 py-2 text-left transition hover:bg-black/25"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        aria-controls={metricsId}
      >
        <span className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-gold/60">Deployment & Strength</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-gold/45">
            {isExpanded ? "Hide details" : "Show details"}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-gold/70 transition-transform", isExpanded && "rotate-180")} />
      </button>
      {isExpanded ? (
        <div id={metricsId} className="border-t border-gold/15 px-2 py-2">
          {metrics}
        </div>
      ) : null}
    </div>
  );
};
