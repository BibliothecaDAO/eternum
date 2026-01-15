import { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { RelicRecipientType, ResourcesIds } from "@bibliothecadao/types";
import { RelicInfoResult } from "../hooks/use-relic-activation";

interface RelicSummaryProps {
  resourceKey: string;
  title: string;
  subtitle?: string;
  description?: string;
  layout?: "horizontal" | "vertical";
  iconSize?: "md" | "lg" | "xl";
  className?: string;
  children?: ReactNode;
}

export const RelicSummary = ({
  resourceKey,
  title,
  subtitle,
  description,
  layout = "horizontal",
  iconSize = "lg",
  className,
  children,
}: RelicSummaryProps) => {
  const vertical = layout === "vertical";

  return (
    <div
      className={cn(vertical ? "flex flex-col items-center gap-3 text-center" : "flex items-center gap-3", className)}
    >
      <ResourceIcon resource={resourceKey} size={iconSize} withTooltip={false} className="shrink-0" />
      <div className={cn("space-y-1", vertical ? "max-w-[280px]" : "")}>
        <p className="text-base font-semibold text-gold">{title}</p>
        {subtitle && <p className="text-xs text-gold/70">{subtitle}</p>}
        {description && <p className="text-xs text-gold/60">{description}</p>}
        {children}
      </div>
    </div>
  );
};

interface RelicEssenceRequirementProps {
  essenceCost: number;
  essenceBalance: number;
  missingEssence?: number;
  hasEnoughEssence: boolean;
  className?: string;
  costLabel?: string;
  balanceLabel?: string;
  showWarning?: boolean;
}

export const RelicEssenceRequirement = ({
  essenceCost,
  essenceBalance,
  missingEssence = Math.max(0, essenceCost - essenceBalance),
  hasEnoughEssence,
  className,
  costLabel = "Activation Cost",
  balanceLabel = "Essence Balance",
  showWarning = !hasEnoughEssence,
}: RelicEssenceRequirementProps) => {
  return (
    <div className={cn("rounded border border-gold/20 bg-dark-brown/30 p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gold/80">{costLabel}:</span>
        <div className="flex items-center gap-2">
          <ResourceIcon resource={ResourcesIds[ResourcesIds.Essence]} size="sm" withTooltip={false} />
          <span className="text-sm font-bold">{essenceCost.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gold/80">{balanceLabel}:</span>
        <div className="flex items-center gap-2">
          <ResourceIcon resource={ResourcesIds[ResourcesIds.Essence]} size="sm" withTooltip={false} />
          <span className={`text-sm font-bold ${hasEnoughEssence ? "text-emerald-300" : "text-red-400"}`}>
            {essenceBalance.toLocaleString()}
          </span>
        </div>
      </div>
      {showWarning && !hasEnoughEssence && (
        <div className="mt-2 rounded border border-red-600/40 bg-red-900/30 p-2 text-center text-xs font-semibold text-red-300">
          Need {missingEssence.toLocaleString()} more essence
        </div>
      )}
    </div>
  );
};

interface RelicIncompatibilityNoticeProps {
  relicInfo: RelicInfoResult;
  recipientType: RelicRecipientType;
  className?: string;
}

export const RelicIncompatibilityNotice = ({
  relicInfo,
  recipientType,
  className,
}: RelicIncompatibilityNoticeProps) => {
  if (!relicInfo) {
    return null;
  }

  return (
    <div
      className={cn("rounded border border-red-600/30 bg-red-900/20 p-3 text-center text-xs text-red-300", className)}
    >
      <p className="font-semibold text-red-400">
        ⚠️ This relic cannot be activated by{" "}
        {recipientType === RelicRecipientType.Explorer ? "explorers" : "structures"}
      </p>
      <p className="mt-1">
        {relicInfo.recipientType} relics can only be activated by{" "}
        {relicInfo.recipientType === RelicRecipientType.Explorer ? "explorers" : "structures"}
      </p>
    </div>
  );
};
