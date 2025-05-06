import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import { BiomeInfoPanel } from "@/ui/components/biome/biome-info-panel";
import { ArmyEntityDetail } from "@/ui/components/worldmap/entities/army-entity-detail";
import { StructureEntityDetail } from "@/ui/components/worldmap/entities/structure-entity-detail";
import { Biome, getEntityIdFromKeys, isTileOccupierStructure } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

export const HexEntityDetails = () => {
  const dojo = useDojo();
  const selectedHex = useUIStore((state) => state.selectedHex);

  // Get tile data based on selected hex
  const tile = useMemo(() => {
    if (!selectedHex) return null;

    const selectedHexContract = new PositionInterface({
      x: selectedHex.col || 0,
      y: selectedHex.row || 0,
    }).getContract();

    return getComponentValue(
      dojo.setup.components.Tile,
      getEntityIdFromKeys([BigInt(selectedHexContract.x), BigInt(selectedHexContract.y)]),
    );
  }, [selectedHex?.col, selectedHex?.row]);

  const biome = useMemo(() => {
    return Biome.getBiome(selectedHex?.col || 0, selectedHex?.row || 0);
  }, [selectedHex]);

  const hasOccupier = useMemo(() => {
    return tile?.occupier_id !== 0;
  }, [tile]);

  const isStructure = useMemo(() => {
    return isTileOccupierStructure(tile?.occupier_type || 0);
  }, [tile]);

  return (
    <div className="h-full overflow-auto p-2">
      <div className={`${hasOccupier ? "h-50" : "h-full"}`}>
        <BiomeInfoPanel biome={biome} compact={hasOccupier} />
      </div>
      {hasOccupier && tile && (
        <div>
          {isStructure ? (
            <StructureEntityDetail
              structureEntityId={tile.occupier_id}
              compact={false}
              maxInventory={Infinity}
              showButtons={true}
            />
          ) : (
            <ArmyEntityDetail armyEntityId={tile.occupier_id} compact={false} />
          )}
        </div>
      )}
    </div>
  );
};
