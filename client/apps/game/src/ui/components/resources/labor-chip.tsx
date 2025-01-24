import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import {
  configManager,
  findResourceById,
  getResourceIdFromLaborId,
  LaborIds,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useState } from "react";

type LaborChipProps = {
  laborId: LaborIds;
  startProduction: (resourceType: ResourcesIds, amount: number) => void;
};

export const LaborChip = ({ laborId, startProduction }: LaborChipProps) => {
  const resourceId = getResourceIdFromLaborId(laborId);

  const [productionAmount, setProductionAmount] = useState(0);

  const laborInputs = configManager.laborInputs[resourceId as ResourcesIds];

  return (
    <>
      <div className={`flex gap-2 relative group items-center text-xs px-2 p-1 hover:bg-gold/20 `}>
        <div className="flex flex-col">
          {laborInputs?.map(({ resource, amount }) => (
            <div key={resource} className="flex flex-row items-center">
              <ResourceIcon
                withTooltip={false}
                resource={findResourceById(resource)?.trait as string}
                size="sm"
                className="mr-3 self-center"
              />
              <div className="text-red">-{amount * productionAmount}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-10 w-full items-center">
          <div className="flex flex-col col-span-7">
            <NumberInput
              value={productionAmount}
              onChange={(productionAmount) => setProductionAmount(productionAmount)}
              className="col-span-7"
            />
            <Button variant="primary" onClick={() => startProduction(resourceId, productionAmount)}>
              Start Producing
            </Button>
          </div>
          <ResourceIcon
            withTooltip={false}
            resource={findResourceById(resourceId)?.trait as string}
            size="md"
            className=""
          />
        </div>
      </div>
    </>
  );
};
