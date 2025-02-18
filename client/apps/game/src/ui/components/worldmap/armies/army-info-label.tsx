import { useUIStore } from "@/hooks/store/use-ui-store";
import { ArmyWarning } from "@/ui/components/worldmap/armies/army-warning";
import { ImmunityTimer } from "@/ui/components/worldmap/structures/immunity-timer";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import { BaseThreeTooltip, Position } from "@/ui/elements/base-three-tooltip";
import { Headline } from "@/ui/elements/headline";
import { StaminaResource } from "@/ui/elements/stamina-resource";
import {
  ArmyInfo,
  ContractAddress,
  getArmy,
  getRealmAddressName,
  getRealmNameById,
  getStructure,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import clsx from "clsx";
import { useMemo } from "react";
import { TroopChip } from "../../military/troop-chip";

export const ArmyInfoLabelContainer = () => {
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

  return <>{army && isMapView && <ArmyInfoLabelCard key={army.entityId} army={army} />}</>;
};

interface ArmyInfoLabelProps {
  army: ArmyInfo;
}

const ArmyInfoLabelCard = ({ army }: ArmyInfoLabelProps) => {
  const {
    account: {
      account: { address },
    },
    setup: { components },
  } = useDojo();

  const { realm, entityId, entityOwner, troops } = army;

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
            <StaminaResource entityId={entityId} />
            <ArmyCapacity army={army} className="mt-1" />
          </div>
        </div>
        <div className="w-full h-full flex flex-col mt-2 space-y-2">
          <TroopChip troops={troops} />
        </div>
        {structure && <ImmunityTimer structure={structure} />}
      </div>
    </BaseThreeTooltip>
  );
};
