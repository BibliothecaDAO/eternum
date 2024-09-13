import useUIStore from "../../../../hooks/store/useUIStore";
import { currencyFormat, multiplyByPrecision } from "../../../utils/utils";

import { ArmyMovementManager } from "@/dojo/modelManager/ArmyMovementManager";
import { StaminaManager } from "@/dojo/modelManager/StaminaManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { useQuery } from "@/hooks/helpers/useQuery";
import { ArmyCapacity } from "@/ui/elements/ArmyCapacity";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { StaminaResource } from "@/ui/elements/StaminaResource";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
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
  const { setup } = useDojo();
  const { getRealmAddressName } = useRealm();
  const { realm, entity_id, entityOwner, troops } = army;

  const realmId = realm?.realm_id || 0;

  const attackerAddressName = entityOwner ? getRealmAddressName(entityOwner.entity_owner_id) : "";
  const remainingCapacity = useMemo(() => army.totalCapacity - army.weight, [army]);
  const armyManager = useMemo(() => {
    return new ArmyMovementManager(setup, army.entity_id);
  }, [army]);

  const food = armyManager.getFood(useUIStore.getState().currentDefaultTick);

  const foodCost = useMemo(() => {
    return {
      wheat:
        multiplyByPrecision(EternumGlobalConfig.exploration.travelWheatBurn) *
        Number(army.quantity.value) *
        EternumGlobalConfig.resources.resourceMultiplier,
      fish:
        multiplyByPrecision(EternumGlobalConfig.exploration.travelFishBurn) *
        Number(army.quantity.value) *
        EternumGlobalConfig.resources.resourceMultiplier,
    };
  }, [army]);

  const notEnoughFood = food.wheat < foodCost.wheat || food.fish < foodCost.fish;

  const stamina = useMemo(() => {
    const staminaManager = new StaminaManager(setup, army.entity_id);
    return staminaManager.getStamina(useUIStore.getState().currentArmiesTick);
  }, [army]);

  const originRealmName = getRealmNameById(realmId);

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
            <Headline className="text-center text-lg">
              <div>{attackerAddressName}</div>
            </Headline>
          </div>

          <div>
            {stamina.amount < EternumGlobalConfig.stamina.travelCost ? (
              <div className="text-xxs font-semibold items-center text-center">
                ⚠️ Not enough stamina to explore or travel
              </div>
            ) : (
              stamina.amount < EternumGlobalConfig.stamina.exploreCost && (
                <div className="text-xxs font-semibold items-center text-center">⚠️ Not enough stamina to explore</div>
              )
            )}
            {remainingCapacity < EternumGlobalConfig.exploration.reward && (
              <div className="text-xxs font-semibold items-center text-center">⚠️ Too heavy to explore</div>
            )}
            {notEnoughFood && (
              <div className="text-xxs font-semibold items-center text-center">⚠️ Not enough food to move</div>
            )}
          </div>

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
        <div className="flex flex-row justify-between">
          <InventoryResources max={6} entityIds={[entity_id]} resourcesIconSize="xs" textSize="xxs" />
        </div>
      </div>
    </div>
  );
};
