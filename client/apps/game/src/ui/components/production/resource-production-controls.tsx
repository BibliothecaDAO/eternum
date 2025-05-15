import { CartridgeAchievement, checkAndDispatchMultipleGgXyzQuestProgress } from "@/services/gg-xyz";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Tabs } from "@/ui/elements/tab";
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
  bonus,
}: {
  selectedResource: number;
  useRawResources: boolean;
  setUseRawResources: (value: boolean) => void;
  productionAmount: number;
  setProductionAmount: (value: number) => void;
  realm: RealmInfo;
  ticks: number | undefined;
  setTicks: (value: number) => void;
  bonus: number;
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

  // take wonder bonus into account
  const resourceOutputPerInputResourcesWithBonus = useMemo(() => {
    if (!laborConfig) return 0;
    return laborConfig.resourceOutputPerInputResources * bonus;
  }, [laborConfig, bonus]);

  // take wonder bonus into account
  const outputResourceAmountWithBonus = useMemo(() => {
    return configManager.complexSystemResourceOutput[selectedResource].amount * bonus;
  }, [selectedResource, bonus]);

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
      await burn_resource_for_resource_production(calldata).then((res: any) => {
        checkAndDispatchMultipleGgXyzQuestProgress(account.address, res.transaction_hash, [
          CartridgeAchievement.RESOURCE_PRODUCE,
        ]);
      });
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
      const productionCycles = Math.floor(productionAmount / resourceOutputPerInputResourcesWithBonus);
      const calldata = {
        from_entity_id: realm.entityId,
        production_cycles: [productionCycles],
        produced_resource_types: [selectedResource],
        signer: account,
      };

      try {
        await burn_labor_for_resource_production(calldata).then((res: any) => {
          checkAndDispatchMultipleGgXyzQuestProgress(account.address, res.transaction_hash, [
            CartridgeAchievement.RESOURCE_PRODUCE,
          ]);
        });
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
  };

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
      const balance = resourceManager.balanceWithProduction(currentDefaultTick, resource.resource).balance;
      balances[resource.resource] = divideByPrecision(balance);
    });
    return balances;
  }, [selectedResource, resourceManager]);

  useEffect(() => {
    // don't take wonder bonus into account because production time is not affected by it
    setTicks(Math.floor(productionAmount / (outputResourceAmountWithBonus / bonus)));
  }, [productionAmount, outputResourceAmountWithBonus, bonus]);

  const rawCurrentInputs = useMemo(() => {
    return configManager.complexSystemResourceInputs[selectedResource].map(({ resource, amount }) => ({
      resource,
      amount: amount / outputResourceAmountWithBonus,
    }));
  }, [selectedResource, outputResourceAmountWithBonus]);

  const laborCurrentInputs = useMemo(() => {
    return (
      laborConfig?.inputResources.map(({ resource, amount }) => ({
        resource,
        amount: amount / resourceOutputPerInputResourcesWithBonus,
      })) || []
    );
  }, [laborConfig, resourceOutputPerInputResourcesWithBonus]);

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

  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    {
      label: "Standard Production",
      component: (
        <RawResourcesPanel
          selectedResource={selectedResource}
          productionAmount={productionAmount}
          setProductionAmount={setProductionAmount}
          resourceBalances={resourceBalances}
          isSelected={useRawResources}
          onSelect={() => setUseRawResources(true)}
          outputResourceAmount={outputResourceAmountWithBonus}
        />
      ),
    },
    {
      label: "Simple Production",
      component: (
        <div>
          {laborCurrentInputs.length > 0 && (
            <LaborResourcesPanel
              productionAmount={productionAmount}
              setProductionAmount={setProductionAmount}
              resourceBalances={resourceBalances}
              onSelect={() => setUseRawResources(false)}
              laborInputResources={laborConfig?.inputResources || []}
              resourceOutputPerInputResources={resourceOutputPerInputResourcesWithBonus}
            />
          )}
        </div>
      ),
    },
  ];

  if (rawCurrentInputs.length === 0 && laborCurrentInputs.length === 0) return null;

  return (
    <div className=" p-6 rounded-lg panel-wood">
      <div className={`grid ${laborCurrentInputs.length > 0 ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
        <div className="grid grid-cols-1 gap-4">
          <div className="mb-4">
            <h3 className="text-2xl font-bold mb-4">Start Production - {ResourcesIds[selectedResource]}</h3>
            <p className="text-xl text-gold/80 mb-4">
              You can input the output here and it will be automatically calculated.
            </p>
            <div className="flex items-center gap-4 mb-4 w-72">
              <div className="flex items-center gap-2">
                <ResourceIcon resource={ResourcesIds[selectedResource]} size="xl" />
              </div>
              <NumberInput
                value={Math.round(productionAmount)}
                onChange={(value) => setProductionAmount(value)}
                min={1}
                className="rounded-md border-gold/30 hover:border-gold/50"
              />
            </div>
          </div>
        </div>
        <Tabs
          selectedIndex={selectedTab}
          onChange={(index: any) => {
            setSelectedTab(index);
          }}
        >
          <Tabs.List className="p-2 w-full">
            {tabs.map((tab, index) => (
              <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
            ))}
          </Tabs.List>

          <Tabs.Panels className="overflow-hidden">
            {tabs.map((tab, index) => (
              <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      </div>

      {/* Output */}

      <div className="flex flex-col gap-2">
        <div className="flex  justify-between gap-2">
          {" "}
          <div>
            <h2 className="flex items-center gap-2 mt-4">
              {Math.round(productionAmount).toLocaleString()} {ResourcesIds[selectedResource]}
              <ResourceIcon resource={ResourcesIds[selectedResource]} size="sm" /> to produce
            </h2>
          </div>
          <h4 className="flex items-center gap-2">
            <span className="text-gold/80">Time Required:</span>
            <span>
              {ticks
                ? formatTime(Math.floor((ticks / buildingCount) * (realm.category === StructureType.Village ? 2 : 1)))
                : "0s"}
            </span>
          </h4>{" "}
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
  );
};
