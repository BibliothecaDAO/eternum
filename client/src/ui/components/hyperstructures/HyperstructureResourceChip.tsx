import { EternumGlobalConfig, findResourceById, getIconResourceId } from "@bibliothecadao/eternum";

import { ProgressWithPercentage } from "@/hooks/helpers/useHyperstructures";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import useRealmStore from "@/hooks/store/useRealmStore";
import useUIStore from "@/hooks/store/useUIStore";
import { NumberInput } from "@/ui/elements/NumberInput";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { useEffect, useState } from "react";
import { ResourceIcon } from "../../elements/ResourceIcon";

type HyperstructureResourceChipProps = {
  resourceId: number;
  progress: ProgressWithPercentage;
  contributions: Record<number, number>;
  setContributions: (val: Record<number, number>) => void;
};

export const HyperstructureResourceChip = ({
  resourceId,
  contributions,
  setContributions,
  progress,
}: HyperstructureResourceChipProps) => {
  const [inputValue, setInputValue] = useState<number>(0);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const { realmEntityId } = useRealmStore();

  const { getBalance } = useResourceBalance();

  const maxContributableAmount =
    Math.min(progress.costNeeded! - progress.amount, getBalance(realmEntityId, resourceId).balance) /
    EternumGlobalConfig.resources.resourceMultiplier;

  useEffect(() => {
    let contributionsCopy = Object.assign({}, contributions);
    if (inputValue === 0 || isNaN(inputValue)) {
      delete contributionsCopy[resourceId];
    } else {
      contributionsCopy[resourceId] = inputValue;
    }
    setContributions(contributionsCopy);
  }, [inputValue]);

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
                {findResourceById(getIconResourceId(resourceId, false))?.trait as string} (
                {getBalance(realmEntityId, resourceId).balance / EternumGlobalConfig.resources.resourceMultiplier})
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
      <div className="ml-2 pt-2" onClick={() => setInputValue(maxContributableAmount)}>
        MAX
      </div>
    </div>
  );
};
