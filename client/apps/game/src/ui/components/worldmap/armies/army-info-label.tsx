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

  const { structure, entityId, entity_owner_id, troops } = army;

  const realmId = structure?.metadata.realm_id || 0;

  const structureInfo = useMemo(() => {
    if (structure) {
      return getStructure(structure.entity_id, ContractAddress(address), components);
    }
  }, [structure]);

  const attackerAddressName = entity_owner_id ? getRealmAddressName(entity_owner_id, components) : "";

  const originRealmName = getRealmNameById(realmId);

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
        {structureInfo && <ImmunityTimer structure={structureInfo} />}
      </div>
    </BaseThreeTooltip>
  );
};
