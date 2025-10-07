import React, { useMemo, useState } from "react";

import Button from "@/ui/design-system/atoms/button";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { TransferMode } from "@/hooks/store/use-automation-store";
import { ResourcesIds } from "@bibliothecadao/types";

import type { ResourceBalance, SelectedResource } from "../lib/transfer-types";
import { formatMinutes } from "@/shared/lib/time";

interface TransferResourceListProps {
  resources: SelectedResource[];
  onRemove: (resourceId: ResourcesIds) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  availableResources: ResourceBalance[];
  newResourceId: ResourcesIds | "";
  onNewResourceChange: (resourceId: ResourcesIds | "") => void;
  newResourceAmount: number;
  onNewResourceAmountChange: (value: number) => void;
  onAddResource: (resourceId: ResourcesIds, amount: number) => void;
  transferMode?: TransferMode;
  transferInterval?: number;
  transferThreshold?: number;
  addButtonLabel: string;
  title?: string;
  emptyMessage?: string;
  disabled?: boolean;
  error?: string | null;
}

const tileSummary = (
  resource: SelectedResource,
  mode: TransferMode | undefined,
  interval: number | undefined,
  threshold: number | undefined,
): string => {
  switch (mode) {
    case TransferMode.Recurring:
      return `Every ${formatMinutes(interval ?? 60)}`;
    case TransferMode.MaintainStock:
      return `Top up below ${threshold?.toLocaleString() ?? "?"}`;
    case TransferMode.DepletionTransfer:
      return `Ship when above ${threshold?.toLocaleString() ?? "?"}`;
    default:
      return "Immediate transfer";
  }
};

export const TransferResourceList: React.FC<TransferResourceListProps> = ({
  resources,
  onRemove,
  onReorder,
  availableResources,
  newResourceId,
  onNewResourceChange,
  newResourceAmount,
  onNewResourceAmountChange,
  onAddResource,
  transferMode,
  transferInterval,
  transferThreshold,
  addButtonLabel,
  title,
  emptyMessage,
  disabled,
  error,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const availableResourceItems = useMemo(() => availableResources.map((resource) => ({
    id: resource.id,
    label: resource.trait,
    balance: resource.balance,
  })), [availableResources]);

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

  const formatAmount = (amount: number) => {
    if (amount >= 1000) {
      return amount.toLocaleString();
    }
    if (amount >= 1) {
      return amount.toFixed(0);
    }
    return amount.toFixed(2);
  };

  const onDragStart = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    if (!onReorder || disabled) return;
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const onDragOver = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    if (!onReorder || disabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const onDrop = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    if (!onReorder || disabled) return;
    event.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }

    onReorder(dragIndex, index);
    setDragIndex(null);
  };

  const onDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <div className="space-y-4">
      {title && <h4 className="text-sm font-medium text-gold">{title}</h4>}
      {error && <div className="rounded-md border border-red/40 bg-red/10 px-3 py-2 text-xs text-red">{error}</div>}

      <div className="rounded-lg border border-gold/20 bg-black/30 p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_auto]">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gold/60">Resource</label>
            <Select
              value={newResourceId === "" ? "" : String(newResourceId)}
              onValueChange={(value) => onNewResourceChange((value ? Number(value) : "") as ResourcesIds | "")}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select resource" />
              </SelectTrigger>
              <SelectContent>
                {availableResourceItems.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-gold/50">No resources available</div>
                ) : (
                  availableResourceItems.map((resource) => (
                    <SelectItem key={resource.id} value={String(resource.id)}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ResourceIcon resource={resource.label} size="xs" />
                          <span>{resource.label}</span>
                        </div>
                        <span className="text-xs text-gold/60">{resource.balance.toLocaleString()}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gold/60">Amount</label>
            <NumberInput
              value={newResourceAmount}
              onChange={onNewResourceAmountChange}
              min={1}
              max={selectedResourceBalance || undefined}
              disabled={disabled || !newResourceId}
            />
            {selectedResourceBalance > 0 && (
              <p className="mt-1 text-[10px] text-gold/50">Available: {selectedResourceBalance.toLocaleString()}</p>
            )}
          </div>

          <div className="flex items-end">
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
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {resources.length === 0 ? (
          <div className="rounded-md border border-gold/15 bg-black/30 px-3 py-2 text-xs text-gold/60">
            {emptyMessage || "No resources selected."}
          </div>
        ) : (
          resources.map((resource, index) => {
            const resourceName = ResourcesIds[resource.resourceId];
            const summary = tileSummary(resource, transferMode, transferInterval, transferThreshold);
            const amountLabel = formatAmount(resource.amount);

            return (
              <div
                key={`${resource.resourceId}-${index}`}
                className={`relative flex min-w-[180px] max-w-[220px] flex-col gap-2 rounded-lg border border-gold/25 bg-black/35 p-3 text-left transition-all ${
                  onReorder && !disabled ? "cursor-grab" : ""
                } ${dragIndex === index ? "border-dashed border-gold/50 opacity-80" : ""} ${disabled ? "opacity-60" : ""}`}
                draggable={Boolean(onReorder) && !disabled}
                onDragStart={onDragStart(index)}
                onDragOver={onDragOver(index)}
                onDrop={onDrop(index)}
                onDragEnd={onDragEnd}
              >
                <button
                  type="button"
                  onClick={() => onRemove(resource.resourceId)}
                  className="absolute right-2 top-2 text-xs uppercase text-gold/50 transition hover:text-red disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={disabled}
                >
                  Remove
                </button>
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={resourceName} size="sm" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-semibold text-gold">{resourceName}</span>
                    <span className="text-xs text-gold/60">{summary}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gold/70">
                  <span>Amount</span>
                  <span className="font-semibold text-gold">{amountLabel}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
