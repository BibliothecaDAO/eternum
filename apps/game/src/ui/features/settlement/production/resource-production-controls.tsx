import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useComponentValue } from "@dojoengine/react";
import { gameEntityKey } from "@/sync/game-scope";
import { Button, NumberInput, Tabs } from "@/ui/design-system/atoms";
import { ResourceIcon } from "@/ui/design-system/molecules";
import { isVillageLikeStructureCategory } from "@/ui/lib/structure-capabilities";
import { configManager, divideByPrecision, formatTime, getBuildingQuantity } from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { getBuildingFromResource, RealmInfo, ResourcesIds } from "@bibliothecadao/types";
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
  compact = false,
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
  compact?: boolean;
}) => {
  const {
    setup: {
      account: { account },
      components,
      systemCalls: { burn_resource_for_resource_production, burn_labor_for_resource_production },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ordersAllowed = useUIStore(canIssueOrders);
  const currentDefaultTick = useCurrentDefaultTick();
  useComponentValue(components.Resource, gameEntityKey([BigInt(realm.entityId)]));
  useComponentValue(components.StructureBuildings, gameEntityKey([BigInt(realm.entityId)]));

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
    if (!canIssueOrders() || isDisabled || isLoading || !ticks) return;
    setError(null);
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
      setError("Production could not start. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaborResourcesProduce = async () => {
    if (!canIssueOrders() || isDisabled || isLoading || !laborConfig) return;
    setError(null);
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
        await burn_labor_for_resource_production(calldata);
      } catch (error) {
        console.error(error);
        setError("Production could not start. Try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const resourceManager = useResourceManager(realm.entityId);

  const resourceBalances = (() => {
    if (!selectedResource) return {};

    const balances: Record<number, number> = {};
    const allResources = [
      ...configManager.complexSystemResourceInputs[selectedResource],
      { resource: selectedResource, amount: 1 },
      { resource: ResourcesIds.Labor, amount: 1 },
      { resource: ResourcesIds.Wheat, amount: 1 },
      { resource: ResourcesIds.Fish, amount: 1 },
    ];

    allResources.forEach((resource) => {
      const balance = resourceManager.balanceWithProduction(currentDefaultTick, resource.resource).balance;
      balances[resource.resource] = divideByPrecision(balance);
    });
    return balances;
  })();

  useEffect(() => {
    // don't take wonder bonus into account because production time is not affected by it
    setTicks(Math.floor(productionAmount / outputResourceAmountWithBonus));
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

  const canUseLabor = useMemo(() => {
    return laborCurrentInputs.length > 0;
  }, [laborCurrentInputs]);

  // If labor can't be used and the current panel is labor, force user into standard production
  useEffect(() => {
    if (!canUseLabor && !useRawResources) {
      setUseRawResources(true);
    }
  }, [canUseLabor, useRawResources, setUseRawResources]);

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

  const buildingCount = getBuildingQuantity(realm.entityId, getBuildingFromResource(selectedResource), components);

  // Only show the tabs that the user can actually select
  const selectableTabs = [
    {
      label: "Labor Production",
      component: canUseLabor ? (
        <LaborResourcesPanel
          productionAmount={productionAmount}
          setProductionAmount={setProductionAmount}
          resourceBalances={resourceBalances}
          onSelect={() => setUseRawResources(false)}
          laborInputResources={laborConfig?.inputResources || []}
          resourceOutputPerInputResources={resourceOutputPerInputResourcesWithBonus}
        />
      ) : null,
      canSelect: canUseLabor,
      isRaw: false,
    },
    {
      label: "Resource Production",
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
      canSelect: true,
      isRaw: true,
    },
  ].filter((tab) => tab.canSelect);

  // The tab is derived from the production mode so the two can never disagree
  const selectedTab = Math.max(
    0,
    selectableTabs.findIndex((tab) => tab.isRaw === useRawResources),
  );

  if (rawCurrentInputs.length === 0 && laborCurrentInputs.length === 0) return null;

  if (compact)
    return (
      <section aria-label={`${ResourcesIds[selectedResource]} production`} className="space-y-2 text-xs">
        {canUseLabor && (
          <div role="group" aria-label="Production recipe" className="flex gap-1">
            <button
              type="button"
              aria-pressed={useRawResources}
              onClick={() => setUseRawResources(true)}
              className="rounded border border-gold/30 px-2 py-1"
            >
              Resources
            </button>
            <button
              type="button"
              aria-pressed={!useRawResources}
              onClick={() => setUseRawResources(false)}
              className="rounded border border-gold/30 px-2 py-1"
            >
              Labor
            </button>
          </div>
        )}
        <label className="block space-y-1">
          Amount of {ResourcesIds[selectedResource]}
          <NumberInput value={Math.round(productionAmount)} onChange={setProductionAmount} min={1} arrows={false} />
        </label>
        <p>
          {currentInputs
            .map(
              (input) =>
                `${Math.ceil(input.amount * productionAmount).toLocaleString()} ${ResourcesIds[input.resource]}`,
            )
            .join(" · ")}
        </p>
        {(error || isDisabled) && (
          <p role="status">
            {error ?? (isOverBalance ? "Not enough resources." : "Enter at least one production cycle.")}
          </p>
        )}
        <Button
          onClick={useRawResources ? handleRawResourcesProduce : handleLaborResourcesProduce}
          disabled={!ordersAllowed || isDisabled || isLoading}
          isLoading={isLoading}
          variant="gold"
          className="w-full"
          size="xs"
        >
          Start Production
        </Button>
      </section>
    );

  return (
    <div className="p-6 rounded-lg border border-gold/20 bg-black/30">
      <div className={`grid ${canUseLabor ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
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
        {selectableTabs.length > 1 ? (
          <Tabs
            selectedIndex={selectedTab}
            onChange={(index: any) => {
              setUseRawResources(selectableTabs[index].isRaw);
            }}
          >
            <Tabs.List className="p-2 w-full">
              {selectableTabs.map((tab, index) => (
                <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
              ))}
            </Tabs.List>

            <Tabs.Panels className="overflow-hidden">
              {selectableTabs.map((tab, index) => (
                <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
              ))}
            </Tabs.Panels>
          </Tabs>
        ) : (
          <div className="flex flex-col gap-2">
            <RawResourcesPanel
              selectedResource={selectedResource}
              productionAmount={productionAmount}
              setProductionAmount={setProductionAmount}
              resourceBalances={resourceBalances}
              isSelected={true}
              onSelect={() => setUseRawResources(true)}
              outputResourceAmount={outputResourceAmountWithBonus}
            />
            <div className="text-sm text-gold/70 mt-2">
              <span>
                Only standard production is available for this resource. Simple production is not unlocked or not
                available yet.
              </span>
            </div>
          </div>
        )}
      </div>

      {error && <p role="status">{error}</p>}
      {/* Output */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 mt-4">
              {Math.round(productionAmount).toLocaleString()} {ResourcesIds[selectedResource]}
              <ResourceIcon resource={ResourcesIds[selectedResource]} size="sm" /> to produce
              {bonus > 1 && (
                <span className="text-relic-activated text-lg font-semibold animate-pulse">
                  (+{Math.round((bonus - 1) * 100)}% bonus)
                </span>
              )}
            </h2>
          </div>
          <h4 className="flex items-center gap-2">
            <span className="text-gold/80">Time Required:</span>
            <span>
              {ticks
                ? formatTime(
                    Math.floor((ticks / buildingCount) * (isVillageLikeStructureCategory(realm.category) ? 2 : 1)),
                  )
                : "0s"}
            </span>
          </h4>
        </div>

        <Button
          onClick={useRawResources ? handleRawResourcesProduce : handleLaborResourcesProduce}
          disabled={!ordersAllowed || isDisabled || isLoading}
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
