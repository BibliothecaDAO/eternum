import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import { ArmyWarning } from "@/ui/components/worldmap/armies/army-warning";
import { StructureListItem } from "@/ui/components/worldmap/structures/structure-list-item";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import { BaseThreeTooltip, Position } from "@/ui/elements/base-three-tooltip";
import { Headline } from "@/ui/elements/headline";
import { StaminaResource } from "@/ui/elements/stamina-resource";
import {
  ArmyInfo,
  ClientComponents,
  ContractAddress,
  getArmy,
  getEntityIdFromKeys,
  getGuildFromPlayerAddress,
  getRealmNameById,
  getStructure,
  isTileOccupierStructure,
  Structure,
  TileOccupier,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import clsx from "clsx";
import { memo, useMemo } from "react";
import { TroopChip } from "../../military/troop-chip";
import { ImmunityTimer } from "../structures/immunity-timer";

export const EntityInfoLabel = memo(() => {
  const dojo = useDojo();
  const { isMapView } = useQuery();
  const hoveredHex = useUIStore((state) => state.hoveredHex);

  const tile = useMemo(() => {
    if (!hoveredHex || !isMapView) return null;
    const hoveredHexContract = new PositionInterface({
      x: hoveredHex.col || 0,
      y: hoveredHex.row || 0,
    }).getContract();

    return getComponentValue(
      dojo.setup.components.Tile,
      getEntityIdFromKeys([BigInt(hoveredHexContract.x), BigInt(hoveredHexContract.y)]),
    );
  }, [hoveredHex?.col, hoveredHex?.row]);

  if (!tile?.occupier_id) {
    return null;
  }

  return <EntityInfoContent tile={tile} />;
});

const EntityInfoContent = memo(({ tile }: { tile: ComponentValue<ClientComponents["Tile"]["schema"]> }) => {
  const dojo = useDojo();
  const userAddress = ContractAddress(dojo.account.account.address);

  // Get entity info only if we have a valid tile with an occupier
  const entityInfo = useMemo(() => {
    const occupierId = tile.occupier_id || 0;

    // Structure types
    const isStructure = [
      TileOccupier.RealmRegular,
      TileOccupier.RealmWonder,
      TileOccupier.Hyperstructure,
      TileOccupier.FragmentMine,
      TileOccupier.Village,
      TileOccupier.Bank,
    ].includes(tile.occupier_type);

    if (isStructure) {
      return getStructure(occupierId, userAddress, dojo.setup.components);
    }

    if (tile.occupier_type === TileOccupier.Explorer) {
      return getArmy(occupierId, userAddress, dojo.setup.components);
    }

    return null;
  }, [tile]);

  // Early return if no entity info
  if (!entityInfo) return null;

  const playerGuild = getGuildFromPlayerAddress(ContractAddress(entityInfo.owner || 0n), dojo.setup.components);

  if (isTileOccupierStructure(tile.occupier_type)) {
    const structure = entityInfo as Structure;
    return (
      <BaseThreeTooltip position={Position.CLEAN} className={`pointer-events-none w-[350px]`}>
        <div className="flex flex-col gap-1">
          <Headline className="text-center text-lg">
            <div>{structure.ownerName}</div>
            {playerGuild && (
              <div>
                {"< "}
                {playerGuild.name}
                {" >"}
              </div>
            )}
          </Headline>
          <StructureListItem structure={structure} maxInventory={3} />
          <ImmunityTimer structure={structure} />
        </div>
      </BaseThreeTooltip>
    );
  } else if (tile.occupier_type === TileOccupier.Explorer) {
    const army = entityInfo as ArmyInfo;
    const realmId = army.structure?.metadata.realm_id || 0;
    const originRealmName = getRealmNameById(realmId);

    return (
      <BaseThreeTooltip
        position={Position.CLEAN}
        className={`pointer-events-none w-[250px] ${army.isMine ? "bg-ally" : "bg-enemy"}`}
      >
        <div className={clsx("gap-1")}>
          <Headline className="text-center text-lg">
            <div>{army.ownerName}</div>
          </Headline>
          <ArmyWarning army={army} />
          <div id="army-info-label-content" className="self-center flex justify-between w-full">
            <div className="h4 flex font-semibold flex-col items-start">
              <div className="text-base">{originRealmName}</div>
              <div className="text-xs text-gold/80">{army.name}</div>
            </div>
            <div className="flex flex-col items-end">
              <StaminaResource entityId={army.entityId} />
              <ArmyCapacity army={army} className="mt-1" />
            </div>
          </div>
          <div className="w-full h-full flex flex-col mt-2 space-y-2">
            <TroopChip troops={army.troops} />
          </div>
          {/* {army.structure && <ImmunityTimer structure={army.structure} />} */}
        </div>
      </BaseThreeTooltip>
    );
  }

  return null;
});

EntityInfoLabel.displayName = "EntityInfoLabel";
