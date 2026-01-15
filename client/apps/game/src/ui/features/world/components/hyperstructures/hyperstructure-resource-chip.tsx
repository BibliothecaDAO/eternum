import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import { divideByPrecision, getBalance } from "@bibliothecadao/eternum";
import { ProgressWithPercentage, useDojo } from "@bibliothecadao/react";
import { findResourceById, ID } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";

type HyperstructureResourceChipProps = {
  structureEntityId: ID;
  resourceId: number;
  progress: ProgressWithPercentage;
  contributions: Record<number, number>;
  setContributions: (val: Record<number, number>) => void;
  resetContributions: boolean;
  disabled?: boolean;
};

export const HyperstructureResourceChip = ({
  structureEntityId,
  resourceId,
  contributions,
  setContributions,
  progress,
  resetContributions,
  disabled,
}: HyperstructureResourceChipProps) => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const [inputValue, setInputValue] = useState<number>(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const balance = useMemo(() => {
    return divideByPrecision(
      getBalance(structureEntityId, resourceId, currentDefaultTick, dojo.setup.components).balance,
    );
  }, [structureEntityId, resourceId, currentDefaultTick, dojo.setup.components]);

  let maxContributableAmount = Math.min(progress.costNeeded! - progress.amount, balance);
  maxContributableAmount = Math.ceil(maxContributableAmount);

  useEffect(() => {
    const contributionsCopy = Object.assign({}, contributions);
    if (inputValue === 0 || isNaN(inputValue)) {
      delete contributionsCopy[resourceId];
    } else {
      contributionsCopy[resourceId] = inputValue;
    }
    setContributions(contributionsCopy);
  }, [inputValue]);

  // reset input value when structure entity id changes
  useEffect(() => {
    setInputValue(0);
  }, [structureEntityId]);

  useEffect(() => {
    if (resetContributions) {
      setInputValue(0);
    }
  }, [resetContributions]);

  return (
    <div className="mt-0.5 grid grid-cols-8 gap-1 items-center">
      <div
        className={`flex relative items-center text-xs px-2 py-0.5 col-span-5`}
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

        <div className="flex justify-between text-gold/70">
          <div className="self-center text-xs">{`${currencyIntlFormat(progress.percentage)}% (${currencyIntlFormat(
            progress.amount,
          )} / ${currencyIntlFormat(progress.costNeeded)})`}</div>
        </div>
      </div>

      <NumberInput
        value={inputValue}
        className="w-full text-xs col-span-2 h-6"
        onChange={setInputValue}
        max={maxContributableAmount}
        disabled={disabled}
      />
      <Button variant="default" size="xs" onClick={() => setInputValue(maxContributableAmount)} disabled={disabled}>
        MAX
      </Button>
    </div>
  );
};
