import { getResourceBalance } from "@/hooks/helpers/useResources";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import TextInput from "@/ui/elements/TextInput";
import { divideByPrecision, formatNumber } from "@/ui/utils/utils";
import { ID, Resources, ResourcesIds, findResourceById, findResourceIdByTrait } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { HintSection } from "../hints/HintModal";

type ResourceBarProps = {
  entityId: ID;
  lordsFee: number;
  resources: Resources[];
  resourceId: ResourcesIds;
  setResourceId: (resourceId: ResourcesIds) => void;
  amount: number;
  setAmount: (amount: number) => void;
  disableInput?: boolean;
};

export const ResourceBar = ({
  entityId,
  lordsFee,
  resources,
  resourceId,
  setResourceId,
  amount,
  setAmount,
  disableInput = false,
}: ResourceBarProps) => {
  console.log({ resourceId });
  const { getBalance } = getResourceBalance();

  const [selectedResourceBalance, setSelectedResourceBalance] = useState(0);

  useEffect(() => {
    setSelectedResourceBalance(divideByPrecision(getBalance(entityId, Number(resourceId)).balance));
  }, [resourceId]);

  const handleResourceChange = (trait: string) => {
    const resourceId = findResourceIdByTrait(trait);
    setResourceId && setResourceId(resourceId);
  };

  const handleAmountChange = (amount: string) => {
    !disableInput && setAmount && setAmount(parseInt(amount.replaceAll(" ", "")) || 0);
  };

  const hasLordsFees = lordsFee > 0 && resourceId === ResourcesIds.Lords;
  const finalResourceBalance = hasLordsFees ? selectedResourceBalance - lordsFee : selectedResourceBalance;

  return (
    <div className="w-full bg-gold/10 rounded p-3 flex justify-between h-28 flex-wrap ">
      <div className="self-center">
        <TextInput
          className="text-2xl border-transparent"
          value={isNaN(amount) ? "0" : amount.toLocaleString()}
          onChange={(amount) => handleAmountChange(amount)}
        />

        {!disableInput && (
          <div
            className="flex text-xs text-gold/70 mt-1 ml-2"
            onClick={() => handleAmountChange(finalResourceBalance.toString())}
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
        value={findResourceById(Number(resourceId))!.trait}
        onValueChange={(trait) => handleResourceChange(trait)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={HintSection.Resources} />
        </SelectTrigger>
        <SelectContent className="bg-black/90 text-gold">
          {resources.map((resource, index) => (
            <SelectItem key={index} value={resource.trait}>
              <ResourceCost
                resourceId={resource.id}
                amount={divideByPrecision(getBalance(entityId, resource.id).balance)}
              />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
