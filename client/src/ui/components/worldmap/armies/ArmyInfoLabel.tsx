import useUIStore from "../../../../hooks/store/useUIStore";
import { currencyFormat } from "../../../utils/utils";

import { ArmyInfo, getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { useQuery } from "@/hooks/helpers/useQuery";
import { ArmyCapacity } from "@/ui/elements/ArmyCapacity";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { StaminaResource } from "@/ui/elements/StaminaResource";
import { formatSecondsLeftInDaysHours } from "@/ui/utils/utils";
import clsx from "clsx";
import { useMemo } from "react";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { getRealmNameById } from "../../../utils/realms";
import { InventoryResources } from "../../resources/InventoryResources";

export const ArmyInfoLabel = () => {
  const { isMapView } = useQuery();
  const hoveredArmyEntityId = useUIStore((state) => state.hoveredArmyEntityId);
  const { getArmy } = getArmyByEntityId();

  const army = useMemo(() => {
    if (hoveredArmyEntityId) return getArmy(hoveredArmyEntityId);
    return undefined;
  }, [hoveredArmyEntityId, getArmy]);

  return (
    <>
      {army && isMapView && (
        <BaseThreeTooltip position={Position.CLEAN} className={`bg-transparent pointer-events-none w-[250px]`}>
          <RaiderInfo key={army.entity_id} army={army} />
        </BaseThreeTooltip>
      )}
    </>
  );
};

interface ArmyInfoLabelProps {
  army: ArmyInfo;
}

const RaiderInfo = ({ army }: ArmyInfoLabelProps) => {
  const { getRealmAddressName } = useRealm();
  const nextBlockTimestamp = useUIStore.getState().nextBlockTimestamp;
  const { realm, entity_id, entityOwner, troops, arrivalTime } = army;

  const isPassiveTravel = useMemo(
    () =>
      arrivalTime && arrivalTime.arrives_at && nextBlockTimestamp ? arrivalTime.arrives_at > nextBlockTimestamp : false,
    [arrivalTime?.arrives_at, nextBlockTimestamp],
  );

  const realmId = realm?.realm_id || 0;

  const attackerAddressName = entityOwner ? getRealmAddressName(entityOwner.entity_owner_id) : "";

  const originRealmName = getRealmNameById(realmId);

  const isTraveling = isPassiveTravel;

  return (
    <div
      className={clsx(
        "w-auto flex flex-col p-2 text-xs text-gold shadow-2xl border-2 border-gold/30 bg-hex-bg ",
        army.isMine ? "bg-ally" : "bg-enemy",
      )}
    >
      <div className="flex items-center w-full mt-1 justify-between text-xs">
        <div className="flex flex-col gap-1 w-full">
          <div className="flex items-center text-gold gap-2">
            {/* <OrderIcon order={getRealmOrderNameById(realmId)} className="mr-1" size="md" /> */}

            <Headline className="text-center text-lg">
              <div>{army.name}</div>
            </Headline>
          </div>

          <div className="self-center flex justify-between w-full">
            {!isTraveling && <div className="flex   italic text-gold self-center">Idle</div>}
            {arrivalTime && arrivalTime.arrives_at !== undefined && isTraveling && nextBlockTimestamp && (
              <div className="flex italic text-light-pink">
                {isPassiveTravel
                  ? formatSecondsLeftInDaysHours(Number(arrivalTime.arrives_at) - nextBlockTimestamp)
                  : "Arrives Next Tick"}
                {army.battle_id ? `In Battle` : ""}
              </div>
            )}
            <StaminaResource entityId={entity_id} />
          </div>
        </div>
      </div>
      <div className="w-full flex flex-col mt-2 space-y-2">
        <div className="grid grid-cols-3 gap-2 relative justify-between w-full text-gold">
          <div className="px-2 py-1 bg-white/10  flex flex-col justify-between gap-2">
            <ResourceIcon withTooltip={false} resource={"Crossbowman"} size="lg" />
            <div className="text-green text-xs self-center">{currencyFormat(Number(troops.crossbowman_count), 0)}</div>
          </div>
          <div className="px-2 py-1 bg-white/10  flex flex-col justify-between gap-2">
            <ResourceIcon withTooltip={false} resource={"Knight"} size="lg" />
            <div className="text-green text-xs self-center">{currencyFormat(Number(troops.knight_count), 0)}</div>
          </div>
          <div className="px-2 py-1 bg-white/10  flex flex-col justify-between gap-2">
            <ResourceIcon withTooltip={false} resource={"Paladin"} size="lg" />
            <div className="text-green text-xs self-center">{currencyFormat(Number(troops.paladin_count), 0)}</div>
          </div>
        </div>
        <ArmyCapacity army={army} />
        <div className="flex flex-row justify-between">
          <InventoryResources max={2} entityIds={[entity_id]} />
        </div>
      </div>

      <div className="text-xs text-center py-1">
        <span>{attackerAddressName}</span> ({originRealmName})
      </div>
    </div>
  );
};
