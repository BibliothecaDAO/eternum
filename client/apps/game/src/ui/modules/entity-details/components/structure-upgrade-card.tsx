import { useState } from "react";

import Button from "@/ui/design-system/atoms/button";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SparklesIcon, CastleIcon, ArrowRightIcon, Gauge as GaugeIcon } from "lucide-react";

import { useStructureUpgrade } from "../hooks/use-structure-upgrade";

interface StructureUpgradeCardProps {
  structureEntityId: number;
  className?: string;
}

export const StructureUpgradeCard = ({ structureEntityId, className }: StructureUpgradeCardProps) => {
  const upgradeInfo = useStructureUpgrade(structureEntityId);
  const [isUpgrading, setIsUpgrading] = useState(false);

  if (!upgradeInfo || !upgradeInfo.isOwner) {
    return null;
  }

  const {
    currentLevel,
    currentLevelName,
    nextLevelName,
    nextLevel,
    canUpgrade,
    upgradeProgress,
    requirements,
    missingRequirements,
    isMaxLevel,
    handleUpgrade,
  } = upgradeInfo;

  const showProgress = !isMaxLevel && !canUpgrade;
  const previewLevel = nextLevel ?? currentLevel;

  const onUpgrade = async () => {
    if (!canUpgrade || isMaxLevel) return;

    setIsUpgrading(true);
    try {
      await handleUpgrade();
    } catch (error) {
      console.error("Failed to upgrade realm", error);
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-gold/25 bg-slate-900/60 p-4 shadow-lg",
        canUpgrade && "ring-1 ring-gold/40",
        className,
      )}
    >
      {canUpgrade && (
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-500/30 blur-3xl" />
          <div className="absolute -bottom-16 right-0 h-48 w-48 rounded-full bg-emerald-400/20 blur-2xl" />
        </div>
      )}

      <div className="relative flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("rounded-full p-2", canUpgrade ? "bg-amber-500/20" : "bg-slate-800/80")}>
              {canUpgrade ? (
                <SparklesIcon className="h-5 w-5 text-amber-300" />
              ) : (
                <CastleIcon className="h-5 w-5 text-gold/70" />
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gold/70">Castle Upgrade</p>
              <div className="flex items-center gap-2 text-sm font-semibold text-gold">
                <span>{currentLevelName}</span>
                {nextLevelName && (
                  <>
                    <ArrowRightIcon className="h-4 w-4 text-gold/60" />
                    <span>{nextLevelName}</span>
                  </>
                )}
                {!nextLevelName && <span className="text-xs text-gold/60">Max level reached</span>}
              </div>
            </div>
          </div>
          {!isMaxLevel && (
            <div className="flex items-center gap-2 text-xs text-gold/70">
              <GaugeIcon className="h-4 w-4" />
              <span>{canUpgrade ? "Ready" : `Progress ${upgradeProgress}%`}</span>
            </div>
          )}
        </header>

        {!isMaxLevel && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Button
                variant={canUpgrade ? "gold" : "outline"}
                disabled={!canUpgrade}
                isLoading={isUpgrading}
                onClick={onUpgrade}
                className="w-full"
              >
                {canUpgrade && nextLevel ? `Upgrade to level ${nextLevel}` : "Need resources"}
              </Button>
            </div>
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-gold/20 bg-slate-800/60">
              <img
                src={`/images/castles/castle-${previewLevel}.png`}
                alt="Castle level preview"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}

        {showProgress && (
          <div className="flex flex-col gap-2 rounded-md border border-gold/20 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between text-xs text-gold/70">
              <span>Upgrade requirements</span>
              <span>{upgradeProgress}% complete</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400"
                style={{ width: `${upgradeProgress}%` }}
              />
            </div>
            {missingRequirements.length > 0 && (
              <p className="text-xxs text-amber-200/80">Collect remaining resources to finish the upgrade.</p>
            )}
          </div>
        )}

        {!isMaxLevel && requirements.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {requirements.map((requirement) => (
              <div key={requirement.resource} className="flex w-32 flex-col items-center gap-1">
                <ResourceCost
                  type="vertical"
                  size="md"
                  resourceId={requirement.resource}
                  amount={requirement.amount}
                  className="bg-slate-900/40"
                />
                <div className="w-full rounded-full bg-slate-800">
                  <div className="h-1 rounded-full bg-gold" style={{ width: `${requirement.progress}%` }} />
                </div>
                <span className="text-xxs text-gold/80">
                  {Math.min(requirement.current, requirement.amount).toLocaleString()} /{" "}
                  {requirement.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {isMaxLevel && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            Your castle has reached the highest tier.
          </div>
        )}
      </div>
    </div>
  );
};
