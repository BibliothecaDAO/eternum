import { memo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ID } from "@bibliothecadao/types";

import { EntityDetailLayoutVariant, EntityDetailSection } from "./layout";

interface RelicCrateEntityDetailProps {
  crateEntityId: ID;
  compact?: boolean;
  layout?: "default" | "banner";
  className?: string;
  layoutVariant?: EntityDetailLayoutVariant;
}

interface RelicCrateEntityDetailContentProps extends Omit<RelicCrateEntityDetailProps, "layoutVariant" | "layout"> {
  variant: EntityDetailLayoutVariant;
}

const infoItems = [
  {
    title: "Unexpected finds",
    description: "Relic crates appear randomly on the map—keep scouting to spot them early.",
  },
  {
    title: "Three power-ups",
    description: "Each crate holds three relics that can empower your structures or armies.",
  },
  {
    title: "Claim with an army",
    description: "Move an army onto an adjacent tile to open the crate and collect its relics.",
  },
];

const RelicCrateEntityDetailContent = memo(
  ({ crateEntityId, className, compact = false, variant }: RelicCrateEntityDetailContentProps) => {
    const isBanner = variant === "banner";
    if (!compact) {
      if (isBanner) {
        return (
          <div className={cn("flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-4", className)}>
            <div className="flex min-w-[200px] flex-col gap-1">
              <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">World Event</span>
              <h3 className="text-xl font-bold text-gold">Relic Crate</h3>
              <span className="text-xs text-gold/70">Crate #{crateEntityId}</span>
              <span className="text-xs text-gold/70">Move an army onto the tile to open it.</span>
            </div>
            <ul className="grid flex-1 grid-cols-1 gap-2 text-xs text-gold/80 sm:grid-cols-3">
              {infoItems.map((item) => (
                <li key={item.title} className="rounded-lg border border-gold/25 bg-dark-brown/70 px-3 py-2 shadow-md">
                  <span className="block font-semibold text-gold">{item.title}</span>
                  <span className="text-gold/70 text-xs">{item.description}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      }

      return (
        <div className={cn("flex flex-col gap-3", className)}>
          <div className="flex flex-col gap-1">
            <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">World Event</span>
            <h3 className="text-2xl font-bold text-gold">Relic Crate</h3>
            <span className="text-xs text-gold/70">Crate #{crateEntityId}</span>
          </div>
          <div className="rounded-lg border border-gold/25 bg-dark-brown/70 px-4 py-3 shadow-md">
            <ul className="flex flex-col gap-2 text-sm text-gold/80">
              {infoItems.map((item) => (
                <li key={item.title}>
                  <span className="block font-semibold text-gold">{item.title}</span>
                  <span className="text-gold/70 text-xs">{item.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    const containerClass = cn("flex h-full min-h-0 flex-col", compact ? "gap-2" : "gap-3", className);
    const bodyClass = cn("text-gold/70", compact ? "text-xxs" : "text-xs");
    const gridContainerClass =
      "grid flex-1 min-h-0 w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:grid-rows-2 sm:auto-rows-fr";

    return (
      <div className={containerClass}>
        <div className={gridContainerClass}>
          <EntityDetailSection compact tone="highlight" className="flex min-h-0 flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-gold">Crate #{crateEntityId}</div>
              {isBanner ? (
                <div className="flex flex-wrap items-center gap-1 text-xxs text-gold/60">
                  <span>Contains 3 relics.</span>
                  <span>Open with an army.</span>
                </div>
              ) : (
                <p className={bodyClass}>
                  Secure this relic cache before rivals arrive. Position an army adjacent to crack it open and claim the
                  rewards.
                </p>
              )}
            </div>
          </EntityDetailSection>
          <EntityDetailSection compact className="min-h-0" />
          <EntityDetailSection compact className="min-h-0" />
          <EntityDetailSection compact className="min-h-0" />
        </div>
      </div>
    );
  },
);
RelicCrateEntityDetailContent.displayName = "RelicCrateEntityDetailContent";

export const RelicCrateEntityDetail = memo(
  ({ crateEntityId, compact = false, layout = "default", className, layoutVariant }: RelicCrateEntityDetailProps) => {
    const resolvedVariant: EntityDetailLayoutVariant = layoutVariant ?? (layout === "banner" ? "banner" : "default");

    return (
      <RelicCrateEntityDetailContent
        crateEntityId={crateEntityId}
        className={className}
        compact={compact}
        variant={resolvedVariant}
      />
    );
  },
);

RelicCrateEntityDetail.displayName = "RelicCrateEntityDetail";
