import type { ReactNode } from "react";
import type { BiomeType, ID } from "@bibliothecadao/types";
import { EntityDetailSection } from "../entities/layout";
import { BiomeSummaryCard } from "./unoccupied-tile-quadrants";

export function ChestTileDetails({
  crateEntityId,
  biome,
  coordsLabel,
  headerAction,
  onSimulateBattle,
}: {
  crateEntityId: ID;
  biome: BiomeType;
  coordsLabel?: string;
  headerAction?: ReactNode;
  onSimulateBattle: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <EntityDetailSection compact tone="highlight" className="shrink-0">
        <div className="flex flex-col gap-1 text-left">
          <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Relic Crate</span>
          <span className="text-sm font-semibold text-gold">Crate #{crateEntityId}</span>
          <p className="text-xxs text-gold/70">Claim it to discover 3 relics that can empower armies or structures.</p>
          <p className="text-xxs text-gold/70">Cracking it open also grants you 1000 Victory Points !</p>
        </div>
      </EntityDetailSection>
      <BiomeSummaryCard
        biome={biome}
        coordsLabel={coordsLabel}
        headerAction={headerAction}
        showSimulateAction
        onSimulateBattle={onSimulateBattle}
      />
    </div>
  );
}
