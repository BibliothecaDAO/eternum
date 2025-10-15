import { useMemo, useState, type MouseEvent } from "react";

import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourcesIds } from "@bibliothecadao/types";
import { Loader2, Sparkles, Shield } from "lucide-react";

interface StructureUpgradeButtonProps {
  structureEntityId: number;
  className?: string;
}

const formatResourceLabel = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .trim();

const formatAmount = (value: number) =>
  Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(Math.max(0, value));

export const StructureUpgradeButton = ({ structureEntityId, className }: StructureUpgradeButtonProps) => {
  const upgradeInfo = useStructureUpgrade(structureEntityId);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const showNothing = !upgradeInfo || !upgradeInfo.isOwner;
  if (showNothing) {
    return null;
  }

  const {
    canUpgrade,
    currentLevel,
    nextLevel,
    isMaxLevel,
    missingRequirements,
    handleUpgrade,
  } = upgradeInfo;

  const missingResources = useMemo(
    () =>
      missingRequirements
        .map((requirement) => ({
          id: requirement.resource,
          label: ResourcesIds[requirement.resource] ?? `Resource ${requirement.resource}`,
          missing: Math.max(0, requirement.amount - requirement.current),
        }))
        .filter((item) => item.missing > 0.0001),
    [missingRequirements],
  );

  const tooltipContent = useMemo(() => {
    if (isMaxLevel) {
      return (
        <div className="flex flex-col gap-1 text-xs text-gold">
          <span className="font-semibold text-gold/90">Castle fully upgraded</span>
          <span className="text-gold/70">Level {currentLevel} is the maximum tier.</span>
        </div>
      );
    }

    if (canUpgrade) {
      return (
        <div className="flex flex-col gap-1 text-xs text-gold">
          <span className="font-semibold text-gold/90">Upgrade ready</span>
          {nextLevel && <span className="text-gold/70">Click to upgrade to level {nextLevel}.</span>}
        </div>
      );
    }

    if (missingResources.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-col gap-1 text-xs text-gold">
        <span className="font-semibold text-gold/90">Missing resources</span>
        <div className="flex flex-col gap-1">
          {missingResources.map((resource) => (
            <div key={resource.id} className="flex items-center gap-2">
              <ResourceIcon resource={String(resource.label)} size="xs" withTooltip={false} />
              <span className="flex-1 text-gold/75">
                {formatResourceLabel(String(resource.label))}
              </span>
              <span className="font-semibold text-gold/90">{formatAmount(resource.missing)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }, [canUpgrade, currentLevel, isMaxLevel, missingResources, nextLevel]);

  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    if (!tooltipContent) return;
    setTooltip({
      anchorElement: event.currentTarget,
      position: "bottom",
      content: tooltipContent,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const onUpgrade = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isMaxLevel || !canUpgrade || isUpgrading) return;

    setIsUpgrading(true);
    try {
      await handleUpgrade();
    } catch (error) {
      console.error("Failed to upgrade realm", error);
    } finally {
      setIsUpgrading(false);
      setTooltip(null);
    }
  };

  const baseClasses = cn(
    "flex items-center gap-1 rounded-md border px-2 py-1 text-xxs font-semibold uppercase tracking-wide transition focus:outline-none focus:ring-1",
    isMaxLevel
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : canUpgrade
        ? "border-gold/50 bg-gold/15 text-gold hover:bg-gold/30 focus:ring-gold/40"
        : "border-red/50 bg-red-500/10 text-red-100 hover:bg-red-500/20 focus:ring-red/40",
    className,
  );

  return (
    <button
      type="button"
      className={baseClasses}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter as never}
      onBlur={handleMouseLeave}
      onClick={onUpgrade}
      disabled={isMaxLevel || !canUpgrade || isUpgrading}
      data-tooltip-anchor
    >
      {isMaxLevel ? (
        <Shield className="h-3.5 w-3.5" />
      ) : isUpgrading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {isMaxLevel ? "Max" : nextLevel ? `Lvl ${nextLevel}` : "Upgrade"}
      </span>
      <span className="sm:hidden">{isMaxLevel ? "Max" : "Lv"}</span>
    </button>
  );
};
