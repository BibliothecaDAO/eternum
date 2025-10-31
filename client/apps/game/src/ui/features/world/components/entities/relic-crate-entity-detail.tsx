import { ID } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { memo } from "react";

interface RelicCrateEntityDetailProps {
  crateEntityId: ID;
  compact?: boolean;
  layout?: "default" | "banner";
  className?: string;
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

export const RelicCrateEntityDetail = memo(
  ({ crateEntityId, compact = false, layout = "default", className }: RelicCrateEntityDetailProps) => {
    const isBanner = layout === "banner";
    if (compact) {
      return (
        <div className={cn("flex flex-col gap-1", className)}>
          <div className="text-gold font-semibold">Relic Crate</div>
          <div className="text-xxs text-gold/70">Crate #{crateEntityId}</div>
          <div className="text-xxs text-gold/60">Move an army onto the tile to open it.</div>
        </div>
      );
    }

    if (isBanner) {
      return (
        <div className={cn("flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-4", className)}>
          <div className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">World Event</span>
            <h3 className="text-xl font-bold text-gold">Relic Crate</h3>
            <span className="text-xs text-gold/70">Crate #{crateEntityId}</span>
            <span className="text-xs text-gold/70">Move an army onto the tile to open it.</span>
          </div>
          <ul className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3 text-xs text-gold/80">
            {infoItems.map((item) => (
              <li key={item.title} className="rounded-lg border border-gold/25 bg-dark-brown/70 px-3 py-2 shadow-md">
                <span className="block text-gold font-semibold">{item.title}</span>
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
                <span className="block text-gold font-semibold">{item.title}</span>
                <span className="text-gold/70 text-xs">{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  },
);

RelicCrateEntityDetail.displayName = "RelicCrateEntityDetail";
