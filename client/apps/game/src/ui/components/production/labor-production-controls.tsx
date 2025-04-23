import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { SelectResource } from "@/ui/elements/select-resource";
import { formatStringNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import { configManager, divideByPrecision, formatTime, multiplyByPrecision } from "@bibliothecadao/eternum";
import { findResourceById, RealmInfo, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { useMemo, useState } from "react";

export const LaborProductionControls = ({ realm }: { realm: RealmInfo }) => {
  const {
    setup: {
      account: { account },
      systemCalls: { burn_resource_for_labor_production },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedResources, setSelectedResources] = useState<{ id: number; amount: number }[]>([]);

  const resourceManager = useResourceManager(realm.entityId);

  const handleProduce = async () => {
    setIsLoading(true);

    const calldata = {
      entity_id: realm.entityId,
      resource_types: selectedResources.map((r) => r.id),
      resource_amounts: selectedResources.map((r) => multiplyByPrecision(r.amount)),
      signer: account,
    };

    try {
      await burn_resource_for_labor_production(calldata);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const laborConfig = useMemo(() => {
    return selectedResources.map((r) => configManager.getLaborConfig(r.id));
  }, [selectedResources]);

  const { laborAmount, ticks } = useMemo(() => {
    if (!laborConfig.length) return { laborAmount: 0, ticks: 0 };
    const totalLaborAmount = selectedResources.reduce((acc, resource, index) => {
      return acc + resource.amount * (laborConfig[index]?.laborProductionPerResource ?? 0);
    }, 0);

    const maxTicks = Math.max(
      ...laborConfig.map((config, index) => {
        return Math.ceil(
          (selectedResources[index].amount * (config?.laborProductionPerResource || 0)) /
            (config?.laborRatePerTick || 0),
        );
      }),
    );

    return { laborAmount: totalLaborAmount, ticks: maxTicks };
  }, [laborConfig, selectedResources]);

  const availableResources = useMemo(() => {
    const { currentBlockTimestamp } = getBlockTimestamp();
    return selectedResources.map((resource) => {
      const resourceBalance = resourceManager.balanceWithProduction(currentBlockTimestamp, resource.id);
      return {
        resourceId: resource.id,
        amount: resourceBalance,
      };
    });
  }, [selectedResources, resourceManager]);

  const addResource = () => {
    const availableResourceIds = Object.values(ResourcesIds).filter(
      (id) => typeof id === "number" && !selectedResources.map((r) => r.id).includes(id as number),
    );
    if (availableResourceIds.length > 0) {
      setSelectedResources([...selectedResources, { id: availableResourceIds[0] as number, amount: 0 }]);
    }
  };

  const removeResource = (index: number) => {
    setSelectedResources(selectedResources.filter((_, i) => i !== index));
  };

  const updateResourceId = (index: number, id: number) => {
    const newResources = [...selectedResources];
    newResources[index].id = id;
    setSelectedResources(newResources);
  };

  const updateResourceAmount = (index: number, amount: number) => {
    const newResources = [...selectedResources];
    newResources[index].amount = amount;
    setSelectedResources(newResources);
  };

  const handleMaxClick = (index: number) => {
    const resource = selectedResources[index];
    const balance = divideByPrecision(
      Number(availableResources.find((r) => r.resourceId === resource.id)?.amount || 0),
    );
    const newResources = [...selectedResources];
    newResources[index].amount = balance;
    setSelectedResources(newResources);
  };

  const hasInsufficientResources = useMemo(() => {
    return selectedResources.some((resource) => {
      const availableAmount = divideByPrecision(
        Number(availableResources.find((r) => r.resourceId === resource.id)?.amount || 0),
      );
      return resource.amount > availableAmount;
    });
  }, [selectedResources, availableResources]);

  return (
    <div className="bg-brown/20 p-4 rounded-lg">
      <h3 className="text-2xl font-bold mb-4">Labor Production</h3>

      <div className="space-y-4 mb-4">
        {selectedResources.map((resource, index) => (
          <div key={index} className="flex gap-4 items-center">
            <div className="flex-1">
              <SelectResource
                onSelect={(resourceId) => updateResourceId(index, resourceId || 0)}
                className="w-full bg-dark-brown rounded border border-gold/30"
                realmProduction={true}
                defaultValue={resource.id}
                excludeResourceIds={selectedResources.map((r) => r.id).filter((id) => id !== resource.id)}
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3">
                <ResourceIcon resource={ResourcesIds[resource.id]} size="sm" />
                <div className="flex items-center justify-between w-full">
                  <div className="w-2/3">
                    <NumberInput
                      value={resource.amount}
                      onChange={(value) => updateResourceAmount(index, value)}
                      min={1}
                      className="rounded-md border-gold/30 hover:border-gold/50"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMaxClick(index)}
                      className="px-2 py-1 text-sm bg-gold/20 hover:bg-gold/30 text-gold rounded"
                    >
                      MAX
                    </button>
                    <span className="text-sm font-medium text-gold/60">
                      {divideByPrecision(
                        Number(availableResources.find((r) => r.resourceId === resource.id)?.amount || 0),
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={() => removeResource(index)} variant="secondary" className="px-2">
              Remove
            </Button>
          </div>
        ))}

        <Button onClick={addResource} variant="secondary" className="w-full">
          Add Resource
        </Button>
      </div>

      <>
        <div className="mb-4 p-4 rounded-lg border-2 border-gold/30">
          <h4 className="text-xl mb-2">Production Details</h4>
          <div className="space-y-3 text-gold/80">
            <div className="flex items-center gap-2">
              <ResourceIcon resource={findResourceById(ResourcesIds.Labor)?.trait || ""} size="sm" />
              <span>Total Labor Generated:</span>
              <span className="font-medium">{formatStringNumber(Number(laborAmount), 0)}</span>
            </div>

            <div className="flex items-center gap-2 justify-center p-2 bg-white/5 rounded-md">
              <span>Time Required:</span>
              <span className="font-medium">
                {formatTime(ticks * (realm.category === StructureType.Village ? 2 : 1))}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            onClick={handleProduce}
            disabled={
              selectedResources.length === 0 || selectedResources.some((r) => r.amount <= 0) || hasInsufficientResources
            }
            isLoading={isLoading}
            variant="primary"
            className="px-8 py-2"
          >
            {hasInsufficientResources ? "Insufficient Resources" : "Start Labor Production"}
          </Button>
        </div>
      </>
    </div>
  );
};
