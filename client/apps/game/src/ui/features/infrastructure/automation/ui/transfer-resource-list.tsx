import React from "react";

import Button from "@/ui/design-system/atoms/button";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourcesIds } from "@bibliothecadao/types";

import type { ResourceBalance, SelectedResource } from "../lib/transfer-types";

interface TransferResourceListProps {
  resources: SelectedResource[];
  onRemove: (resourceId: ResourcesIds) => void;
  availableResources: ResourceBalance[];
  newResourceId: ResourcesIds | "";
  onNewResourceChange: (resourceId: ResourcesIds | "") => void;
  newResourceAmount: number;
  onNewResourceAmountChange: (value: number) => void;
  onAddResource: (resourceId: ResourcesIds, amount: number) => void;
  addButtonLabel: string;
  title?: string;
  emptyMessage?: string;
  disabled?: boolean;
  error?: string | null;
}

export const TransferResourceList: React.FC<TransferResourceListProps> = ({
  resources,
  onRemove,
  availableResources,
  newResourceId,
  onNewResourceChange,
  newResourceAmount,
  onNewResourceAmountChange,
  onAddResource,
  addButtonLabel,
  title,
  emptyMessage,
  disabled,
  error,
}) => {
  const handleAddClick = () => {
    if (!newResourceId || disabled) {
      return;
    }

    onAddResource(newResourceId as ResourcesIds, newResourceAmount);
  };

  const selectedResourceBalance =
    typeof newResourceId === "number"
      ? availableResources.find((resource) => resource.id === newResourceId)?.balance || 0
      : 0;

  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-medium">{title}</h4>}
      {error && <div className="text-red text-xs">{error}</div>}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block mb-1 text-sm font-medium">Resource</label>
          <Select
            value={newResourceId === "" ? "" : String(newResourceId)}
            onValueChange={(value) => onNewResourceChange((value ? Number(value) : "") as ResourcesIds | "")}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select resource" />
            </SelectTrigger>
            <SelectContent>
              {availableResources.length === 0 ? (
                <div className="px-2 py-1 text-xs text-gold/50">No resources available</div>
              ) : (
                availableResources.map((resource) => (
                  <SelectItem key={resource.id} value={String(resource.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ResourceIcon resource={resource.trait} size="xs" />
                        <span>{resource.trait}</span>
                      </div>
                      <span className="text-xs text-gold/60">{resource.balance.toLocaleString()}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="w-32">
          <label className="block mb-1 text-sm font-medium">Amount</label>
          <NumberInput
            value={newResourceAmount}
            onChange={onNewResourceAmountChange}
            min={1}
            max={selectedResourceBalance || undefined}
            disabled={disabled || !newResourceId}
          />
        </div>
        <Button
          type="button"
          onClick={handleAddClick}
          variant="outline"
          size="xs"
          disabled={
            disabled ||
            !newResourceId ||
            selectedResourceBalance === 0 ||
            newResourceAmount <= 0 ||
            Number.isNaN(newResourceAmount)
          }
        >
          {addButtonLabel}
        </Button>
      </div>

      <div className="space-y-2">
        {resources.length === 0 ? (
          <div className="text-xs text-gold/60">{emptyMessage || "No resources selected."}</div>
        ) : (
          resources.map((resource) => (
            <div key={resource.resourceId} className="flex items-center justify-between bg-gold/10 p-2 rounded">
              <div className="flex items-center gap-2">
                <ResourceIcon resource={ResourcesIds[resource.resourceId]} size="sm" />
                <span>
                  {ResourcesIds[resource.resourceId]}: {resource.amount.toLocaleString()}
                </span>
              </div>
              <Button
                type="button"
                onClick={() => onRemove(resource.resourceId)}
                variant="danger"
                size="xs"
                disabled={disabled}
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
