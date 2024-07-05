import { findResourceById, getIconResourceId } from "@bibliothecadao/eternum";

import { ProgressWithPercentage } from "@/hooks/helpers/useHyperstructures";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import { NumberInput } from "@/ui/elements/NumberInput";
import { currencyIntlFormat, divideByPrecision } from "@/ui/utils/utils";
import { useEffect, useState } from "react";
import { ResourceIcon } from "../../elements/ResourceIcon";

type HyperstructureResourceChipProps = {
  realmEntityId: bigint;
  resourceId: number;
  progress: ProgressWithPercentage;
  contributions: Record<number, number>;
  setContributions: (val: Record<number, number>) => void;
  resetContributions: boolean;
};

export const HyperstructureResourceChip = ({
  realmEntityId,
  resourceId,
  contributions,
  setContributions,
  progress,
  resetContributions,
}: HyperstructureResourceChipProps) => {
  const [inputValue, setInputValue] = useState<number>(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const { getBalance, getResourceProductionInfo } = useResourceBalance();
  const balance = divideByPrecision(getBalance(realmEntityId, resourceId).balance);
  const production = getResourceProductionInfo(realmEntityId, resourceId);

  const safetyMargin = production !== undefined && production?.consumption_rate !== 0n ? 0.95 : 1;

  const maxContributableAmount = Math.floor(safetyMargin * Math.min(progress.costNeeded! - progress.amount, balance));

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
    <div className="flex mt-1">
      <div
        className={`flex relative items-center text-xs px-2 p-1  w-[80%]`}
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
          size="sm"
          className="mr-3 self-center"
        />

        <div className="flex justify-between">
          <div className=" self-center text-sm font-bold">{`${progress.percentage}% (${currencyIntlFormat(
            progress.amount,
          )} / ${currencyIntlFormat(progress.costNeeded)})`}</div>
        </div>
      </div>

      <NumberInput value={inputValue} className=" w-[20%]" onChange={setInputValue} max={maxContributableAmount} />
      <div className="ml-2 flex items-center" onClick={() => setInputValue(maxContributableAmount)}>
        MAX
      </div>
    </div>
  );
};
