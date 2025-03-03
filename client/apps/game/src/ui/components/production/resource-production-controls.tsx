import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getLaborConfig } from "@/utils/labor";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  configManager,
  divideByPrecision,
  multiplyByPrecision,
  RealmInfo,
  ResourceManager,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
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
      systemCalls: { burn_other_predefined_resources_for_resources, burn_labor_resources_for_other_production },
      components,
      components: { Resource },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const laborConfig = useMemo(() => getLaborConfig(selectedResource), [selectedResource]);

  const handleRawResourcesProduce = async () => {
    if (!ticks) return;
    setIsLoading(true);
    const calldata = {
      from_entity_id: realm.entityId,
      produced_resource_types: [selectedResource],
      production_tick_counts: [ticks * outputResource.amount],
      signer: account,
    };

    try {
      await burn_other_predefined_resources_for_resources(calldata);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaborResourcesProduce = async () => {
    if (!laborConfig) return;
    const laborNeeded = Math.round(laborConfig.laborBurnPerResource * productionAmount);

    if (productionAmount > 0 && laborNeeded > 0 && productionAmount > 0) {
      setIsLoading(true);

      const calldata = {
        from_entity_id: realm.entityId,
        labor_amounts: [multiplyByPrecision(laborNeeded)],
        produced_resource_types: [selectedResource],
        signer: account,
      };

      try {
        await burn_labor_resources_for_other_production(calldata);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const outputResource = useMemo(() => {
    return configManager.resourceOutput[selectedResource];
  }, [selectedResource]);

  const resourceBalances = useMemo(() => {
    if (!selectedResource) return {};

    const balances: Record<number, number> = {};
    const allResources = [
      ...configManager.resourceInputs[selectedResource],
      { resource: selectedResource, amount: 1 },
      { resource: ResourcesIds.Labor, amount: 1 },
      { resource: ResourcesIds.Wheat, amount: 1 },
      { resource: ResourcesIds.Fish, amount: 1 },
    ];

    const { currentDefaultTick } = getBlockTimestamp();

    allResources.forEach((resource) => {
      const resourceManager = new ResourceManager(components, realm.entityId, resource.resource);
      const balance = resourceManager.balanceWithProduction(currentDefaultTick);
      balances[resource.resource] = divideByPrecision(balance);
    });
    return balances;
  }, [selectedResource, Resource, realm.entityId]);

  useEffect(() => {
    setTicks(Math.floor(productionAmount / outputResource.amount));
  }, [productionAmount]);

  const currentInputs = useMemo(() => {
    return useRawResources
      ? configManager.resourceInputs[selectedResource].map(({ resource, amount }) => ({
          resource,
          amount: amount / outputResource.amount,
        }))
      : laborConfig?.inputResources || [];
  }, [useRawResources, selectedResource, laborConfig]);

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
      const laborNeeded = Math.round(laborConfig.laborBurnPerResource * productionAmount);
      return productionAmount <= 0 || laborNeeded <= 0;
    }
  }, [isOverBalance, useRawResources, ticks, laborConfig, productionAmount]);

  if (currentInputs.length === 0) return null;

  return (
    <div className="bg-brown/20 p-4 rounded-lg">
      <h3 className="text-2xl font-bold mb-4">Start Production - {ResourcesIds[selectedResource]}</h3>

      <div className={`grid ${laborConfig ? "grid-cols-2" : "grid-cols-1"} gap-4 mb-4`}>
        <RawResourcesPanel
          selectedResource={selectedResource}
          productionAmount={productionAmount}
          setProductionAmount={setProductionAmount}
          resourceBalances={resourceBalances}
          isSelected={useRawResources}
          onSelect={() => setUseRawResources(true)}
          outputResource={outputResource}
        />

        {laborConfig && (
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
      <div className="mb-4 p-4 rounded-lg border-2 border-gold/30">
        <h4 className="text-xl mb-4 text-gold">Output</h4>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <ResourceIcon resource={ResourcesIds[selectedResource]} size="sm" />
            <span className="text-gold/80">Amount:</span>
          </div>
          <NumberInput
            value={Math.round(productionAmount)}
            onChange={(value) => setProductionAmount(value)}
            min={1}
            className="rounded-md border-gold/30 hover:border-gold/50"
          />
        </div>
        <div className="flex items-center gap-2 justify-center p-2 bg-white/5 rounded-md">
          <span className="text-gold/80">Production Time:</span>
          <span className="font-medium">
            {ticks
              ? (() => {
                  const days = Math.floor(ticks / (24 * 60 * 60));
                  const hours = Math.floor((ticks % (24 * 60 * 60)) / (60 * 60));
                  const minutes = Math.floor((ticks % (60 * 60)) / 60);
                  const seconds = ticks % 60;

                  return [
                    days > 0 ? `${days}d ` : "",
                    hours > 0 ? `${hours}h ` : "",
                    minutes > 0 ? `${minutes}m ` : "",
                    `${seconds}s`,
                  ].join("");
                })()
              : "0s"}
          </span>
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={useRawResources ? handleRawResourcesProduce : handleLaborResourcesProduce}
          disabled={isDisabled}
          isLoading={isLoading}
          variant="primary"
          className="px-8 py-2"
        >
          Start Production
        </Button>
      </div>
    </div>
  );
};
