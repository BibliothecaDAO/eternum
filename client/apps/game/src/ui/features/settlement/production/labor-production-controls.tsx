import Button from "@/ui/design-system/atoms/button";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SelectResource } from "@/ui/design-system/molecules/select-resource";
import { formatStringNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import { configManager, divideByPrecision, formatTime, multiplyByPrecision } from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { findResourceById, RealmInfo, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

export const LaborProductionControls = ({ realm, bonus }: { realm: RealmInfo; bonus: number }) => {
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
    const totalLaborAmount =
      selectedResources.reduce((acc, resource, index) => {
        return acc + resource.amount * (laborConfig[index]?.laborProductionPerResource ?? 0);
      }, 0) * bonus;

    const maxTicks = Math.max(
      ...laborConfig.map((config, index) => {
        return Math.ceil(
          (selectedResources[index].amount * (config?.laborProductionPerResource || 0) * bonus) /
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
      Number(availableResources.find((r) => r.resourceId === resource.id)?.amount.balance || 0),
    );
    const newResources = [...selectedResources];
    newResources[index].amount = balance;
    setSelectedResources(newResources);
  };

  const hasInsufficientResources = useMemo(() => {
    return selectedResources.some((resource) => {
      const availableAmount = divideByPrecision(
        Number(availableResources.find((r) => r.resourceId === resource.id)?.amount.balance || 0),
      );
      return resource.amount > availableAmount;
    });
  }, [selectedResources, availableResources]);

  return (
    <div className=" py-4">
      <h3 className=" mb-4">Labor Production</h3>

      <div className="space-y-4 mb-4">
        {selectedResources.map((resource, index) => (
          <div key={index} className="flex gap-4 items-center">
            <div className="flex-1">
              <SelectResource
                onSelect={(resourceId) => {
                  if (resourceId !== null) {
                    updateResourceId(index, resourceId);
                  }
                }}
                className="w-full bg-dark-brown rounded border border-gold/30"
                realmProduction={true}
                defaultValue={resource.id}
                excludeResourceIds={selectedResources.map((r) => r.id).filter((id) => id !== resource.id)}
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3">
                {/* <ResourceIcon resource={ResourcesIds[resource.id]} size="sm" /> */}
                <div className="flex items-center justify-between w-full">
                  <div>
                    <NumberInput
                      value={resource.amount}
                      onChange={(value) => updateResourceAmount(index, value)}
                      min={1}
                      className="rounded-md border-gold/30 hover:border-gold/50"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleMaxClick(index)}
                      variant="secondary"
                      className="px-2 py-1 gap-4 text-sm bg-gold/20 hover:bg-gold/30 text-gold rounded"
                    >
                      MAX
                      <span>
                        {divideByPrecision(
                          availableResources.find((r) => r.resourceId === resource.id)?.amount.balance || 0,
                        )
                          .toString()
                          .toLocaleString()}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={() => removeResource(index)} variant="danger" className="px-2">
              Remove
            </Button>
          </div>
        ))}

        {selectedResources.length === 0 && (
          <Button onClick={addResource} variant="secondary" className="w-full">
            Add Resource
          </Button>
        )}
      </div>

      <>
        <div className="mb-4 p-4 panel-wood border-gold/30 bg-green/5">
          <div className=" flex justify-between text-gold/80 gap-4 flex-wrap">
            <h3 className="flex items-center gap-2">
              <ResourceIcon resource={findResourceById(ResourcesIds.Labor)?.trait || ""} size="xl" />
              <span>Total Labor Generated:</span>
              <span className="font-medium">{formatStringNumber(Number(laborAmount), 0)}</span>
            </h3>

            <h4 className="flex items-center gap-2 justify-center  rounded-md">
              <span>Time Required:</span>
              <span className="font-medium">
                {formatTime(ticks * (realm.category === StructureType.Village ? 2 : 1))}
              </span>
            </h4>
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
