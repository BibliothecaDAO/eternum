import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { currencyFormat } from "../../../utils/utils";

import { useMemo } from "react";
import { getRealmNameById, getRealmOrderNameById } from "../../../utils/realms";
import clsx from "clsx";
import { OrderIcon } from "../../../elements/OrderIcon";
import { formatSecondsLeftInDaysHours } from "../../cityview/realm/labor/laborUtils";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { InventoryResources } from "../../resources/InventoryResources";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { ArmyAndName } from "@/hooks/helpers/useArmies";
import { StaminaResource } from "@/ui/elements/StaminaResource";

interface ArmyInfoLabelProps {
  accountAddress: string;
  info: ArmyAndName;
}

export const ArmyInfoLabel = ({ info, accountAddress }: ArmyInfoLabelProps) => {
  return (
    <BaseThreeTooltip position={Position.TOP_CENTER} className={`bg-transparent pointer-events-none -mt-[320px]`}>
      <RaiderInfo key={info.entity_id} info={info} accountAddress={accountAddress} />
    </BaseThreeTooltip>
  );
};

interface ArmyInfoLabelProps {
  info: ArmyAndName;
  accountAddress: string;
}

const RaiderInfo = ({ info, accountAddress }: ArmyInfoLabelProps) => {
  const { getRealmAddressName } = useRealm();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const isPassiveTravel = useMemo(
    () => (info.arrives_at && nextBlockTimestamp ? info.arrives_at > nextBlockTimestamp : false),
    [info.arrives_at, nextBlockTimestamp],
  );

  const isActiveTravel = false;

  const { entity_id, entity_owner_id, address, arrives_at, realm, troops } = info;

  const realmId = BigInt(realm?.realm_id) || 0n;

  const attackerAddressName = entity_owner_id ? getRealmAddressName(BigInt(entity_owner_id)) : "";

  const originRealmName = getRealmNameById(BigInt(realmId));

  const isTraveling = isPassiveTravel || isActiveTravel;

  const bgColor = accountAddress ? (BigInt(accountAddress) === BigInt(address) ? "bg-crimson" : "bg-brown") : undefined;

  const pulseColor = !isTraveling ? "" : "";

  return (
    <div
      className={clsx(
        "w-auto flex flex-col p-2 mb-1 clip-angled-sm text-xs text-gold shadow-2xl border-2 border-gradient",
        bgColor,
        pulseColor,
      )}
    >
      <div className="flex items-center w-full mt-1 justify-between text-xs">
        <div className="flex flex-col gap-1 w-full">
          <div className="flex items-center text-gold text-lg gap-2">
            <OrderIcon order={getRealmOrderNameById(realmId)} className="mr-1" size="sm" />
            {originRealmName}
          </div>
          <div className="self-center flex justify-between w-full">
            {!isTraveling && <div className="flex   italic text-gold self-center">Idle</div>}
            {info.arrives_at && isTraveling && nextBlockTimestamp && (
              <div className="flex   italic text-light-pink">
                {isPassiveTravel ? formatSecondsLeftInDaysHours(arrives_at - nextBlockTimestamp) : "Arrives Next Tick"}
              </div>
            )}
            <StaminaResource entityId={BigInt(entity_id)} />
          </div>
        </div>
        {/* <div className="-mt-2">{attackerAddressName}</div> */}
      </div>
      <div className="w-full flex flex-col mt-2 space-y-2 font-bold">
        <div className="grid grid-cols-3 gap-2 relative justify-between w-full text-gold">
          <div className="px-2 py-1 bg-white/10 clip-angled-sm flex flex-col justify-between gap-2">
            <ResourceIcon withTooltip={false} resource={"Crossbowmen"} size="lg" />
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

        <div className="flex flex-row justify-between">
          <InventoryResources max={2} entityId={BigInt(entity_id)} />
        </div>
      </div>
    </div>
  );
};
