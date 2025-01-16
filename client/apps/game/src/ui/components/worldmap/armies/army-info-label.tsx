import { ArmyWarning } from "@/ui/components/worldmap/armies/army-warning";
import { ImmunityTimer } from "@/ui/components/worldmap/structures/structure-label";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import { BaseThreeTooltip, Position } from "@/ui/elements/base-three-tooltip";
import { Headline } from "@/ui/elements/headline";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { StaminaResource } from "@/ui/elements/stamina-resource";
import { currencyFormat } from "@/ui/utils/utils";
import {
  ArmyInfo,
  ContractAddress,
  getArmy,
  getRealmAddressName,
  getRealmNameById,
  getStructure,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery, useUIStore } from "@bibliothecadao/react";
import clsx from "clsx";
import { useMemo } from "react";

export const ArmyInfoLabel = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { isMapView } = useQuery();
  const hoveredArmyEntityId = useUIStore((state) => state.hoveredArmyEntityId);

  const army = useMemo(() => {
    if (hoveredArmyEntityId) return getArmy(hoveredArmyEntityId, ContractAddress(account.address), components);
    return undefined;
  }, [hoveredArmyEntityId]);

  return <>{army && isMapView && <RaiderInfo key={army.entity_id} army={army} />}</>;
};

interface ArmyInfoLabelProps {
  army: ArmyInfo;
}

const RaiderInfo = ({ army }: ArmyInfoLabelProps) => {
  const {
    account: {
      account: { address },
    },
    setup: { components },
  } = useDojo();

  const { realm, entity_id, entityOwner, troops } = army;

  const realmId = realm?.realm_id || 0;

  const attackerAddressName = entityOwner ? getRealmAddressName(entityOwner.entity_owner_id, components) : "";

  const originRealmName = getRealmNameById(realmId);

  const structure = useMemo(() => {
    if (entityOwner.entity_owner_id) {
      return getStructure(entityOwner.entity_owner_id, ContractAddress(address), components);
    }
  }, [entityOwner.entity_owner_id]);

  return (
    <BaseThreeTooltip
      position={Position.CLEAN}
      className={`pointer-events-none w-[250px] ${army.isMine ? "bg-ally" : "bg-enemy"}`}
    >
      <div className={clsx("gap-1")}>
        <Headline className="text-center text-lg">
          <div>{attackerAddressName}</div>
        </Headline>
        <ArmyWarning army={army} />
        <div id="army-info-label-content" className="self-center flex justify-between w-full">
          <div className="flex flex-col items-start">
            <div>{army.name}</div>
            <div className="mt-1">{originRealmName}</div>
          </div>
          <div className="flex flex-col items-end">
            <StaminaResource entityId={entity_id} />
            <ArmyCapacity army={army} className="mt-1" />
          </div>
        </div>
        <div className="w-full flex flex-col mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-2 relative justify-between w-full text-gold">
            <div className="px-2 py-1 bg-white/10  flex flex-col justify-between gap-2">
              <ResourceIcon withTooltip={false} resource={"Crossbowman"} size="lg" />
              <div className="text-green text-xs self-center">
                {currencyFormat(Number(troops.crossbowman_count), 0)}
              </div>
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
        </div>
        {structure && <ImmunityTimer structure={structure} />}
      </div>
    </BaseThreeTooltip>
  );
};
