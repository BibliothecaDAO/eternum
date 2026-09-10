import type { ReactNode } from "react";
import { type BiomeType, getRelicInfo, type ID, ResourcesIds } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY, HUD_HEADLINE } from "@/ui/design-system/atoms/hud-typography";
import { HUD_PILL_BUTTON, OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import type { RelicCrateOpening } from "@/hooks/store/use-relic-crate-store";
import { InfoBubble } from "../entities/collapsible-bubble";
import { EntityDetailStat, EntityDetailStatList } from "../entities/layout";
import { BiomeSummaryCard } from "./unoccupied-tile-quadrants";

/**
 * The relic crate tile, in the structure tile's chrome: header, name row, contents from config with the Open
 * action, then the biome. Once the crate is opened the contents list the relics it yielded.
 */
export function ChestTileDetails({
  crateEntityId,
  biome,
  coordsLabel,
  headerAction,
  opening,
  onOpen,
  openBlockedReason,
  onSimulateBattle,
}: {
  crateEntityId: ID | null;
  biome: BiomeType;
  coordsLabel?: string;
  headerAction?: ReactNode;
  opening: RelicCrateOpening | null;
  onOpen?: () => void;
  openBlockedReason?: string;
  onSimulateBattle: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className={cn("flex min-w-0 flex-col divide-y divide-gold/15 rounded-xl", OVERLAY_SURFACE_BASE)}>
        <InfoBubble variant="section" title={coordsLabel ?? "Relic tile"} cue={headerAction} bodyClassName="pt-0">
          <div className="flex items-center gap-2 text-gold">
            <img
              src={opening ? "/images/relic-chest/chest-opened.png" : "/images/relic-chest/chest-closed.png"}
              alt=""
              className="h-9 w-9 shrink-0 object-contain"
            />
            <p className={cn("truncate", HUD_HEADLINE)}>
              {opening ? "Crate opened" : crateEntityId === null ? "Crate" : `Crate #${crateEntityId}`}
            </p>
          </div>
        </InfoBubble>
        <InfoBubble variant="section" title="Contents" icon={Sparkles}>
          {opening ? <RelicList relics={opening.relics} /> : <CrateContents />}
          {!opening && (
            <button
              type="button"
              onClick={onOpen}
              disabled={!onOpen}
              title={openBlockedReason}
              className={cn(HUD_PILL_BUTTON, "mt-2")}
            >
              Open
            </button>
          )}
        </InfoBubble>
      </div>
      <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={onSimulateBattle} />
    </div>
  );
}

const CrateContents = () => {
  const reward = configManager.getRelicCrateReward();
  return (
    <EntityDetailStatList compact columns={2}>
      <EntityDetailStat compact label="Relics" value={reward.relicsPerCrate} emphasizeValue />
      <EntityDetailStat compact label="Victory points" value={reward.victoryPoints.toLocaleString()} emphasizeValue />
    </EntityDetailStatList>
  );
};

const RelicList = ({ relics }: { relics: ResourcesIds[] }) => (
  <ul aria-label="Relics found" className="flex flex-col gap-1">
    {relics.map((relicId, index) => (
      <li key={`${relicId}-${index}`} className={cn("flex items-center gap-2", HUD_BODY)}>
        <ResourceIcon resource={ResourcesIds[relicId]} size="sm" withTooltip={false} />
        <span className="truncate">{getRelicInfo(relicId)?.name ?? ResourcesIds[relicId]}</span>
      </li>
    ))}
  </ul>
);
