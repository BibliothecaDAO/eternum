import { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

export type EntityDetailLayoutVariant = "default" | "banner";

type LayoutScale = "default" | "compact";

const spacingPadding: Record<LayoutScale, string> = {
  default: "px-4 py-3",
  compact: "px-3 py-2",
};

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

export interface EntityDetailSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
  tone?: "default" | "highlight";
  compact?: boolean;
}

export const EntityDetailSection = ({
  children,
  className,
  description,
  title,
  tone = "default",
  compact = false,
}: EntityDetailSectionProps) => {
  const scale = getScale(compact);
  return (
    <section
      className={cn(
        "rounded-lg border bg-dark-brown/70 shadow-md",
        tone === "highlight" ? "border-gold/35" : "border-gold/25",
        spacingPadding[scale],
        spacingGap[scale],
        className,
      )}
    >
      {(title || description) && (
        <header className={cn("flex flex-col", spacingGap[scale])}>
          {title && (
            <div className={cn("font-semibold uppercase tracking-[0.2em] text-gold/80", titleText[scale])}>{title}</div>
          )}
          {description && <div className={cn("text-gold/70", bodyText[scale])}>{description}</div>}
        </header>
      )}
      {children}
    </section>
  );
};

export interface EntityDetailStatListProps {
  className?: string;
  columns?: 1 | 2 | 3;
  children: ReactNode;
  compact?: boolean;
}

export const EntityDetailStatList = ({ children, className, columns = 1, compact = false }: EntityDetailStatListProps) => {
  const scale = getScale(compact);
  const gridClass =
    columns === 3
      ? "grid-cols-3"
      : columns === 2
        ? "grid-cols-2"
        : "grid-cols-1";
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

export interface EntityDetailStatProps {
  label: ReactNode;
  value: ReactNode;
  emphasizeValue?: boolean;
  className?: string;
  compact?: boolean;
}

export const EntityDetailStat = ({ label, value, emphasizeValue = false, className, compact = false }: EntityDetailStatProps) => {
  const scale = getScale(compact);
  return (
    <div className={cn("flex flex-col", spacingGap[scale], className)}>
      <span className={cn("font-semibold uppercase tracking-[0.18em] text-gold/70", titleText[scale])}>{label}</span>
      <span className={cn(emphasizeValue ? "text-gold" : "text-gold/80", bodyText[scale])}>{value}</span>
    </div>
  );
};

export const getLayoutTextClasses = (compact: boolean, weight: "title" | "body") => {
  const scale = getScale(compact);
  return weight === "title" ? titleText[scale] : bodyText[scale];
};
