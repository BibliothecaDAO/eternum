import type { ReactNode } from "react";
import type { BiomeType, ID } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_HEADLINE } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { InfoBubble } from "../entities/collapsible-bubble";
import { EntityDetailStat, EntityDetailStatList } from "../entities/layout";
import { BiomeSummaryCard } from "./unoccupied-tile-quadrants";

/** The relic crate tile, in the structure tile's chrome: header, name row, contents from config, then the biome. */
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
  const reward = configManager.getRelicCrateReward();
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className={cn("flex min-w-0 flex-col divide-y divide-gold/15 rounded-xl", OVERLAY_SURFACE_BASE)}>
        <InfoBubble variant="section" title={coordsLabel ?? "Relic tile"} cue={headerAction} bodyClassName="pt-0">
          <div className="flex items-center gap-2 text-gold">
            <img src="/images/relic-chest/chest-closed.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <p className={cn("truncate", HUD_HEADLINE)}>Crate #{crateEntityId}</p>
          </div>
        </InfoBubble>
        <InfoBubble variant="section" title="Contents" icon={Sparkles}>
          <EntityDetailStatList compact columns={2}>
            <EntityDetailStat compact label="Relics" value={reward.relicsPerCrate} emphasizeValue />
            <EntityDetailStat
              compact
              label="Victory points"
              value={reward.victoryPoints.toLocaleString()}
              emphasizeValue
            />
          </EntityDetailStatList>
        </InfoBubble>
      </div>
      <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={onSimulateBattle} />
    </div>
  );
}
