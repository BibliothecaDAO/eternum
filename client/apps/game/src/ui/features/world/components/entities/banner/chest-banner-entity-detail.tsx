import { memo } from "react";
import { ID } from "@bibliothecadao/types";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useChestEntityDetail } from "../hooks/use-chest-entity-detail";

export interface ChestBannerEntityDetailProps {
  chestEntityId: ID;
  className?: string;
  compact?: boolean;
}

export const ChestBannerEntityDetail = memo(
  ({ chestEntityId, className, compact = true }: ChestBannerEntityDetailProps) => {
    const { chestName } = useChestEntityDetail({ chestEntityId });

    if (compact) {
      return (
        <div className={cn("flex flex-col gap-1 rounded-lg border border-gold/30 bg-dark/60 p-3 text-xs text-gold/80", className)}>
          <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">World Item</span>
          <span className="text-lg font-bold text-gold">{chestName}</span>
          <span className="text-xxs text-gold/70">Crate #{chestEntityId}</span>
          <span className="text-xxs text-gold/60">Open the chest to claim its rewards.</span>
        </div>
      );
    }

    return (
      <div className={cn("flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-4", className)}>
        <div className="flex min-w-[180px] flex-col gap-1">
          <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">World Item</span>
          <h3 className="text-xl font-bold text-gold">{chestName}</h3>
          <span className="text-xs text-gold/70">Crate #{chestEntityId}</span>
          <span className="text-xs text-gold/70">Move an army onto the tile to open it.</span>
        </div>
        <ul className="grid flex-1 grid-cols-1 gap-2 text-xs text-gold/80 sm:grid-cols-3">
          <li className="rounded-lg border border-gold/25 bg-dark-brown/70 px-3 py-2 shadow-md">
            <span className="block font-semibold text-gold">Unexpected finds</span>
            <span className="text-xs text-gold/70">Relic crates appear randomly—keep scouting to spot them early.</span>
          </li>
          <li className="rounded-lg border border-gold/25 bg-dark-brown/70 px-3 py-2 shadow-md">
            <span className="block font-semibold text-gold">Three power-ups</span>
            <span className="text-xs text-gold/70">Each crate holds three relics that can empower your forces.</span>
          </li>
          <li className="rounded-lg border border-gold/25 bg-dark-brown/70 px-3 py-2 shadow-md">
            <span className="block font-semibold text-gold">Claim with an army</span>
            <span className="text-xs text-gold/70">Move an army onto an adjacent tile to open the crate.</span>
          </li>
        </ul>
      </div>
    );
  },
);

ChestBannerEntityDetail.displayName = "ChestBannerEntityDetail";
