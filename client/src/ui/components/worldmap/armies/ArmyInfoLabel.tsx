import useUIStore from "../../../../hooks/store/useUIStore";
import { currencyFormat } from "../../../utils/utils";

import { ArmyInfo, getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { useQuery } from "@/hooks/helpers/useQuery";
import {
  Structure,
  useIsStructureImmune,
  useStructureImmunityTimer,
  useStructures,
} from "@/hooks/helpers/useStructures";
import useNextBlockTimestamp from "@/hooks/useNextBlockTimestamp";
import { ArmyCapacity } from "@/ui/elements/ArmyCapacity";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { StaminaResource } from "@/ui/elements/StaminaResource";
import clsx from "clsx";
import { useMemo } from "react";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { getRealmNameById } from "../../../utils/realms";
import { ImmunityTimer } from "../structures/StructureLabel";
import { ArmyWarning } from "./ArmyWarning";

export const ArmyInfoLabel = () => {
  const { isMapView } = useQuery();
  const hoveredArmyEntityId = useUIStore((state) => state.hoveredArmyEntityId);
  const { getArmy } = getArmyByEntityId();

  const army = useMemo(() => {
    if (hoveredArmyEntityId) return getArmy(hoveredArmyEntityId);
    return undefined;
  }, [hoveredArmyEntityId, getArmy]);

  return <>{army && isMapView && <RaiderInfo key={army.entity_id} army={army} />}</>;
};

interface ArmyInfoLabelProps {
  army: ArmyInfo;
}

const RaiderInfo = ({ army }: ArmyInfoLabelProps) => {
  const { getRealmAddressName } = useRealm();
  const { realm, entity_id, entityOwner, troops } = army;

  const realmId = realm?.realm_id || 0;

  const attackerAddressName = entityOwner ? getRealmAddressName(entityOwner.entity_owner_id) : "";

  const { getStructureByEntityId } = useStructures();

  const originRealmName = getRealmNameById(realmId);

  const structure = useMemo(() => {
    if (entityOwner.entity_owner_id) {
      return getStructureByEntityId(entityOwner.entity_owner_id);
    }
  }, [entityOwner.entity_owner_id]);

  const { nextBlockTimestamp } = useNextBlockTimestamp();

  const isImmune = useIsStructureImmune(structure, nextBlockTimestamp || 0);
  const timer = useStructureImmunityTimer(structure as Structure, nextBlockTimestamp || 0);

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
          {/* <div className="flex flex-row justify-between">
            <InventoryResources max={6} entityId={entity_id} resourcesIconSize="xs" textSize="xxs" />
          </div> */}
        </div>
        <ImmunityTimer isImmune={isImmune} timer={timer} />
      </div>
    </BaseThreeTooltip>
  );
};
