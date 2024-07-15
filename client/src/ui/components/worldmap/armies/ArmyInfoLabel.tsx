import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { currencyFormat } from "../../../utils/utils";

import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { StaminaResource } from "@/ui/elements/StaminaResource";
import clsx from "clsx";
import { useMemo } from "react";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { OrderIcon } from "../../../elements/OrderIcon";
import { getRealmNameById, getRealmOrderNameById } from "../../../utils/realms";
import { formatSecondsLeftInDaysHours } from "../../cityview/realm/labor/laborUtils";
import { InventoryResources } from "../../resources/InventoryResources";
import { Headline } from "@/ui/elements/Headline";

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
  const {
    account: { account },
  } = useDojo();

  const { getRealmAddressName } = useRealm();
  const nextBlockTimestamp = useBlockchainStore.getState().nextBlockTimestamp as number;
  const { entity_id, entity_owner_id, address, arrives_at, realm, troops, battle_id } = army;

  const isPassiveTravel = useMemo(
    () => (army.arrives_at && nextBlockTimestamp ? army.arrives_at > nextBlockTimestamp : false),
    [army.arrives_at, nextBlockTimestamp],
  );

  const realmId = BigInt(realm?.realm_id || 0);

  const attackerAddressName = entity_owner_id ? getRealmAddressName(BigInt(entity_owner_id)) : "";

  const originRealmName = getRealmNameById(BigInt(realmId));

  const isTraveling = isPassiveTravel;

  return (
    <div
      className={clsx(
        "w-auto flex flex-col p-2 mb-1 clip-angled-sm text-xs text-gold shadow-2xl border-2 border-gradient",
        account.address ? (BigInt(account.address) === BigInt(address) ? "bg-crimson" : "bg-brown") : undefined,
      )}
    >
      <div className="flex items-center w-full mt-1 justify-between text-xs">
        <div className="flex flex-col gap-1 w-full">
          <div className="flex items-center text-gold gap-2">
            {/* <OrderIcon order={getRealmOrderNameById(realmId)} className="mr-1" size="md" /> */}

            <Headline className="text-center">
              <div><span className="text-lg">{attackerAddressName}</span> ({originRealmName})</div>

              <div className="text-lg">{army.name}</div>
            </Headline>
          </div>

          <div className="self-center flex justify-between w-full">
            {!isTraveling && <div className="flex   italic text-gold self-center">Idle</div>}
            {army.arrives_at && isTraveling && nextBlockTimestamp && (
              <div className="flex italic text-light-pink">
                {isPassiveTravel ? formatSecondsLeftInDaysHours(arrives_at - nextBlockTimestamp) : "Arrives Next Tick"}
                {battle_id && `In Battle`}
              </div>
            )}
            <StaminaResource entityId={BigInt(entity_id)} />
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

        <div className="flex flex-row justify-between">
          <InventoryResources max={2} entityId={BigInt(entity_id)} />
        </div>
      </div>
    </div>
  );
};
