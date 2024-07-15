import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { currencyFormat } from "../../../utils/utils";

import { ArmyInfo, useArmyByArmyEntityId } from "@/hooks/helpers/useArmies";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { StaminaResource } from "@/ui/elements/StaminaResource";
import clsx from "clsx";
import { useMemo } from "react";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { getRealmNameById } from "../../../utils/realms";
import { formatSecondsLeftInDaysHours } from "../../cityview/realm/labor/laborUtils";
import { InventoryResources } from "../../resources/InventoryResources";
import { ArmyCapacity } from "@/ui/elements/ArmyCapacity";

interface ArmyInfoLabelProps {
  army: ArmyInfo;
  visible?: boolean;
}

export const ArmyInfoLabel = ({ army, visible }: ArmyInfoLabelProps) => {
  return (
    <BaseThreeTooltip
      visible={visible}
      position={Position.TOP_CENTER}
      distanceFactor={50}
      className={`bg-transparent pointer-events-none -mt-[320px]`}
    >
      <RaiderInfo key={army.entity_id} army={army} />
    </BaseThreeTooltip>
  );
};

interface ArmyInfoLabelProps {
  army: ArmyInfo;
}

const RaiderInfo = ({ army }: ArmyInfoLabelProps) => {
  const { getRealmAddressName } = useRealm();
  const nextBlockTimestamp = useBlockchainStore.getState().nextBlockTimestamp;
  const { realm, entity_id, entityOwner, troops, arrivalTime } = army;

  const isPassiveTravel = useMemo(
    () =>
      arrivalTime && arrivalTime.arrives_at && nextBlockTimestamp ? arrivalTime.arrives_at > nextBlockTimestamp : false,
    [arrivalTime?.arrives_at, nextBlockTimestamp],
  );

  const realmId = realm?.realm_id || 0n;

  const attackerAddressName = entityOwner ? getRealmAddressName(entityOwner.entity_owner_id) : "";

  const originRealmName = getRealmNameById(realmId);

  const isTraveling = isPassiveTravel;

  return (
    <div
      className={clsx(
        "w-auto flex flex-col p-2 mb-1 clip-angled-sm text-xs text-gold shadow-2xl border-2 border-gradient",
        army.isMine ? "bg-crimson" : "bg-brown",
      )}
    >
      <div className="flex items-center w-full mt-1 justify-between text-xs">
        <div className="flex flex-col gap-1 w-full">
          <div className="flex items-center text-gold gap-2">
            {/* <OrderIcon order={getRealmOrderNameById(realmId)} className="mr-1" size="md" /> */}

            <Headline className="text-center">
              <div>
                <span className="text-lg">{attackerAddressName}</span> ({originRealmName})
              </div>

              <div className="text-lg">{army.name}</div>
            </Headline>
          </div>

          <div className="self-center flex justify-between w-full">
            {!isTraveling && <div className="flex   italic text-gold self-center">Idle</div>}
            {arrivalTime && arrivalTime.arrives_at !== undefined && isTraveling && nextBlockTimestamp && (
              <div className="flex italic text-light-pink">
                {isPassiveTravel
                  ? formatSecondsLeftInDaysHours(arrivalTime.arrives_at - nextBlockTimestamp)
                  : "Arrives Next Tick"}
                {army.battle_id ? `In Battle` : ""}
              </div>
            )}
            <StaminaResource entityId={entity_id} />
          </div>
        </div>
      </div>
      <div className="w-full flex flex-col mt-2 space-y-2 font-bold">
        <div className="grid grid-cols-3 gap-2 relative justify-between w-full text-gold">
          <div className="px-2 py-1 bg-white/10 clip-angled-sm flex flex-col justify-between gap-2">
            <ResourceIcon withTooltip={false} resource={"Crossbowman"} size="lg" />
            <div className="text-green text-xs self-center">{currencyFormat(troops.crossbowman_count, 0)}</div>
          </div>
          <div className="px-2 py-1 bg-white/10 clip-angled-sm flex flex-col justify-between gap-2">
            <ResourceIcon withTooltip={false} resource={"Knight"} size="lg" />
            <div className="text-green text-xs self-center">{currencyFormat(troops.knight_count, 0)}</div>
          </div>
          <div className="px-2 py-1 bg-white/10 clip-angled-sm flex flex-col justify-between gap-2">
            <ResourceIcon withTooltip={false} resource={"Paladin"} size="lg" />
            <div className="text-green text-xs self-center">{currencyFormat(troops.paladin_count, 0)}</div>
          </div>
        </div>
        <ArmyCapacity army={updatedArmy} />
        <div className="flex flex-row justify-between">
          <InventoryResources max={2} entityIds={[entity_id]} />
        </div>
      </div>
    </div>
  );
};
