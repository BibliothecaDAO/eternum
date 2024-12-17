import { findResourceById, getIconResourceId, ID } from "@bibliothecadao/eternum";

import { ProgressWithPercentage } from "@/hooks/helpers/useHyperstructures";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import { currencyIntlFormat, divideByPrecision } from "@/ui/utils/utils";
import { useEffect, useState } from "react";
import { ResourceIcon } from "../../elements/ResourceIcon";

type HyperstructureResourceChipProps = {
  structureEntityId: ID;
  resourceId: number;
  progress: ProgressWithPercentage;
  contributions: Record<number, number>;
  setContributions: (val: Record<number, number>) => void;
  resetContributions: boolean;
};

export const HyperstructureResourceChip = ({
  structureEntityId,
  resourceId,
  contributions,
  setContributions,
  progress,
  resetContributions,
}: HyperstructureResourceChipProps) => {
  const [inputValue, setInputValue] = useState<number>(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const { getBalance, getResourceProductionInfo } = useResourceBalance();
  const balance = divideByPrecision(getBalance(structureEntityId, resourceId).balance);
  const production = getResourceProductionInfo(structureEntityId, resourceId);

  const safetyMargin = production !== undefined && production?.consumption_rate !== 0n ? 0.95 : 1;

  let maxContributableAmount = Math.min(progress.costNeeded! - progress.amount, balance);
  maxContributableAmount *= progress.costNeeded - progress.amount > balance ? safetyMargin : 1;
  maxContributableAmount = Math.ceil(maxContributableAmount);

  useEffect(() => {
    let contributionsCopy = Object.assign({}, contributions);
    if (inputValue === 0 || isNaN(inputValue)) {
      delete contributionsCopy[resourceId];
    } else {
      contributionsCopy[resourceId] = inputValue;
    }
    setContributions(contributionsCopy);
  }, [inputValue]);

  useEffect(() => {
    if (resetContributions) {
      setInputValue(0);
    }
  }, [resetContributions]);

  return (
    <div className="mt-0.5 grid grid-cols-8 gap-1 items-center">
      <div
        className={`flex relative items-center text-xs px-2 py-0.5 col-span-4`}
        style={{
          backgroundImage:
            progress.percentage > 0
              ? `linear-gradient(to right, #06D6A03c ${String(progress.percentage)}%, rgba(0,0,0,0) ${String(
                  progress.percentage,
                )}%)`
              : "",
        }}
        onMouseEnter={() => {
          setTooltip({
            position: "top",
            content: (
              <>
                {findResourceById(getIconResourceId(resourceId, false))?.trait as string} ({currencyIntlFormat(balance)}
                )
              </>
            ),
          });
        }}
        onMouseLeave={() => {
          setTooltip(null);
        }}
      >
        <ResourceIcon
          isLabor={false}
          withTooltip={false}
          resource={findResourceById(getIconResourceId(resourceId, false))?.trait as string}
          size="xs"
          className="mr-2 self-center"
        />

        <div className="flex justify-between">
          <div className="self-center text-xs font-semibold">{`${progress.percentage}% (${currencyIntlFormat(
            progress.amount,
          )} / ${currencyIntlFormat(progress.costNeeded)})`}</div>
        </div>
      </div>

      <NumberInput
        value={inputValue}
        className="w-full text-xs col-span-3 h-6"
        onChange={setInputValue}
        max={maxContributableAmount}
      />
      <Button
        variant="default"
        size="xs"
        className="ml-1 flex items-center text-xs cursor-pointer"
        onClick={() => setInputValue(maxContributableAmount)}
      >
        MAX
      </Button>
    </div>
  );
};
