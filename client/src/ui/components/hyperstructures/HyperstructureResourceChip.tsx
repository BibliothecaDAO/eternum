import { findResourceById, getIconResourceId, HYPERSTRUCTURE_TOTAL_COSTS_SCALED } from "@bibliothecadao/eternum";

import { ResourceIcon } from "../../elements/ResourceIcon";
import { currencyFormat, formatTime } from "../../utils/utils";
import { useProductionManager } from "@/hooks/helpers/useResources";
import { useEffect, useMemo, useState } from "react";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { isInteger } from "lodash";
import { NumberInput } from "@/ui/elements/NumberInput";

type HyperstructureResourceChipProps = {
  resourceId: number;
  amount: number;
//   setNewContributions: (val: number) => void;
};

export const HyperstructureResourceChip = ({ resourceId, amount }: HyperstructureResourceChipProps) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  const progress = useMemo(() => {
    const resourceCost = Object.values(HYPERSTRUCTURE_TOTAL_COSTS_SCALED).find(
      ({ resource }) => resource === resourceId,
    )?.amount;
    return { pourcentage: Math.floor((amount / resourceCost!) * 100), costNeeded: resourceCost };
  }, [amount]);

  console.log(progress);
  return (
    <div
      className={`flex relative group items-center text-xs px-2 p-1 border rounded-xl mt-1 w-3/4`}
      style={{
        backgroundImage:
          progress.pourcentage > 0 ? `linear-gradient(to right, #06D6A03c ${String(amount)}%, rgba(0,0,0,0) 20%)` : "",
      }}
      onMouseEnter={() => {
        setTooltip({
          position: "top",
          content: <>{findResourceById(getIconResourceId(resourceId, false))?.trait as string}</>,
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

      <div className="flex justify-between w-full">
        <div className=" self-center text-sm font-bold">{`${progress.pourcentage}% (${amount} / ${progress.costNeeded})`}</div>
      </div>
      {/* <NumberInput max={progress.costNeeded! - amount}></NumberInput> */}
    </div>
  );
};
