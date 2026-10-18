import { Icon } from "@/ui/design-system/icon";
import type { ReactNode } from "react";
import { getRelicInfo, type ID, relicChestPack, relicChestRelics, ResourcesIds } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { HudButton, HudPanel, HudRelic } from "@/ui/design-system/kit/hud-elements";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import type { RelicCrateOpening } from "@/hooks/store/use-relic-crate-store";
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
          <div className="flex items-center gap-2 text-hud-accent">
            <Icon name="chest" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <p className="truncate text-hud-title">{opening ? "Crate opened" : "Crate"}</p>
          </div>
        </HudPanel>
        <HudPanel kind="section" title="Contents" icon={"chest" as const}>
          {opening ? <RelicList relics={opening.relics} /> : <CrateContents crateEntityId={crateEntityId} />}
          {!opening && (
            <div className="mt-2">
              <HudButton
                kind="primary"
                onClick={onOpen}
                disabled={!onOpen}
                data-tip={onOpen ? undefined : openBlockedReason}
              >
                {onOpen ? "Open" : "Move next to it"}
              </HudButton>
            </div>
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
        <p className="text-hud-accent text-hud-body">
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

/** A relic's kind as the sheet's relic chip colours it: its type, lower-cased ("Damage Reduction" is "damage-reduction"). */
const relicKind = (type: string) => type.toLowerCase().replace(" ", "-") as Parameters<typeof HudRelic>[0]["kind"];

/** The relics a crate holds or yielded, each as the sheet's relic chip in its kind's colour, its effect on hover. */
const RelicList = ({ relics }: { relics: ResourcesIds[] }) => (
  <ul aria-label="Relics" className="flex flex-col gap-1">
    {relics.map((relicId, index) => {
      const info = getRelicInfo(relicId);
      return (
        <li key={`${relicId}-${index}`}>
          <HudRelic
            icon={resourceMeaning(relicId)}
            kind={info ? relicKind(info.type) : "production"}
            gives={info?.name ?? ResourcesIds[relicId]}
            tip={info?.effect}
          />
        </li>
      );
    })}
  </ul>
);
