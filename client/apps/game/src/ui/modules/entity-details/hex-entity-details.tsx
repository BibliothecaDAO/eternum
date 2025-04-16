import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import { ArmyEntityDetail } from "@/ui/components/worldmap/entities/army-entity-detail";
import { StructureEntityDetail } from "@/ui/components/worldmap/entities/structure-entity-detail";
import {
  getArmy,
  getEntityIdFromKeys,
  getGuildFromPlayerAddress,
  getRealmNameById,
  getStructure,
  isTileOccupierStructure,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ArmyInfo, ContractAddress, Structure, TileOccupier } from "@bibliothecadao/types";
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

  // Early return if no tile or no occupier
  if (!tile?.occupier_id) {
    return <div className="h-full flex items-center justify-center text-center">Select a tile with an entity</div>;
  }

  const userAddress = ContractAddress(dojo.account.account.address);

  // Get available resources for the entity
  const availableResources = new ResourceManager(dojo.setup.components, tile.occupier_id || 0).getResourceBalances();

  // Determine entity type and get relevant data
  const occupierId = tile.occupier_id || 0;
  let entityContent = null;

  // Handle structure types
  if (isTileOccupierStructure(tile.occupier_type)) {
    const structure = getStructure(occupierId, userAddress, dojo.setup.components) as Structure;
    if (!structure) return null;

    const playerGuild = getGuildFromPlayerAddress(ContractAddress(structure.owner || 0n), dojo.setup.components);

    entityContent = (
      <div className="p-4">
        <StructureEntityDetail
          structure={structure}
          playerGuild={playerGuild}
          compact={false}
          maxInventory={Infinity}
          showButtons={true}
          className="max-w-md mx-auto"
        />
      </div>
    );
  }
  // Handle army types
  else if (tile.occupier_type === TileOccupier.Explorer) {
    const army = getArmy(occupierId, userAddress, dojo.setup.components) as ArmyInfo;
    if (!army) return null;

    const playerGuild = getGuildFromPlayerAddress(ContractAddress(army.owner || 0n), dojo.setup.components);
    const realmId = army.structure?.metadata.realm_id || 0;
    const originRealmName = getRealmNameById(realmId);

    entityContent = (
      <div className={`p-4 ${army.isMine ? "bg-ally/20" : "bg-red/10"}`}>
        <ArmyEntityDetail
          army={army}
          playerGuild={playerGuild}
          availableResources={availableResources}
          originRealmName={originRealmName}
          compact={false}
          className="max-w-md mx-auto"
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {entityContent || <div className="h-full flex items-center justify-center text-center">Unknown entity type</div>}
    </div>
  );
};
