import { memo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ID } from "@bibliothecadao/types";

import { EntityDetailLayoutProvider, EntityDetailLayoutVariant, EntityDetailSection, useEntityDetailLayout } from "./layout";

interface RelicCrateEntityDetailProps {
  crateEntityId: ID;
  compact?: boolean;
  layout?: "default" | "banner";
  className?: string;
  layoutVariant?: EntityDetailLayoutVariant;
}

const infoItems = [
  {
    title: "Unexpected finds",
    description: "Relic crates appear randomly—keep scouting to spot them early.",
  },
  {
    title: "Three power-ups",
    description: "Each crate holds three relics that can empower your structures or armies.",
  },
  {
    title: "Claim with an army",
    description: "Move an army adjacent to open the crate and collect its relics.",
  },
];

const RelicCrateEntityDetailContent = memo(
  ({ crateEntityId, className }: Omit<RelicCrateEntityDetailProps, "compact" | "layout" | "layoutVariant">) => {
    const layout = useEntityDetailLayout();
    const containerClass = cn(
      "flex flex-col",
      layout.density === "compact" ? "gap-1.5" : "gap-3",
      className,
    );

    const bodyClass = cn("text-gold/70", layout.density === "compact" ? "text-xxs" : "text-xs");

    return (
      <div className={containerClass}>
        <EntityDetailSection>
          <div className="text-sm font-semibold text-gold">Crate #{crateEntityId}</div>
          {layout.variant === "hud" ? (
            <div className="flex flex-wrap items-center gap-2 text-xxs text-gold/60">
              <span>Scout to discover.</span>
              <span>Contains 3 relics.</span>
              <span>Open with an army.</span>
            </div>
          ) : (
            <ul
              className={cn(
                "text-gold/80",
                layout.variant === "banner"
                  ? "grid grid-cols-1 gap-2 sm:grid-cols-3"
                  : "flex flex-col gap-2",
              )}
            >
              {infoItems.map((item) => (
                <li key={item.title} className="rounded-lg border border-gold/25 bg-dark-brown/70 px-3 py-2 shadow-md">
                  <span className="block text-gold font-semibold">{item.title}</span>
                  <span className={cn(bodyClass, "text-xs")}>{item.description}</span>
                </li>
              ))}
            </ul>
          )}
        </EntityDetailSection>
      </div>
    );
  },
);
RelicCrateEntityDetailContent.displayName = "RelicCrateEntityDetailContent";

export const RelicCrateEntityDetail = memo(
  ({ crateEntityId, compact = false, layout = "default", className, layoutVariant }: RelicCrateEntityDetailProps) => {
    const resolvedVariant: EntityDetailLayoutVariant = layoutVariant ?? (layout === "banner" ? "banner" : compact ? "hud" : "default");
    const density = compact || resolvedVariant === "hud" ? "compact" : "cozy";
    const minimizeCopy = resolvedVariant === "hud" || compact;

    return (
      <EntityDetailLayoutProvider variant={resolvedVariant} density={density} minimizeCopy={minimizeCopy}>
        <RelicCrateEntityDetailContent crateEntityId={crateEntityId} className={className} />
      </EntityDetailLayoutProvider>
    );
  },
);

RelicCrateEntityDetail.displayName = "RelicCrateEntityDetail";
