import React from "react";

import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import type { CommonAutomationPreset } from "../model/common-automations";
import {
  OrderMode,
  ProductionType,
  TransferMode,
  type AutomationOrder,
} from "@/hooks/store/use-automation-store";
import { getResourceIconGroups, type ProductionRecipesMap } from "@/shared/lib/resources";
import { formatMinutes } from "@/shared/lib/time";
import { ResourcesIds } from "@bibliothecadao/types";

interface CommonAutomationsProps {
  presets: CommonAutomationPreset[];
  isRealmPaused: boolean;
  onApply: (order: Omit<AutomationOrder, "id" | "producedAmount">) => void;
  productionRecipes: ProductionRecipesMap;
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

export const CommonAutomations: React.FC<CommonAutomationsProps> = ({
  presets,
  isRealmPaused,
  onApply,
  productionRecipes,
}) => {
  if (presets.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h5 className="text-sm font-semibold mb-2">Common Automations</h5>
      <div className="grid gap-3 sm:grid-cols-2">
        {presets.map((preset) => {
          const isDisabled = !preset.available || isRealmPaused;
          const disabledReason = preset.unavailableReason || (isRealmPaused ? "Realm is paused" : undefined);
          const order = preset.order;

          const resourceIconGroups =
            order && order.productionType !== ProductionType.Transfer
              ? getResourceIconGroups({
                  productionType: order.productionType,
                  resourceToUse: order.resourceToUse,
                  recipes: productionRecipes,
                })
              : [];

          const displayedIconGroups =
            resourceIconGroups.length === 0 &&
            order &&
            order.productionType !== ProductionType.Transfer &&
            order.resourceToUse !== undefined
              ? [[order.resourceToUse]]
              : resourceIconGroups;

          const transferLabel = getTransferLabel(order?.transferMode, order?.transferInterval, order?.transferThreshold);

          return (
            <div key={preset.id} className="border border-gold/20 rounded-lg p-3 bg-black/20 flex flex-col gap-2">
              <div>
                <div className="text-sm font-medium text-gold/90">{preset.title}</div>
                <p className="text-xs text-gold/70 mt-1">{preset.description}</p>
              </div>
              {order && (
                <div className="mt-2">
                  {order.productionType === ProductionType.Transfer ? (
                    <>
                      <div className="flex flex-wrap gap-1">
                        {order.transferResources?.map((resource, idx) => (
                          <div
                            key={`${resource.resourceId}-${idx}`}
                            className="flex items-center bg-gold/10 px-1.5 py-0.5 rounded text-[11px]"
                          >
                            <ResourceIcon
                              resource={ResourcesIds[resource.resourceId]}
                              size="xs"
                              className="mr-1"
                            />
                            <span>{resource.amount}</span>
                          </div>
                        ))}
                      </div>
                      {transferLabel && <div className="text-[11px] text-gold/60 mt-1">{transferLabel}</div>}
                    </>
                  ) : (
                    displayedIconGroups.length > 0 && (
                      <div className="flex flex-wrap items-center text-sm text-gold/80">
                        {displayedIconGroups.map((group, groupIndex) => (
                          <React.Fragment key={`group-${groupIndex}`}>
                            {groupIndex > 0 && <span className="mx-1 text-gold/60">→</span>}
                            <div className="flex items-center gap-1">
                              {group.map((resourceId, resourceIndex) => (
                                <React.Fragment key={`${resourceId}-${resourceIndex}`}>
                                  <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" />
                                  {order.productionType === ProductionType.ResourceToLabor &&
                                    groupIndex === 1 &&
                                    resourceId === ResourcesIds.Labor && (
                                      <span className="text-xs text-gold/70">Labor</span>
                                    )}
                                </React.Fragment>
                              ))}
                            </div>
                          </React.Fragment>
                        ))}
                        {order.mode === OrderMode.MaintainBalance && order.maxAmount !== "infinite" && (
                          <span className="ml-2 text-[11px] text-gold/60">
                            Target: {Number(order.maxAmount).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
              <div className="flex items-center justify-between mt-auto">
                {isDisabled && disabledReason ? (
                  <span className="text-[11px] text-gold/60">{disabledReason}</span>
                ) : (
                  <span className="text-[11px] text-gold/60">Ready to add</span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isDisabled || !preset.order}
                  onClick={() => {
                    if (preset.order) {
                      onApply(preset.order);
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
