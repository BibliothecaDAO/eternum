import { findResourceById } from "@bibliothecadao/eternum";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { currencyFormat, getEntityIdFromKeys } from "../../utils/utils";
import { useMemo } from "react";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { ArmyAndName } from "@/hooks/helpers/useArmies";
import { InventoryResources } from "../resources/InventoryResources";
import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "@/hooks/context/DojoContext";
import { ViewOnMapButton } from "./ArmyManagementCard";

export const ArmyChip = ({ army }: { army: ArmyAndName }) => {
  const { setup } = useDojo();
  const currentTick = useBlockchainStore((state) => state.currentTick);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const troopCounts = useMemo(() => {
    const {
      troops: { crossbowman_count, paladin_count, knight_count },
    } = army;
    const troopCounts = { 250: crossbowman_count, 251: paladin_count, 252: knight_count };
    return (
      <div className="flex ">
        {Object.entries(troopCounts).map(([troopId, count]) => (
          <div key={troopId} className="flex items-center ">
            <ResourceIcon
              isLabor={false}
              withTooltip={false}
              resource={findResourceById(parseInt(troopId))?.trait || ""}
              size="sm"
              className="self-center"
            />
            <div className="text-xs font-bold">{currencyFormat(count, 0)}</div>
          </div>
        ))}
      </div>
    );
  }, [army]);

  const tickMove = getComponentValue(setup.components.TickMove, getEntityIdFromKeys([BigInt(army.entity_id)]));
  const isActiveTravel = useMemo(() => tickMove && tickMove.tick >= currentTick, [tickMove, currentTick]);

  return (
    <div
      className="grid grid-cols-4 gap-2 items-center text-xs p-2 hover:bg-gold/20 border border-gray-300 rounded-md"
      onMouseEnter={() => {
        setTooltip({
          position: "top",
          content: <>{troopCounts}</>,
        });
      }}
      onMouseLeave={() => {
        setTooltip(null);
      }}
    >
      <div className="flex items-center ">
        <div className="text-xs">{army.name}</div>
        <span className="ml-2 mr-1 font-bold">HP:</span>
        <span>{Number((army.current || 0).toString()) / 1000}</span>
      </div>
      <div>{troopCounts}</div>
      <InventoryResources entityId={BigInt(army.entity_id)} max={3} className="flex h-6 text-xs" />
      <div className="flex items-center space-x-1 justify-end">
        <div className="text-xs font-semibold">{isActiveTravel ? "Moving" : "Can Move"}</div>
        <ViewOnMapButton position={{ x: army.x, y: army.y }} className="text-xxs" />
      </div>
    </div>
  );
};
