import { useMemo } from "react";
import { BaseRegionTooltip } from "../../../elements/BaseRegionTooltip";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useGetRealm } from "../../../hooks/helpers/useRealm";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../DojoContext";
import { getEntityIdFromKeys } from "../../../utils/utils";
import { ResourcesIds, LABOR_CONFIG } from "@bibliothecadao/eternum";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { BuildingsCount } from "../../../elements/BuildingsCount";
type FarmsRegionTooltipProps = {};

export const FarmsRegionTooltip = ({}: FarmsRegionTooltipProps) => {
  let { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const {
    setup: {
      components: { Labor },
    },
  } = useDojo();

  const labor = useComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(ResourcesIds["Wheat"])]));
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const laborLeft = useMemo(() => {
    if (nextBlockTimestamp && labor && LABOR_CONFIG && labor.balance > nextBlockTimestamp) {
      let left = labor.balance - nextBlockTimestamp;
      return left < LABOR_CONFIG.base_labor_units ? 0 : left;
    }
    return 0;
  }, [nextBlockTimestamp, labor]);

  return (
    <BaseRegionTooltip position={[-300, 75, -100]} distanceFactor={400}>
      <div className="flex items-center">
        <ResourceIcon resource="Wheat" size="sm" />
        <div className=" ml-2 text-sm text-gold font-bold">Wheat Farms</div>
        <div className="flex flex-col ml-auto text-xxs">
          <div className="px-2">{`${laborLeft > 0 && labor ? labor.multiplier : 0}/${realm?.rivers}`}</div>
        </div>
      </div>
      <BuildingsCount count={labor?.multiplier as number} maxCount={realm?.rivers || 0} className="mt-2" />
      <img src={`/images/buildings/farm.png`} className="mt-2 object-cover w-full h-full rounded-[10px]" />
    </BaseRegionTooltip>
  );
};
