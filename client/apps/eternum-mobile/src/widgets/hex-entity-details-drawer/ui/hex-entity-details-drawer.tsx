import { useStore } from "@/shared/store";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import {
  Biome,
  getEntityIdFromKeys,
  isTileOccupierQuest,
  isTileOccupierStructure,
  Position as PositionInterface,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { FELT_CENTER } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { ArmyEntityDetail } from "./army-entity-detail";
import { BiomeInfoPanel } from "./biome-info-panel";
import { QuestEntityDetail } from "./quest-entity-detail";
import { StructureEntityDetail } from "./structure-entity-detail";

interface HexEntityDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HexEntityDetailsDrawer = ({ open, onOpenChange }: HexEntityDetailsDrawerProps) => {
  const dojo = useDojo();
  const selectedHex = useStore((state) => state.selectedHex);

  const tile = useMemo(() => {
    if (!selectedHex) return null;
    const selectedHexContract = new PositionInterface({
      x: selectedHex.col,
      y: selectedHex.row,
    }).getContract();
    return getComponentValue(
      dojo.setup.components.Tile,
      getEntityIdFromKeys([BigInt(selectedHexContract.x), BigInt(selectedHexContract.y)]),
    );
  }, [selectedHex?.col, selectedHex?.row, dojo.setup.components.Tile]);

  const biome = useMemo(() => {
    return Biome.getBiome(selectedHex?.col || 0, selectedHex?.row || 0);
  }, [selectedHex]);

  const hasOccupier = useMemo(() => {
    if (!tile) return false;
    return tile.occupier_id !== 0;
  }, [tile]);

  const isExplored = useMemo(() => {
    if (!tile) return false;
    return tile.biome !== 0;
  }, [tile]);

  const isStructure = useMemo(() => {
    return isTileOccupierStructure(tile?.occupier_type || 0);
  }, [tile]);

  const displayCoordinates = useMemo(() => {
    if (!selectedHex) return null;
    return {
      col: selectedHex.col + FELT_CENTER,
      row: selectedHex.row + FELT_CENTER,
    };
  }, [selectedHex]);

  const getDrawerTitle = () => {
    if (!selectedHex) return "Hex Details";
    return `Hex (${displayCoordinates?.col}, ${displayCoordinates?.row})`;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>{getDrawerTitle()}</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 flex-1 overflow-y-auto">
          {!selectedHex ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                <span className="text-2xl">🗺️</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">No hex selected</h3>
              <p className="text-sm text-muted-foreground">Tap on a hex to see details</p>
            </div>
          ) : !isExplored ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                <span className="text-2xl">🗺️</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Unexplored Territory</h3>
              <p className="text-sm text-muted-foreground mb-2">This hex has not been explored yet</p>
              <p className="text-xs text-muted-foreground">Send an explorer to discover what lies here</p>
            </div>
          ) : (
            <div className="space-y-4">
              <BiomeInfoPanel biome={biome} />

              {hasOccupier && tile && (
                <div className="space-y-3">
                  {isStructure ? (
                    <StructureEntityDetail structureEntityId={tile.occupier_id} compact={true} />
                  ) : isTileOccupierQuest(tile.occupier_type) ? (
                    <QuestEntityDetail questEntityId={tile.occupier_id} compact={true} />
                  ) : (
                    <ArmyEntityDetail armyEntityId={tile.occupier_id} compact={true} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
