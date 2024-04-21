import { useResourceBalance } from "@/hooks/helpers/useResources";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import TextInput from "@/ui/elements/TextInput";
import { divideByPrecision } from "@/ui/utils/utils";
import { Resources, findResourceById, findResourceIdByTrait } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";

export const ResourceBar = ({
  entityId,
  resources,
  resourceId,
  setResourceId,
  amount,
  setAmount,
  disableInput = false,
}: {
  entityId: bigint;
  resources: Resources[];
  resourceId: bigint;
  setResourceId: (resourceId: bigint) => void;
  amount: number;
  setAmount: (amount: number) => void;
  disableInput?: boolean;
}) => {
  const { getBalance } = useResourceBalance();

  const [selectedResourceBalance, setSelectedResourceBalance] = useState(0);

  useEffect(() => {
    setSelectedResourceBalance(divideByPrecision(getBalance(entityId, Number(resourceId)).balance));
  }, [resourceId]);

  const handleResourceChange = (trait: string) => {
    const resourceId = findResourceIdByTrait(trait);
    setResourceId && setResourceId(BigInt(resourceId));
  };

  const handleAmountChange = (amount: string) => {
    !disableInput && setAmount && setAmount(parseInt(amount));
  };

  return (
    <div className="w-full rounded border p-2 flex justify-between">
      <div className="self-center">
        <TextInput value={amount.toString()} onChange={(amount) => handleAmountChange(amount)} />
        {!disableInput && (
          <div className="text-xs text-white" onClick={() => handleAmountChange(selectedResourceBalance.toString())}>
            Max: {selectedResourceBalance}
          </div>
        )}
      </div>

      <Select
        value={findResourceById(Number(resourceId))!.trait}
        onValueChange={(trait) => handleResourceChange(trait)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Resources" />
        </SelectTrigger>
        <SelectContent className="bg-brown text-gold">
          {resources.map((resource, index) => (
            <SelectItem key={index} value={resource.trait}>
              <div className="flex">
                <ResourceCost
                  resourceId={resource.id}
                  amount={divideByPrecision(getBalance(entityId, resource.id).balance)}
                ></ResourceCost>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
