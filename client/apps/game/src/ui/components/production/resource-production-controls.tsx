import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import {
  configManager,
  divideByPrecision,
  getEntityIdFromKeys,
  RealmInfo,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";

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
      systemCalls: { burn_other_predefined_resources_for_resources },
      components: { Resource },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const handleProduce = async () => {
    if (!ticks) return;
    setIsLoading(true);
    const calldata = {
      from_entity_id: realm.entityId,
      produced_resource_types: [selectedResource],
      production_tick_counts: [ticks],
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

  const outputResource = useMemo(() => {
    return configManager.resourceOutput[selectedResource];
  }, [selectedResource]);

  const inputResources = useMemo(() => {
    return configManager.resourceInputs[selectedResource].map((resource) => ({
      ...resource,
      amount: resource.amount / outputResource.amount,
    }));
  }, [selectedResource, outputResource]);

  useEffect(() => {
    setTicks(Math.floor(productionAmount / outputResource.amount));
  }, [productionAmount]);

  const resourceBalances = useMemo(() => {
    if (!selectedResource || !inputResources) return {};

    const balances: Record<number, number> = {};
    [...inputResources, { resource: selectedResource, amount: 1 }].forEach((resource) => {
      const value = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realm.entityId), BigInt(resource.resource)]),
      );
      balances[resource.resource] = divideByPrecision(Number(value?.balance || 0));
    });
    return balances;
  }, [selectedResource, inputResources, Resource, realm.entityId]);

  const handleInputChange = (value: number, inputResource: number) => {
    if (!inputResources) return;

    const resourceConfig = inputResources.find((r) => r.resource === inputResource);
    if (!resourceConfig) return;

    const newAmount = value / resourceConfig.amount;
    setProductionAmount(newAmount);
  };

  const calculateMaxProduction = () => {
    if (!inputResources || !resourceBalances) return 1;

    const maxAmounts = inputResources.map((input) => {
      const balance = resourceBalances[input.resource] || 0;
      return Math.floor(balance / input.amount);
    });

    return Math.max(1, Math.min(...maxAmounts));
  };

  const handleMaxClick = () => {
    setProductionAmount(calculateMaxProduction());
  };

  const isOverBalance = useMemo(() => {
    if (!inputResources || !resourceBalances) return false;

    return inputResources.some((input) => {
      const required = input.amount * productionAmount;
      const balance = resourceBalances[input.resource] || 0;
      return required > balance;
    });
  }, [inputResources, resourceBalances, productionAmount]);

  return (
    <div className="bg-brown/20 p-4 rounded-lg">
      <h3 className="text-2xl font-bold mb-4">Start Production - {ResourcesIds[selectedResource]}</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Raw Resources */}
        <div
          className={`p-4 rounded-lg border-2 cursor-pointer ${
            useRawResources ? "border-gold" : "border-transparent opacity-50"
          }`}
          onClick={() => setUseRawResources(true)}
        >
          <h4 className="text-xl mb-2">Raw Resources</h4>
          <div className="space-y-2">
            {inputResources?.map((input) => {
              const balance = resourceBalances[input.resource] || 0;
              return (
                <div
                  key={input.resource}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-white/5 transition-colors"
                >
                  <ResourceIcon resource={ResourcesIds[input.resource]} size="sm" />
                  <div className="flex items-center justify-between w-full">
                    <div className="w-2/3">
                      <NumberInput
                        value={Math.round(input.amount * productionAmount)}
                        onChange={(value) => handleInputChange(value, input.resource)}
                        min={0}
                        max={resourceBalances[input.resource] || 0}
                        className="rounded-md border-gold/30 hover:border-gold/50"
                      />
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        resourceBalances[input.resource] < input.amount * productionAmount
                          ? "text-order-giants"
                          : "text-gold/60"
                      }`}
                    >
                      {balance}
                    </span>
                  </div>
                </div>
              );
            })}
            <button
              onClick={handleMaxClick}
              className="mt-2 px-3 py-1 text-sm bg-gold/20 hover:bg-gold/30 text-gold rounded"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Labor Costs */}
        <div
          className={`p-4 rounded-lg border-2 cursor-pointer ${
            !useRawResources ? "border-gold" : "border-transparent opacity-50"
          }`}
          onClick={() => setUseRawResources(false)}
        >
          <h4 className="text-xl mb-2">Labor</h4>
          <div className="space-y-2">{/* Add labor inputs */}</div>
        </div>
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
          onClick={handleProduce}
          disabled={isOverBalance}
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
