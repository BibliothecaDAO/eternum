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
    <div className="w-full bg-gold/10 rounded p-3 flex justify-between h-28 flex-wrap clip-angled-sm">
      {/* <div className="w-full mb-1  ml-2 font-bold uppercase text-gold/70">{disableInput ? "sell" : "buy"}</div> */}
      <div className="self-center">
        <TextInput
          className="text-2xl border-transparent"
          value={amount.toString()}
          onChange={(amount) => handleAmountChange(amount)}
        />

        {!disableInput && (
          <div
            className="text-xs text-gold/70 mt-1 ml-2"
            onClick={() => handleAmountChange(selectedResourceBalance.toString())}
          >
            Max: {selectedResourceBalance.toLocaleString()}
          </div>
        )}
      </div>

      <Select
        value={findResourceById(Number(resourceId))!.trait}
        onValueChange={(trait) => handleResourceChange(trait)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Resources" />
        </SelectTrigger>
        <SelectContent className="bg-brown text-gold">
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
