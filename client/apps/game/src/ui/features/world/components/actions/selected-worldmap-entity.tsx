import { useUIStore } from "@/hooks/store/use-ui-store";
import { BiomeInfoPanel } from "@/ui/features/world";
import { ArmyBannerEntityDetail } from "@/ui/features/world/components/entities/banner/army-banner-entity-detail";
import { StructureBannerEntityDetail } from "@/ui/features/world/components/entities/banner/structure-banner-entity-detail";
import { QuestEntityDetail } from "@/ui/features/world/components/entities/quest-entity-detail";
import { RelicCrateEntityDetail } from "@/ui/features/world/components/entities/relic-crate-entity-detail";
import {
  Biome,
  getEntityIdFromKeys,
  isTileOccupierChest,
  isTileOccupierQuest,
  isTileOccupierStructure,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { HexPosition } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

export const SelectedWorldmapEntity = () => {
  const selectedHex = useUIStore((state) => state.selectedHex);

  if (!selectedHex) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/5 bg-black/40 p-4 text-sm text-slate-200/70">
        Select a hex to inspect armies, structures, and terrain.
      </div>
    );
  }

  return <SelectedWorldmapEntityContent selectedHex={selectedHex} />;
};

const SelectedWorldmapEntityContent = ({ selectedHex }: { selectedHex: HexPosition }) => {
  const { setup } = useDojo();
  const tileComponent = setup.components.Tile;

  const rawTile = useMemo(() => {
    if (!selectedHex || !tileComponent) return undefined;
    const contractPosition = {
      x: BigInt(selectedHex.col),
      y: BigInt(selectedHex.row),
    };

    return getComponentValue(tileComponent, getEntityIdFromKeys([contractPosition.x, contractPosition.y]));
  }, [tileComponent, selectedHex?.col, selectedHex?.row]);

  const tile = rawTile ?? null;
  const isTileLoaded = rawTile !== undefined;

  const biome = useMemo(() => {
    return Biome.getBiome(selectedHex.col || 0, selectedHex.row || 0);
  }, [selectedHex.col, selectedHex.row]);

  const hasOccupier = !!tile && Number(tile.occupier_id) !== 0;
  const occupierType = tile?.occupier_type ?? 0;
  const isStructure = isTileOccupierStructure(occupierType);
  const isChest = isTileOccupierChest(occupierType);
  const isQuest = isTileOccupierQuest(occupierType);
  const isExplored = !!tile && Number(tile.biome) !== 0;

  if (!isTileLoaded) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4">
        <span className="text-xs text-slate-200/60">Fetching tile data…</span>
      </div>
    );
  }

  if (!isExplored) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-slate-100/80">
        Unexplored territory. Send an explorer to reveal this tile.
      </div>
    );
  }

  if (!hasOccupier) {
    return <BiomeInfoPanel biome={biome} collapsed={false} />;
  }

  return (
    <div className="">
      {isStructure ? (
        <StructureBannerEntityDetail
          structureEntityId={tile?.occupier_id}
          compact
          maxInventory={12}
          showButtons={false}
        />
      ) : isChest ? (
        <RelicCrateEntityDetail crateEntityId={tile?.occupier_id} layout="banner" compact />
      ) : isQuest ? (
        <QuestEntityDetail questEntityId={tile?.occupier_id} layout="banner" className="h-full" compact />
      ) : (
        <ArmyBannerEntityDetail
          armyEntityId={tile?.occupier_id}
          compact
          showButtons={false}
          bannerPosition={selectedHex}
        />
      )}
    </div>
  );
};
