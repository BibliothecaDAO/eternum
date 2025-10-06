import React from "react";

import { AutomationOrder, OrderMode, ProductionType } from "@/hooks/store/use-automation-store";
import Button from "@/ui/design-system/atoms/button";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getResourceIconGroups } from "@/shared/lib/resources";
import { ResourcesIds } from "@bibliothecadao/types";

import { AutomationFormSubmitResult, ResourceOption, useAutomationForm } from "../model/use-automation-form";

type EternumConfig = ReturnType<typeof import("@/utils/config").ETERNUM_CONFIG>;

interface AutomationFormProps {
  realmEntityId: string;
  realmName: string;
  resourceOptions: ResourceOption[];
  eternumConfig: EternumConfig;
  onSubmit: (order: Omit<AutomationOrder, "id" | "producedAmount" | "createdAt">) => void;
  onCancel: () => void;
  initialOrder?: AutomationOrder;
  title?: string;
  submitLabel?: string;
}

export const AutomationForm: React.FC<AutomationFormProps> = ({
  realmEntityId,
  realmName,
  resourceOptions,
  eternumConfig,
  onSubmit,
  onCancel,
  initialOrder,
  title,
  submitLabel,
}) => {
  const {
    state,
    setMode,
    setPriority,
    setResource,
    setProductionType,
    setMaxAmountInput,
    toggleInfinite,
    setBufferPercentage,
    submit,
    reset,
  } = useAutomationForm({
    realmEntityId,
    realmName,
    resourceOptions,
    initialOrder,
  });

  const order = state.order;
  const isInfinite = state.isInfinite;
  const maxAmountNumber = Number.parseInt(state.maxAmountInput, 10) || 0;

  const isSubmitDisabled =
    order.resourceToUse === undefined ||
    (order.mode === OrderMode.ProduceOnce &&
      !isInfinite &&
      typeof order.maxAmount === "number" &&
      order.maxAmount < 1000);

  const handleResourceChange = (value: string) => {
    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isNaN(parsedValue)) {
      setResource(parsedValue as ResourcesIds);
    } else {
      setResource(undefined);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result: AutomationFormSubmitResult = submit();
    if (!result.success) {
      return;
    }

    onSubmit(result.order);
    reset();
  };

  const resourceIconGroups = getResourceIconGroups({
    productionType: order.productionType,
    resourceToUse: order.resourceToUse,
    recipes: eternumConfig.resources.productionByComplexRecipe,
  });

  const renderResourceBadge = () => {
    if (resourceIconGroups.length === 0) {
      return null;
    }

    return resourceIconGroups.map((group, groupIndex) => (
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
    ));
  };

  const maintainTriggerValue =
    order.mode === OrderMode.MaintainBalance && typeof order.maxAmount === "number"
      ? ((order.maxAmount || 0) * (100 - (order.bufferPercentage || 10))) / 100
      : null;

  const formTitle = title ?? (initialOrder ? "Edit Automation" : "Create New Order");
  const formSubmitLabel = submitLabel ?? (initialOrder ? "Save Changes" : "Add Automation");

  return (
    <form onSubmit={handleSubmit} className="p-4 mb-6 space-y-4 border border-gold/20 rounded-md bg-black/10">
      <h3 className="text-lg font-semibold">{formTitle}</h3>
      {state.error && <div className="text-red text-sm">{state.error}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="orderMode" className="block mb-1 text-sm font-medium">
            Order Mode:
          </label>
          <Select value={order.mode} onValueChange={(value: OrderMode) => setMode(value)}>
            <SelectTrigger className="w-full border border-gold/20 rounded-md">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OrderMode.ProduceOnce}>Produce Once</SelectItem>
              <SelectItem value={OrderMode.MaintainBalance}>Maintain Balance</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-gold/50 mb-1">
            {order.mode === OrderMode.ProduceOnce
              ? "Produce up to target amount then stop"
              : "Keep resource balance at target level"}
          </div>
        </div>
        <div>
          <label htmlFor="productionType" className="block mb-1 text-sm font-medium">
            Production Type:
          </label>
          <Select value={order.productionType} onValueChange={(value: ProductionType) => setProductionType(value)}>
            <SelectTrigger className="w-full border border-gold/20 rounded-md">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ProductionType.ResourceToResource}>Standard (Resource-based)</SelectItem>
              <SelectItem value={ProductionType.LaborToResource}>Simple (Labor-based)</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-gold/50 mb-1">Choose how automation will convert resources.</div>
        </div>
        <div>
          <label htmlFor="priority" className="block mb-1 text-sm font-medium">
            Priority (1-9):
          </label>
          <NumberInput value={order.priority} onChange={(val) => setPriority(val)} min={1} max={9} className="w-full" />
          <p className="text-xs text-gold/50 mt-1">
            Orders with lower numbers are executed first. 1 is the highest priority, 9 is the lowest.
          </p>
        </div>
        <div>
          <label htmlFor="resourceToUse" className="block mb-1 text-sm font-medium">
            Resource to Produce:
          </label>
          <Select
            value={order.resourceToUse !== undefined ? String(order.resourceToUse) : ""}
            onValueChange={handleResourceChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select resource" />
            </SelectTrigger>
            <SelectContent>
              {resourceOptions.length > 0 ? (
                resourceOptions.map((res) => {
                  const optionIconGroups =
                    order.productionType === ProductionType.ResourceToResource
                      ? getResourceIconGroups({
                          productionType: ProductionType.ResourceToResource,
                          resourceToUse: res.id,
                          recipes: eternumConfig.resources.productionByComplexRecipe,
                        })
                      : [];

                  return (
                    <SelectItem key={res.id} value={String(res.id)}>
                      <div className="flex items-center">
                        <ResourceIcon resource={res.name} size="xs" className="mr-2" />
                        {res.name}
                        {optionIconGroups[0]?.map((resourceId, index) => (
                          <ResourceIcon
                            key={`${resourceId}-${index}`}
                            resource={ResourcesIds[resourceId]}
                            size="xs"
                            className="ml-1"
                          />
                        ))}
                      </div>
                    </SelectItem>
                  );
                })
              ) : (
                <SelectItem value="no-resources" disabled>
                  No resources available for this realm to automate.
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-gold/50 mt-1">Select the resource you want this automation to produce.</p>
        </div>

        <div>
          <label htmlFor="maxAmount" className="block mb-1 text-sm font-medium">
            {order.mode === OrderMode.MaintainBalance ? "Target Balance:" : "Target Amount:"}
            {!isInfinite &&
              order.mode === OrderMode.ProduceOnce &&
              typeof order.maxAmount === "number" &&
              order.maxAmount < 1000 && <span className="text-red ml-1">(min 1000)</span>}
          </label>
          <div className="flex items-center gap-2">
            <NumberInput
              value={isInfinite ? 0 : maxAmountNumber}
              disabled={isInfinite}
              onChange={(val) => setMaxAmountInput(String(val))}
              min={0}
            />
            {order.mode === OrderMode.ProduceOnce && (
              <>
                <input
                  type="checkbox"
                  id="isInfinite"
                  checked={isInfinite}
                  onChange={toggleInfinite}
                  className="w-4 h-4"
                />
                <label htmlFor="isInfinite" className="text-sm">
                  Infinite
                </label>
              </>
            )}
          </div>
          <p className="text-xs text-gold/50 mt-1">
            {order.mode === OrderMode.MaintainBalance
              ? "Set the target balance to maintain. Production will trigger when balance drops below this minus buffer."
              : 'Set the target amount to produce. Check "Infinite" to keep producing without a limit.'}
          </p>
        </div>

        {order.mode === OrderMode.MaintainBalance && (
          <div>
            <label htmlFor="bufferPercentage" className="block mb-1 text-sm font-medium">
              Buffer Percentage:
            </label>
            <NumberInput
              value={order.bufferPercentage || 10}
              onChange={(val) => setBufferPercentage(val)}
              min={0}
              max={50}
              className="w-full"
            />
            {maintainTriggerValue !== null && (
              <p className="text-xs text-gold/50 mt-1">
                Production will start when balance drops below {100 - (order.bufferPercentage || 10)}% of target.
                (Current trigger: {Math.floor(maintainTriggerValue).toLocaleString()})
              </p>
            )}
          </div>
        )}

        {order.productionType !== ProductionType.Transfer && order.resourceToUse !== undefined && (
          <div className="col-span-2 text-xs text-gold/70 flex items-center gap-2">{renderResourceBadge()}</div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="gold" disabled={isSubmitDisabled}>
          {formSubmitLabel}
        </Button>
        <Button onClick={onCancel} variant="default" size="md" type="button">
          Cancel
        </Button>
      </div>
    </form>
  );
};
