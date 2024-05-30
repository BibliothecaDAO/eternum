import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { useCombat } from "../../../../hooks/helpers/useCombat";
import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { currencyFormat } from "../../../utils/utils";
import { type CombatInfo } from "@bibliothecadao/eternum";

import { useMemo } from "react";
import { getRealmNameById, getRealmOrderNameById } from "../../../utils/realms";
import clsx from "clsx";
import { OrderIcon } from "../../../elements/OrderIcon";
import { formatSecondsLeftInDaysHours } from "../../cityview/realm/labor/laborUtils";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { InventoryResources } from "../../resources/InventoryResources";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";

interface ArmyInfoLabelProps {
  armyId: bigint;
}

export const ArmyInfoLabel = ({ armyId }: ArmyInfoLabelProps) => {
  const { getEntitiesCombatInfo } = useCombat();

  const { getRealmAddressName } = useRealm();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const raider = useMemo(() => {
    return getEntitiesCombatInfo([armyId])[0];
  }, [armyId]);

  const isPassiveTravel = useMemo(
    () => (raider.arrivalTime && nextBlockTimestamp ? raider.arrivalTime > nextBlockTimestamp : false),
    [raider.arrivalTime, nextBlockTimestamp],
  );

  return (
    <BaseThreeTooltip
      position={"-left-1/2 -mt-[200px]"}
      distanceFactor={30}
      className={`bg-transparent pointer-events-none`}
    >
      <RaiderInfo
        key={raider.entityId}
        raider={raider}
        getRealmAddressName={getRealmAddressName}
        nextBlockTimestamp={nextBlockTimestamp}
        isPassiveTravel={isPassiveTravel}
        isActiveTravel={false}
      />
    </BaseThreeTooltip>
  );
};

const RaiderInfo = ({
  raider,
  getRealmAddressName,
  nextBlockTimestamp,
  isPassiveTravel,
  isActiveTravel,
}: {
  raider: CombatInfo;
  getRealmAddressName: (name: bigint) => string;
  nextBlockTimestamp: number | undefined;
  isPassiveTravel: boolean;
  isActiveTravel: boolean;
}) => {
  const { account, masterAccount } = useDojo();
  const { entityOwnerId, health, owner, originRealmId } = raider;

  const attackerAddressName = entityOwnerId ? getRealmAddressName(entityOwnerId) : "";

  const originRealmName = originRealmId ? getRealmNameById(originRealmId) : "";

  const isTraveling = isPassiveTravel || isActiveTravel;

  const bgColor = account.account.address
    ? BigInt(account.account.address) === owner
      ? "bg-dark-green-accent"
      : "bg-red"
    : undefined;

  if (!bgColor || account.account.address === masterAccount.address) return;

  const pulseColor = !isTraveling ? "" : "";

  return (
    <div className={clsx("w-[200px] flex flex-col p-2 mb-1 clip-angled-sm text-xs text-gold", bgColor, pulseColor)}>
      <div className="flex items-center w-full mt-1 justify-between text-xs">
        <div className="flex items-center ml-1 -mt-2">
          <div className="flex items-center ml-1 mr-1 text-gold">
            <OrderIcon order={getRealmOrderNameById(originRealmId || 0n)} className="mr-1" size="xxs" />
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
          {raider.arrivalTime && isTraveling && nextBlockTimestamp && (
            <div className="flex ml-auto -mt-2 italic text-light-pink">
              {isPassiveTravel
                ? formatSecondsLeftInDaysHours(raider.arrivalTime - nextBlockTimestamp)
                : "Arrives Next Tick"}
            </div>
          )}
        </div>
      </div>
      <div className="w-full flex flex-col mt-2 space-y-2">
        <div className="flex relative justify-between w-full text-gold">
          <div className="px-2 py-1 bg-white/10 clip-angled-sm flex flex-col justify-between">
            <ResourceIcon withTooltip={false} resource={"Crossbowmen"} size="lg" />
            <div className="text-green text-xxs self-center">{currencyFormat(raider.troops.crossbowmanCount, 0)}</div>
          </div>
          <div className="px-2 py-1 bg-white/10 clip-angled-sm flex flex-col justify-between">
            <ResourceIcon withTooltip={false} resource={"Knight"} size="lg" />
            <div className="text-green text-xxs self-center">{currencyFormat(raider.troops.knightCount, 0)}</div>
          </div>
          <div className="px-2 py-1 bg-white/10 clip-angled-sm flex flex-col justify-between">
            <ResourceIcon withTooltip={false} resource={"Paladin"} size="lg" />
            <div className="text-green text-xxs self-center">{currencyFormat(raider.troops.paladinCount, 0)}</div>
          </div>
        </div>
        <div className="flex">
          <InventoryResources max={2} entityId={raider.entityId} title="Balance" />
          <div>
            <div className="uppercase font-bold mb-2">Stamina</div>
            <div className=""> 200 </div>
          </div>
        </div>
      </div>
    </div>
  );
};
