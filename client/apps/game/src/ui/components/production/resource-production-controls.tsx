import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getBlockTimestamp } from "@/utils/timestamp";
import { configManager, divideByPrecision, formatTime, getBuildingQuantity } from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { getBuildingFromResource, RealmInfo, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";
import { LaborResourcesPanel } from "./labor-resources-panel";
import { RawResourcesPanel } from "./raw-resources-panel";

export const ResourceProductionControls = ({
  selectedResource,
  useRawResources,
  setUseRawResources,
  productionAmount,
  setProductionAmount,
  realm,
  ticks,
  setTicks,
}: {
  selectedResource: number;
  useRawResources: boolean;
  setUseRawResources: (value: boolean) => void;
  productionAmount: number;
  setProductionAmount: (value: number) => void;
  realm: RealmInfo;
  ticks: number | undefined;
  setTicks: (value: number) => void;
}) => {
  const {
    setup: {
      account: { account },
      components,
      systemCalls: { burn_resource_for_resource_production, burn_labor_for_resource_production },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const laborConfig = useMemo(() => configManager.getLaborConfig(selectedResource), [selectedResource]);

  const handleRawResourcesProduce = async () => {
    if (!ticks) return;
    setIsLoading(true);
    const calldata = {
      from_entity_id: realm.entityId,
      produced_resource_types: [selectedResource],
      production_cycles: [ticks],
      signer: account,
    };

    try {
      await burn_resource_for_resource_production(calldata);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaborResourcesProduce = async () => {
    if (!laborConfig) return;

    if (productionAmount > 0) {
      setIsLoading(true);
      const productionCycles = Math.floor(productionAmount / laborConfig?.resourceOutputPerInputResources);
      const calldata = {
        from_entity_id: realm.entityId,
        production_cycles: [productionCycles],
        produced_resource_types: [selectedResource],
        signer: account,
      };

      try {
        await burn_labor_for_resource_production(calldata);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const outputResource = useMemo(() => {
    return configManager.complexSystemResourceOutput[selectedResource];
  }, [selectedResource]);

  const resourceManager = useResourceManager(realm.entityId);

  const resourceBalances = useMemo(() => {
    if (!selectedResource) return {};

    const balances: Record<number, number> = {};
    const allResources = [
      ...configManager.complexSystemResourceInputs[selectedResource],
      { resource: selectedResource, amount: 1 },
      { resource: ResourcesIds.Labor, amount: 1 },
      { resource: ResourcesIds.Wheat, amount: 1 },
      { resource: ResourcesIds.Fish, amount: 1 },
    ];

    const { currentDefaultTick } = getBlockTimestamp();

    allResources.forEach((resource) => {
      const balance = resourceManager.balanceWithProduction(currentDefaultTick, resource.resource);
      balances[resource.resource] = divideByPrecision(balance);
    });
    return balances;
  }, [selectedResource, resourceManager]);

  useEffect(() => {
    setTicks(Math.floor(productionAmount / outputResource.amount));
  }, [productionAmount]);

  const rawCurrentInputs = useMemo(() => {
    return configManager.complexSystemResourceInputs[selectedResource].map(({ resource, amount }) => ({
      resource,
      amount: amount / outputResource.amount,
    }));
  }, [selectedResource, outputResource]);

  const laborCurrentInputs = useMemo(() => {
    return (
      laborConfig?.inputResources.map(({ resource, amount }) => ({
        resource,
        amount: amount / laborConfig.resourceOutputPerInputResources,
      })) || []
    );
  }, [laborConfig]);

  const currentInputs = useMemo(() => {
    return useRawResources ? rawCurrentInputs : laborCurrentInputs;
  }, [useRawResources, rawCurrentInputs, laborCurrentInputs]);

  const isOverBalance = useMemo(() => {
    return Object.values(currentInputs).some(({ resource, amount }) => {
      const balance = resourceBalances[Number(resource)] || 0;
      return amount * productionAmount > balance;
    });
  }, [resourceBalances, productionAmount, currentInputs]);

  const isDisabled = useMemo(() => {
    if (isOverBalance) return true;
    if (useRawResources) {
      return !ticks || ticks <= 0;
    } else {
      if (!laborConfig) return true;
      const laborNeeded = Math.round(laborConfig.laborBurnPerResourceOutput * productionAmount);
      return productionAmount <= 0 || laborNeeded <= 0;
    }
  }, [isOverBalance, useRawResources, ticks, laborConfig, productionAmount]);

  const buildingCount = useMemo(() => {
    return getBuildingQuantity(realm.entityId, getBuildingFromResource(selectedResource), components);
  }, [realm.entityId, selectedResource, components]);

  if (rawCurrentInputs.length === 0 && laborCurrentInputs.length === 0) return null;

  return (
    <div className=" p-4 rounded-lg">
      <h3 className="text-2xl font-bold mb-4">Start Production - {ResourcesIds[selectedResource]}</h3>

      <div className={`grid ${laborCurrentInputs.length > 0 ? "grid-cols-2" : "grid-cols-1"} gap-4 mb-4`}>
        <RawResourcesPanel
          selectedResource={selectedResource}
          productionAmount={productionAmount}
          setProductionAmount={setProductionAmount}
          resourceBalances={resourceBalances}
          isSelected={useRawResources}
          onSelect={() => setUseRawResources(true)}
          outputResource={outputResource}
        />

        {laborCurrentInputs.length > 0 && (
          <LaborResourcesPanel
            selectedResource={selectedResource}
            productionAmount={productionAmount}
            setProductionAmount={setProductionAmount}
            resourceBalances={resourceBalances}
            isSelected={!useRawResources}
            onSelect={() => setUseRawResources(false)}
          />
        )}
      </div>

      {/* Output */}
      <div className="grid grid-cols-2 gap-4">
        <div className="mb-4 p-4 rounded-lg border-2 border-gold/30 panel-gold">
          <h4 className=" mb-2">Production Output</h4>
          <p className="text-xl text-gold/80 mb-4">
            You can input the output here and it will be automatically calculated.
          </p>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <ResourceIcon resource={ResourcesIds[selectedResource]} size="xl" />
              <span className="text-gold/80">Amount</span>
            </div>
            <NumberInput
              value={Math.round(productionAmount)}
              onChange={(value) => setProductionAmount(value)}
              min={1}
              className="rounded-md border-gold/30 hover:border-gold/50"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className=" text-xl my-4">
            You will be charged for the production of {productionAmount.toLocaleString()}{" "}
            <span className="flex items-center gap-2">
              {" "}
              {ResourcesIds[selectedResource]}
              <ResourceIcon resource={ResourcesIds[selectedResource]} size="sm" />
            </span>
          </div>
          <div className="flex items-center gap-2 justify-center p-2 bg-white/5 rounded-md  text-2xl">
            <span className="text-gold/80">Production Time:</span>
            <span>
              {ticks
                ? formatTime(Math.floor((ticks / buildingCount) * (realm.category === StructureType.Village ? 2 : 1)))
                : "0s"}
            </span>
          </div>
          <Button
            onClick={useRawResources ? handleRawResourcesProduce : handleLaborResourcesProduce}
            disabled={isDisabled}
            isLoading={isLoading}
            variant={isDisabled ? "default" : "gold"}
            className="px-8 py-2"
            size="lg"
          >
            {isDisabled ? "Not enough resources" : "Start Production"}
          </Button>
        </div>
      </div>
    </div>
  );
};
