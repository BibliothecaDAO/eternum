import { findResourceById, getIconResourceId } from "@bibliothecadao/eternum";

import { ResourceIcon } from "../../elements/ResourceIcon";
import { currencyFormat } from "../../utils/utils";
import { useResourceBalance } from "@/hooks/helpers/useResources";

export const ResourceChip = ({
  isLabor = false,
  resourceId,
  entityId,
}: {
  isLabor?: boolean;
  resourceId: number;
  entityId: bigint;
}) => {
  const { getBalance, getProductionManager } = useResourceBalance();

  const balance = getBalance(entityId, resourceId);
  const [_, rate] = getProductionManager(entityId, resourceId).netRate();

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
        <div>{currencyFormat(balance.balance ? Number(balance.balance) : 0, 2)}</div>
        {rate && (
          <div className={Number(rate) < 0 ? "text-red" : "text-green"}>
            {parseFloat(rate.toString()) < 0 ? "" : "+"}
            {currencyFormat(rate, 2)}
          </div>
        )}
      </div>
    </div>
  );
};
