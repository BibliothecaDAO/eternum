import { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { EntityDetailDensity, useEntityDetailLayout } from "./entity-detail-layout-context";

const densityPadding: Record<EntityDetailDensity, string> = {
  loose: "px-5 py-4",
  cozy: "px-4 py-3",
  compact: "px-3 py-2",
};

const densityGap: Record<EntityDetailDensity, string> = {
  loose: "gap-4",
  cozy: "gap-3",
  compact: "gap-2",
};

const titleText: Record<EntityDetailDensity, string> = {
  loose: "text-sm",
  cozy: "text-xs",
  compact: "text-xxs",
};

const bodyText: Record<EntityDetailDensity, string> = {
  loose: "text-base",
  cozy: "text-sm",
  compact: "text-xs",
};

export interface EntityDetailSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
  tone?: "default" | "highlight";
}

export const EntityDetailSection = ({
  children,
  className,
  description,
  title,
  tone = "default",
}: EntityDetailSectionProps) => {
  const { density } = useEntityDetailLayout();
  return (
    <section
      className={cn(
        "rounded-lg border bg-dark-brown/70 shadow-md",
        tone === "highlight" ? "border-gold/35" : "border-gold/25",
        densityPadding[density],
        densityGap[density],
        className,
      )}
    >
      {(title || description) && (
        <header className={cn("flex flex-col", densityGap[density])}>
          {title && (
            <div className={cn("font-semibold uppercase tracking-[0.2em] text-gold/80", titleText[density])}>{title}</div>
          )}
          {description && <div className={cn("text-gold/70", bodyText[density])}>{description}</div>}
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
}

export const EntityDetailStatList = ({ children, className, columns = 1 }: EntityDetailStatListProps) => {
  const { density } = useEntityDetailLayout();
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
        densityGap[density],
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
}

export const EntityDetailStat = ({ label, value, emphasizeValue = false, className }: EntityDetailStatProps) => {
  const { density } = useEntityDetailLayout();
  return (
    <div className={cn("flex flex-col", densityGap[density], className)}>
      <span className={cn("font-semibold uppercase tracking-[0.18em] text-gold/70", titleText[density])}>{label}</span>
      <span className={cn(emphasizeValue ? "text-gold" : "text-gold/80", bodyText[density])}>{value}</span>
    </div>
  );
};

export const getDensityTextClasses = (density: EntityDetailDensity, weight: "title" | "body") =>
  weight === "title" ? titleText[density] : bodyText[density];
