import { findResourceById, getIconResourceId } from "@bibliothecadao/eternum";

import { ResourceIcon } from "../../elements/ResourceIcon";
import { currencyFormat } from "../../utils/utils";
import { useProductionManager } from "@/hooks/helpers/useResources";
import { useMemo } from "react";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";

export const ResourceChip = ({
  isLabor = false,
  resourceId,
  entityId,
}: {
  isLabor?: boolean;
  resourceId: number;
  entityId: bigint;
}) => {
  const currentTick = useBlockchainStore((state) => state.currentTick);
  const productionManager = useProductionManager(entityId, resourceId);

  const production = useMemo(() => {
    return productionManager.getProduction();
  }, [productionManager]);

  const balance = useMemo(() => {
    return productionManager.balance(currentTick);
  }, [productionManager, production]);

  const netRate = useMemo(() => {
    return productionManager.netRate()[1];
  }, [productionManager, production]);

  return (
    <div className={`flex relative group items-center text-sm border rounded px-2 p-1`}>
      <ResourceIcon
        isLabor={isLabor}
        withTooltip={false}
        resource={findResourceById(getIconResourceId(resourceId, isLabor))?.trait as string}
        size="md"
        className="mr-1"
      />
      <div className="flex space-x-3 items-center justify-center">
        <div className="font-bold">{findResourceById(resourceId)?.trait}</div>
        <div>{currencyFormat(balance ? Number(balance) : 0, 2)}</div>
        {netRate && (
          <div className={Number(netRate) < 0 ? "text-red" : "text-green"}>
            {parseFloat(netRate.toString()) < 0 ? "" : "+"}
            {currencyFormat(netRate, 2)}
          </div>
        )}
      </div>
    </div>
  );
};
