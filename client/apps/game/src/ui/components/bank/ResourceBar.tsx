import { useResourceBalance } from "@/hooks/helpers/useResources";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import TextInput from "@/ui/elements/TextInput";
import { divideByPrecision, formatNumber } from "@/ui/utils/utils";
import { ID, Resources, ResourcesIds, findResourceById, findResourceIdByTrait } from "@bibliothecadao/eternum";
import { memo, useEffect, useRef, useState } from "react";
import { HintSection } from "../hints/HintModal";

export const ResourceBar = memo(
  ({
    entityId,
    lordsFee,
    resources,
    resourceId,
    setResourceId,
    amount,
    setAmount,
    disableInput = false,
    onFocus,
    onBlur,
    max = Infinity,
  }: {
    entityId: ID;
    lordsFee: number;
    resources: Resources[];
    resourceId: ResourcesIds;
    setResourceId: (resourceId: ResourcesIds) => void;
    amount: number;
    setAmount: (amount: number) => void;
    disableInput?: boolean;
    onFocus?: () => void; // New prop
    onBlur?: () => void; // New prop
    max?: number;
  }) => {
    const { getBalance } = useResourceBalance();

    const [selectedResourceBalance, setSelectedResourceBalance] = useState(0);
    const [searchInput, setSearchInput] = useState("");
    const [open, setOpen] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      setSelectedResourceBalance(divideByPrecision(getBalance(entityId, Number(resourceId)).balance));
    }, [resourceId, getBalance, entityId]);

    const handleResourceChange = (trait: string) => {
      const newResourceId = findResourceIdByTrait(trait);
      setResourceId(newResourceId);
    };

    const handleAmountChange = (amount: number) => {
      setAmount(amount);
    };

    const hasLordsFees = lordsFee > 0 && resourceId === ResourcesIds.Lords;
    const finalResourceBalance = hasLordsFees ? selectedResourceBalance - lordsFee : selectedResourceBalance;

    const filteredResources = resources.filter(
      (resource) => resource.trait.toLowerCase().startsWith(searchInput.toLowerCase()) || resource.id === resourceId,
    );

    const handleOpenChange = (newOpen: boolean) => {
      setOpen(newOpen);
      if (newOpen && inputRef.current) {
        setResourceId(ResourcesIds.Wood);
        setSearchInput("");
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (filteredResources.length > 0) {
          const selectedResource = filteredResources.find((resource) => resource.id !== resourceId);
          if (selectedResource) {
            setResourceId(selectedResource.id);
            setOpen(false);
          }
        }
        setSearchInput("");
      } else {
        e.stopPropagation();
      }
    };

    return (
      <div className="resource-bar-selector w-full bg-gold/10 rounded-xl p-3 flex justify-between h-28 flex-wrap">
        <div className="self-center">
          <NumberInput
            className="text-2xl border-transparent"
            value={amount}
            onChange={handleAmountChange}
            max={max}
            arrows={false}
            allowDecimals
            onFocus={onFocus}
            onBlur={onBlur}
          />

          {!disableInput && (
            <div
              className="flex text-xs text-gold/70 mt-1 justify-center items-center relative text-center self-center mx-auto w-full cursor-pointer"
              onClick={() => handleAmountChange(finalResourceBalance)}
            >
              Max: {isNaN(selectedResourceBalance) ? "0" : selectedResourceBalance.toLocaleString()}
              {hasLordsFees && (
                <div className="text-danger ml-2">
                  <div>{`[+${isNaN(lordsFee) ? "0" : formatNumber(lordsFee, 2)}]`}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <Select
          open={open}
          onOpenChange={handleOpenChange}
          value={findResourceById(Number(resourceId))?.trait || ""}
          onValueChange={(trait) => {
            handleResourceChange(trait);
            setOpen(false);
            setSearchInput("");
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={HintSection.Resources} />
          </SelectTrigger>
          <SelectContent>
            {resources.length > 1 && (
              <div className="p-2">
                <TextInput
                  ref={inputRef}
                  onChange={setSearchInput}
                  placeholder="Filter resources..."
                  onKeyDown={handleKeyDown}
                />
              </div>
            )}
            {filteredResources.map((resource) => (
              <SelectItem key={resource.id} value={resource.trait} disabled={resource.id === resourceId}>
                <ResourceCost
                  resourceId={resource.id}
                  amount={divideByPrecision(getBalance(entityId, resource.id).balance)}
                  className="border-0 bg-transparent"
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  },
);
