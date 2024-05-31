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

interface ArmyInfoLabelProps {
  accountAddress: string;
  info: ArmyAndName;
}

export const ArmyInfoLabel = ({ info, accountAddress }: ArmyInfoLabelProps) => {
  return (
    <BaseThreeTooltip position={Position.TOP_CENTER} className={`bg-transparent pointer-events-none -mt-[220px]`}>
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

  const bgColor = accountAddress
    ? BigInt(accountAddress) === BigInt(address)
      ? "bg-dark-green-accent"
      : "bg-red"
    : undefined;

  const pulseColor = !isTraveling ? "" : "";

  return (
    <div className={clsx("w-[200px] flex flex-col p-2 mb-1 clip-angled-sm text-xs text-gold", bgColor, pulseColor)}>
      <div className="flex items-center w-full mt-1 justify-between text-xs">
        <div className="flex items-center ml-1 -mt-2">
          <div className="flex items-center ml-1 mr-1 text-gold">
            <OrderIcon order={getRealmOrderNameById(realmId)} className="mr-1" size="xxs" />
            {originRealmName}
          </div>
        </div>
        <div className="-mt-2">{attackerAddressName}</div>
        <div>
          {!isTraveling && (
            <div className="flex ml-auto -mt-2 italic text-gold">
              Idle
              <Pen className="ml-1 fill-gold" />
            </div>
          )}
          {info.arrives_at && isTraveling && nextBlockTimestamp && (
            <div className="flex ml-auto -mt-2 italic text-light-pink">
              {isPassiveTravel ? formatSecondsLeftInDaysHours(arrives_at - nextBlockTimestamp) : "Arrives Next Tick"}
            </div>
          )}
        </div>
      </div>
      <div className="w-full flex flex-col mt-2 space-y-2">
        <div className="flex relative justify-between w-full text-gold">
          <div className="px-2 py-1 bg-white/10 clip-angled-sm flex flex-col justify-between">
            <ResourceIcon withTooltip={false} resource={"Crossbowmen"} size="lg" />
            <div className="text-green text-xxs self-center">{currencyFormat(troops.crossbowman_count, 0)}</div>
          </div>
          <div className="px-2 py-1 bg-white/10 clip-angled-sm flex flex-col justify-between">
            <ResourceIcon withTooltip={false} resource={"Knight"} size="lg" />
            <div className="text-green text-xxs self-center">{currencyFormat(troops.knight_count, 0)}</div>
          </div>
          <div className="px-2 py-1 bg-white/10 clip-angled-sm flex flex-col justify-between">
            <ResourceIcon withTooltip={false} resource={"Paladin"} size="lg" />
            <div className="text-green text-xxs self-center">{currencyFormat(troops.paladin_count, 0)}</div>
          </div>
        </div>
        <div className="flex">
          <InventoryResources max={2} entityId={BigInt(entity_id)} title="Balance" />
          <div>
            <div className="uppercase font-bold mb-2">Stamina</div>
            <div className=""> 200 </div>
          </div>
        </div>
      </div>
    </div>
  );
};
