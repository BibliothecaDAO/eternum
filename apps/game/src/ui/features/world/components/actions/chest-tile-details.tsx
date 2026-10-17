import { Icon } from "@/ui/design-system/icon";
import type { ReactNode } from "react";
import {
  getRelicInfo,
  type ID,
  relicChestName,
  relicChestPack,
  relicChestRelics,
  ResourcesIds,
} from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY, HUD_HEADLINE } from "@/ui/design-system/atoms/hud-typography";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import type { RelicCrateOpening } from "@/hooks/store/use-relic-crate-store";
import { InfoBubble } from "../entities/collapsible-bubble";
import { EntityDetailStat, EntityDetailStatList } from "../entities/layout";

/**
 * The relic crate tile, in the structure tile's chrome: header, name row, the pack it holds with the Open action. Once
 * the crate is opened the contents list the relics it yielded. Its biome is the tile panel's other part.
 */
export function ChestTileDetails({
  crateEntityId,
  coordsLabel,
  headerAction,
  opening,
  onOpen,
  openBlockedReason,
}: {
  crateEntityId: ID | null;
  coordsLabel?: string;
  headerAction?: ReactNode;
  opening: RelicCrateOpening | null;
  onOpen?: () => void;
  openBlockedReason?: string;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <InfoBubble className="min-w-0" bodyClassName="flex flex-col divide-y divide-gold/15 p-0">
        <InfoBubble variant="section" title={coordsLabel ?? "Relic tile"} cue={headerAction} bodyClassName="pt-0">
          <div className="flex items-center gap-2 text-gold">
            <Icon name="chest" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <p className={cn("truncate", HUD_HEADLINE)}>{opening ? "Crate opened" : "Crate"}</p>
          </div>
        </InfoBubble>
        <InfoBubble variant="section" title="Contents" icon={"chest" as const}>
          {opening ? <RelicList relics={opening.relics} /> : <CrateContents crateEntityId={crateEntityId} />}
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
      </InfoBubble>
    </div>
  );
}

/** The crate's pack, as the chain stored it when the crate appeared, and the points opening it scores. */
const CrateContents = ({ crateEntityId }: { crateEntityId: ID | null }) => {
  const row = useNativeRow(
    "RelicChest",
    crateEntityId === null ? undefined : { game_id: configManager.getActiveGameId(), entity_id: crateEntityId },
  );
  const chest = row && relicChestPack(row);
  return (
    <div className="flex flex-col gap-2">
      {chest && <p className={cn("text-gold", HUD_BODY)}>{relicChestName(chest)}</p>}
      {chest && <RelicList relics={relicChestRelics(chest)} />}
      <EntityDetailStatList compact columns={1}>
        <EntityDetailStat
          compact
          label="Victory points"
          value={configManager.getVictoryPointGrants().openRelicCrate.toLocaleString()}
          emphasizeValue
        />
      </EntityDetailStatList>
    </div>
  );
};

const RelicList = ({ relics }: { relics: ResourcesIds[] }) => (
  <ul aria-label="Relics" className="flex flex-col gap-1">
    {relics.map((relicId, index) => (
      <li key={`${relicId}-${index}`} className={cn("flex items-center gap-2", HUD_BODY)}>
        <ResourceIcon resource={relicId} size="sm" withTooltip={false} />
        <span className="truncate">{getRelicInfo(relicId)?.name ?? ResourcesIds[relicId]}</span>
      </li>
    ))}
  </ul>
);
