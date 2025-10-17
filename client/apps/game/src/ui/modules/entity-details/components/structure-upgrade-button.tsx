import { useMemo, useState, type MouseEvent } from "react";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { ResourcesIds } from "@bibliothecadao/types";
import { Loader2, Shield, Sparkles } from "lucide-react";

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
  // Always call every hook first, then conditionals/returns after ALL hooks

  const upgradeInfo = useStructureUpgrade(structureEntityId);
  const setTooltip = useUIStore((state) => state.setTooltip);

  // Use a hook wrapper to preserve state.
  const [isUpgrading, setIsUpgrading] = useState(false);

  const showButton = !!(upgradeInfo && upgradeInfo.isOwner);

  const canUpgrade = upgradeInfo?.canUpgrade ?? false;
  const currentLevel = upgradeInfo?.currentLevel ?? 0;
  const nextLevel = upgradeInfo?.nextLevel ?? null;
  const isMaxLevel = upgradeInfo?.isMaxLevel ?? false;
  const missingRequirements = upgradeInfo?.missingRequirements ?? [];
  const handleUpgrade = upgradeInfo?.handleUpgrade ?? (async () => {});

  // Ideally, real resources, but shown mocked for now unless you have an enum mapping for resource names
  const missingResources = useMemo(() => {
    return missingRequirements
      .map((requirement) => ({
        id: requirement.resource,
        label: ResourcesIds[requirement.resource] ?? `Resource ${requirement.resource}`,
        missing: Math.max(0, requirement.amount - requirement.current),
      }))
      .filter((item) => item.missing > 0.0001);
  }, [missingRequirements]);

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
              <span className="flex-1 text-gold/75">{formatResourceLabel(String(resource.label))}</span>
              <span className="font-semibold text-gold/90">{formatAmount(resource.missing)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }, [canUpgrade, currentLevel, isMaxLevel, missingResources, nextLevel]);

  // Even when disabled, mouse events do not fire on native <button disabled>. To show tooltip on disabled, wrap in a <div>
  // See: https://github.com/reactwg/react-18/discussions/48#discussioncomment-2861449

  const handleMouseEnter = (event: MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
    // Use event delegation: always fire even if button is disabled
    // Still, check tooltipContent before showing
    console.log("tooltipContent", tooltipContent);
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
      // eslint-disable-next-line no-console
      console.error("Failed to upgrade realm", error);
    } finally {
      setIsUpgrading(false);
      setTooltip(null);
    }
  };

  // Use only colors that are present in tailwind.config.js (gold, red, emerald)
  const baseClasses = cn(
    "flex items-center gap-1 rounded-md border px-2 py-1 text-xxs font-semibold uppercase tracking-wide transition focus:outline-none focus:ring-1",
    isMaxLevel
      ? "border-emerald-400/40 bg-brilliance/20 text-brilliance"
      : canUpgrade
        ? "border-gold/60 bg-gold/10 text-gold hover:bg-gold/25 focus:ring-gold/40"
        : "border-danger/60 bg-danger/20 text-danger hover:bg-danger/40 focus:ring-danger/40",
    canUpgrade && !isMaxLevel ? "animate-pulse" : "",
    className,
  );

  if (!showButton) {
    return null;
  }

  // To allow tooltip on disabled, wrap in div
  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter as never}
      onBlur={handleMouseLeave}
      className="inline-block"
      data-tooltip-anchor
    >
      <button
        type="button"
        className={baseClasses}
        onClick={onUpgrade}
        // Don't handle mouse enter/leave here (not fired when disabled)
        disabled={isMaxLevel || !canUpgrade || isUpgrading}
        tabIndex={0}
        style={
          // Show pointer by hand if disabled to indicate interactiveness for tooltip
          isMaxLevel || !canUpgrade || isUpgrading ? { pointerEvents: "none" } : undefined
        }
      >
        {isMaxLevel ? (
          <Shield className="h-3.5 w-3.5 text-brilliance" />
        ) : isUpgrading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
        ) : canUpgrade ? (
          <Sparkles className="h-3.5 w-3.5 text-gold" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-danger" />
        )}
        <span className="hidden sm:inline">{isMaxLevel ? "Max" : nextLevel ? `Lvl ${nextLevel}` : "Upgrade"}</span>
        <span className="sm:hidden">{isMaxLevel ? "Max" : "Lv"}</span>
      </button>
    </div>
  );
};
