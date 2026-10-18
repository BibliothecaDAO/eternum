import { Icon } from "@/ui/design-system/icon";
import type { ReactNode } from "react";
import { getRelicInfo, type ID, relicChestPack, relicChestRelics, ResourcesIds } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY, HUD_HEADLINE } from "@/ui/design-system/atoms/hud-typography";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import type { RelicCrateOpening } from "@/hooks/store/use-relic-crate-store";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";
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
      <HudPanel className="min-w-0" divided bodyClassName="flex flex-col">
        <HudPanel kind="section" title={coordsLabel ?? "Relic tile"} cue={headerAction} bodyClassName="pt-0">
          <div className="flex items-center gap-2 text-hud-ink">
            <Icon name="chest" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <p className={cn("truncate", HUD_HEADLINE)}>{opening ? "Crate opened" : "Crate"}</p>
          </div>
        </HudPanel>
        <HudPanel kind="section" title="Contents" icon={"chest" as const}>
          {opening ? <RelicList relics={opening.relics} /> : <CrateContents crateEntityId={crateEntityId} />}
          {!opening && (
            <button
              type="button"
              onClick={onOpen}
              disabled={!onOpen}
              data-tip={onOpen ? undefined : openBlockedReason}
              className={cn(HUD_PILL_BUTTON, "mt-2")}
            >
              {onOpen ? "Open" : "Move next to it"}
            </button>
          )}
        </HudPanel>
      </HudPanel>
    </div>
  );
}

/** The relics the crate holds, as the chain stored them when the crate appeared, and the points opening it scores. */
const CrateContents = ({ crateEntityId }: { crateEntityId: ID | null }) => {
  const row = useNativeRow(
    "RelicChest",
    crateEntityId === null ? undefined : { game_id: configManager.getActiveGameId(), entity_id: crateEntityId },
  );
  const relics = row && relicChestRelics(relicChestPack(row));
  return (
    <div className="flex flex-col gap-2">
      {relics && (
        <p className={cn("text-hud-ink", HUD_BODY)}>
          {relics.length === 1 ? "1 relic" : `${relics.length} relics`} inside
        </p>
      )}
      {relics && <RelicList relics={relics} />}
      <EntityDetailStatList compact columns={1}>
        <EntityDetailStat
          compact
          label="Points"
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
