import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import { divideByPrecision, getBalance } from "@bibliothecadao/eternum";
import { findResourceById, ID } from "@bibliothecadao/types";
import { ProgressWithPercentage, useDojo } from "@bibliothecadao/react";
import { useEffect, useState } from "react";

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
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const [inputValue, setInputValue] = useState<number>(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const balance = divideByPrecision(
    getBalance(structureEntityId, resourceId, currentDefaultTick, dojo.setup.components).balance,
  );

  let maxContributableAmount = Math.min(progress.costNeeded! - progress.amount, balance);
  maxContributableAmount = Math.ceil(maxContributableAmount);

  useEffect(() => {
    console.log({ contributions });
    const contributionsCopy = Object.assign({}, contributions);
    if (inputValue === 0 || isNaN(inputValue)) {
      console.log("deleting");
      delete contributionsCopy[resourceId];
    } else {
      console.log("adding");
      contributionsCopy[resourceId] = inputValue;
    }
    console.log({ contributionsCopy });
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
                {findResourceById(resourceId)?.trait as string} ({currencyIntlFormat(balance)})
              </>
            ),
          });
        }}
        onMouseLeave={() => {
          setTooltip(null);
        }}
      >
        <ResourceIcon
          withTooltip={false}
          resource={findResourceById(resourceId)?.trait as string}
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
