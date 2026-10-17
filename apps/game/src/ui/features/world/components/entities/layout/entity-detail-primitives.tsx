import { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

export type EntityDetailLayoutVariant = "default" | "banner";

type LayoutScale = "default" | "compact";

const spacingGap: Record<LayoutScale, string> = {
  default: "gap-3",
  compact: "gap-2",
};

const titleText: Record<LayoutScale, string> = {
  default: "text-xs",
  compact: "text-xxs",
};

const bodyText: Record<LayoutScale, string> = {
  default: "text-sm",
  compact: "text-xs",
};

const getScale = (compact: boolean): LayoutScale => (compact ? "compact" : "default");

interface EntityDetailStatListProps {
  className?: string;
  columns?: 1 | 2 | 3;
  children: ReactNode;
  compact?: boolean;
}

export const EntityDetailStatList = ({
  children,
  className,
  columns = 1,
  compact = false,
}: EntityDetailStatListProps) => {
  const scale = getScale(compact);
  const gridClass = columns === 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <div
      className={cn(
        "grid items-start",
        spacingGap[scale],
        columns > 1 ? gridClass : undefined,
        columns > 1 ? "gap-x-3" : undefined,
        className,
      )}
    >
      {children}
    </div>
  );
};

interface EntityDetailStatProps {
  label: ReactNode;
  value: ReactNode;
  emphasizeValue?: boolean;
  className?: string;
  compact?: boolean;
}

export const EntityDetailStat = ({
  label,
  value,
  emphasizeValue = false,
  className,
  compact = false,
}: EntityDetailStatProps) => {
  const scale = getScale(compact);
  return (
    <div className={cn("flex flex-col", spacingGap[scale], className)}>
      <span className={cn("font-semibold uppercase tracking-[0.18em] text-gold/70", titleText[scale])}>{label}</span>
      <span className={cn(emphasizeValue ? "text-gold" : "text-gold/80", bodyText[scale])}>{value}</span>
    </div>
  );
};
