import { LucideArrowRight } from "lucide-react";
import React from "react";

import { AutomationOrder, OrderMode, ProductionType, TransferMode } from "@/hooks/store/use-automation-store";
import { getResourceIconGroups } from "@/shared/lib/resources";
import { formatMinutes } from "@/shared/lib/time";
import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourcesIds } from "@bibliothecadao/types";

type EternumConfig = ReturnType<typeof import("@/utils/config").ETERNUM_CONFIG>;

interface AutomationRowProps {
  order: AutomationOrder;
  onRemove: (orderId: string) => void;
  onEdit: (order: AutomationOrder) => void;
  eternumConfig: EternumConfig;
}

const getTransferLabel = (mode?: TransferMode, interval?: number, threshold?: number) => {
  if (!mode) {
    return null;
  }

  if (mode === TransferMode.Recurring && interval) {
    return `Every ${formatMinutes(interval)}`;
  }

  if (mode === TransferMode.MaintainStock && threshold !== undefined) {
    return `When < ${threshold.toLocaleString()}`;
  }

  if (mode === TransferMode.DepletionTransfer && threshold !== undefined) {
    return `When > ${threshold.toLocaleString()}`;
  }

  return null;
};

export const AutomationRow: React.FC<AutomationRowProps> = ({ order, onRemove, onEdit, eternumConfig }) => {
  const resourceIconGroups = getResourceIconGroups({
    productionType: order.productionType,
    resourceToUse: order.resourceToUse,
    recipes: eternumConfig.resources.productionByComplexRecipe,
  });
  const canEdit = order.productionType !== ProductionType.Transfer;

  return (
    <tr className="border-b border-gold/50">
      <td className="px-6 py-4">{order.priority}</td>
      <td className="px-6 py-4 capitalize">
        {order.productionType === ProductionType.Transfer ? (
          <span className="text-purple">
            {order.transferMode === TransferMode.Recurring && "Recurring"}
            {order.transferMode === TransferMode.MaintainStock && "Stock"}
            {order.transferMode === TransferMode.DepletionTransfer && "Depletion"}
          </span>
        ) : order.mode === OrderMode.MaintainBalance ? (
          <span className="text-green">Maintain</span>
        ) : (
          <span className="text-blue">Once</span>
        )}
      </td>
      <td className="px-6 py-4 flex items-center">
        {order.productionType === ProductionType.Transfer ? (
          <>
            <span className="text-sm">{order.realmName}</span>
            <LucideArrowRight className="w-4 h-4 mx-2" />
            <span className="text-sm">{order.targetEntityName || order.targetEntityId}</span>
          </>
        ) : (
          resourceIconGroups.map((group, groupIndex) => (
            <React.Fragment key={`group-${groupIndex}`}>
              {groupIndex > 0 && <span className="mx-1">→</span>}
              {group.map((resourceId, resourceIndex) => (
                <React.Fragment key={`${resourceId}-${resourceIndex}`}>
                  <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" />
                  {order.productionType === ProductionType.ResourceToLabor &&
                    groupIndex === 1 &&
                    resourceId === ResourcesIds.Labor && <span className="ml-1">Labor</span>}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))
        )}
      </td>
      <td className="px-6 py-4">
        <div>
          {order.productionType === ProductionType.Transfer ? (
            <>
              <div className="flex flex-wrap gap-1 mb-1">
                {order.transferResources?.map((resource, idx) => (
                  <div key={idx} className="flex items-center bg-gold/10 px-1 py-0.5 rounded text-xs">
                    <ResourceIcon resource={ResourcesIds[resource.resourceId]} size="xs" className="mr-1" />
                    <span>{resource.amount}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gold/50">
                {getTransferLabel(order.transferMode, order.transferInterval, order.transferThreshold)}
              </div>
            </>
          ) : (
            <>
              {order.maxAmount === "infinite" ? "Infinite" : order.maxAmount.toLocaleString()}
              {order.mode === OrderMode.MaintainBalance && (
                <>
                  {order.productionType === ProductionType.ResourceToLabor && (
                    <div className="text-xs text-gold/50">Labor Balance</div>
                  )}
                  {order.bufferPercentage && (
                    <div className="text-xs text-gold/50">Buffer: {order.bufferPercentage}%</div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        {order.productionType === ProductionType.Transfer || order.mode === OrderMode.MaintainBalance
          ? "N/A"
          : order.producedAmount.toLocaleString()}
      </td>
      <td className="px-6 py-4 capitalize">
        {order.productionType === ProductionType.Transfer
          ? "Transfer"
          : order.productionType === ProductionType.ResourceToLabor
            ? "Resource To Labor"
            : order.productionType === ProductionType.ResourceToResource
              ? "Resource To Resource"
              : order.productionType === ProductionType.LaborToResource
                ? "Labor To Resource"
                : order.productionType}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => onEdit(order)}
            variant="default"
            size="xs"
            disabled={!canEdit}
            title={!canEdit ? "Transfers are managed from the transfer table" : undefined}
          >
            Edit
          </Button>
          <Button onClick={() => onRemove(order.id)} variant="danger" size="xs">
            Remove
          </Button>
        </div>
      </td>
    </tr>
  );
};
