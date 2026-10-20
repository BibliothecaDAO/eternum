import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders, useActNowRefusal } from "@/utils/can-issue-orders";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { HudButton, HudField, HudNotice, HudPanel, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules";
import { isVillageLikeStructureCategory } from "@/ui/lib/structure-capabilities";
import { configManager, divideByPrecision, getBuildingQuantity } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import {
  ActionRefusedError,
  getBuildingFromResource,
  RealmInfo,
  ResourcesIds,
  formatWait,
  formatExact,
  resourceName,
  formatPercent,
  formatCharge,
} from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";
import { LaborResourcesPanel } from "./labor-resources-panel";
import { RawResourcesPanel } from "./raw-resources-panel";

export const ResourceProductionControls = ({
  selectedResource,
  useRawResources: requestedRawResources,
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
    account: { account },
    setup: {
      store,
      systemCalls: { burn_resource_for_resource_production, burn_labor_for_resource_production },
    },
  } = useGame();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ordersAllowed = useUIStore(canIssueOrders);
  const refusal = useActNowRefusal();
  const currentDefaultTick = useCurrentDefaultTick();

  const laborEnabled = configManager.isCommandEnabled("BurnLaborForResourceProduction");
  const useRawResources = !laborEnabled || requestedRawResources;
  const laborConfig = useMemo(
    () => (laborEnabled ? configManager.getLaborConfig(selectedResource) : undefined),
    [selectedResource, laborEnabled],
  );

  // Apply the recorded production bonus.
  const resourceOutputPerInputResourcesWithBonus = useMemo(() => {
    if (!laborConfig) return 0;
    return laborConfig.resourceOutputPerInputResources * bonus;
  }, [laborConfig, bonus]);

  // Apply the recorded production bonus.
  // Undefined when this game defines no recipe for the resource: production is then unavailable.
  const recipeInputs = configManager.getRecipeInputs(selectedResource, false);
  const recipeOutput = configManager.getRecipeOutput(selectedResource, false);
  const outputResourceAmountWithBonus = useMemo(() => (recipeOutput ?? 0) * bonus, [recipeOutput, bonus]);

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
      setError(productionError(error));
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
        setError(productionError(error));
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
      ...(recipeInputs ?? []),
      { resource: selectedResource, amount: 1 },
      { resource: ResourcesIds.Labor, amount: 1 },
      { resource: ResourcesIds.Wheat, amount: 1 },
      { resource: ResourcesIds.Fish, amount: 1 },
    ];

    allResources.forEach((resource) => {
      // An unknown balance is left out, so the amount it would cover reads as over balance.
      const balance = resourceManager.balanceWithProduction(currentDefaultTick, resource.resource)?.balance;
      if (balance !== undefined) balances[resource.resource] = divideByPrecision(balance, false);
    });
    return balances;
  })();

  useEffect(() => {
    // don't take wonder bonus into account because production time is not affected by it
    setTicks(Math.floor(productionAmount / outputResourceAmountWithBonus));
  }, [productionAmount, outputResourceAmountWithBonus, bonus]);

  // Each input per unit of output; undefined when the recipe is unknown here, which the panel shows as "—".
  const rawCurrentInputs = useMemo(
    () =>
      recipeInputs?.map(({ resource, amount }) => ({
        resource,
        amount: amount / outputResourceAmountWithBonus,
      })),
    [recipeInputs, outputResourceAmountWithBonus],
  );

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

  // An unknown recipe covers nothing, so production stays disabled.
  const isOverBalance = useMemo(() => {
    if (currentInputs === undefined) return true;
    return currentInputs.some(({ resource, amount }) => {
      const balance = resourceBalances[Number(resource)];
      return balance === undefined || amount * productionAmount > balance;
    });
  }, [resourceBalances, productionAmount, currentInputs]);

  const isDisabled = useMemo(() => {
    if (isOverBalance || !recipeInputs || !recipeOutput) return true;
    if (useRawResources) {
      return !ticks || ticks <= 0;
    } else {
      if (!laborConfig) return true;
      const laborNeeded = Math.round(laborConfig.laborBurnPerResourceOutput * productionAmount);
      return productionAmount <= 0 || laborNeeded <= 0;
    }
  }, [isOverBalance, recipeInputs, recipeOutput, useRawResources, ticks, laborConfig, productionAmount]);

  const buildingCount = getBuildingQuantity(realm.entityId, getBuildingFromResource(selectedResource), store);

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
          inputs={rawCurrentInputs}
          productionAmount={productionAmount}
          setProductionAmount={setProductionAmount}
          resourceBalances={resourceBalances}
          isSelected={useRawResources}
          onSelect={() => setUseRawResources(true)}
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

  if (rawCurrentInputs?.length === 0 && laborCurrentInputs.length === 0) return null;

  const produce = useRawResources ? handleRawResourcesProduce : handleLaborResourcesProduce;
  const amountField = (
    <HudField
      value={String(Math.round(productionAmount))}
      inputMode="numeric"
      aria-label={`Amount of ${resourceName(selectedResource)}`}
      onChange={(typed) => setProductionAmount(Math.max(1, Number(typed.replace(/\D/g, "")) || 0))}
    />
  );

  if (compact)
    return (
      <section aria-label={`${resourceName(selectedResource)} production`} className="flex flex-col gap-2">
        {canUseLabor && (
          <div role="group" aria-label="Production recipe" className="flex gap-1">
            <HudButton
              kind="secondary"
              size="sm"
              aria-pressed={useRawResources}
              onClick={() => setUseRawResources(true)}
            >
              Resources
            </HudButton>
            <HudButton
              kind="secondary"
              size="sm"
              aria-pressed={!useRawResources}
              onClick={() => setUseRawResources(false)}
            >
              {resourceName(ResourcesIds.Labor)}
            </HudButton>
          </div>
        )}
        <span className="flex flex-col gap-1">
          <span className="text-hud-label text-hud-muted">Amount of {resourceName(selectedResource)}</span>
          {amountField}
        </span>
        <p className="text-hud-label">
          {currentInputs === undefined
            ? "—"
            : currentInputs
                .map((input) => `${formatCharge(input.amount * productionAmount)} ${resourceName(input.resource)}`)
                .join(" · ")}
        </p>
        {(error || isDisabled || refusal) && (
          <HudNotice
            tone={error ? "bad" : undefined}
            line={
              error ??
              refusal ??
              (currentInputs === undefined
                ? "This recipe is unknown here."
                : isOverBalance
                  ? "Not enough resources."
                  : "Enter at least one production cycle.")
            }
          />
        )}
        <HudButton
          kind="primary"
          busy={isLoading ? "Starting…" : undefined}
          disabled={!ordersAllowed || isDisabled || refusal !== null}
          onClick={produce}
        >
          Start Production
        </HudButton>
      </section>
    );

  const timeRequired = ticks
    ? formatWait(Math.floor((ticks / buildingCount) * (isVillageLikeStructureCategory(realm.category) ? 2 : 1)))
    : "0s";

  return (
    <HudPanel kind="section" title={`Start production · ${resourceName(selectedResource)}`} collapsible={false}>
      <div className="flex flex-col gap-3">
        <div className={canUseLabor ? "grid grid-cols-1 gap-4 lg:grid-cols-2" : "grid grid-cols-1 gap-4"}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ResourceIcon resource={selectedResource} size="md" />
              {amountField}
            </div>
            <p className="text-hud-muted">Type the output; the inputs follow.</p>
          </div>
          {selectableTabs.length > 1 ? (
            <div className="flex flex-col gap-2">
              <HudTabs
                tabs={selectableTabs.map((tab, index) => ({ key: index, label: tab.label }))}
                value={selectedTab}
                onChange={(index) => setUseRawResources(selectableTabs[index].isRaw)}
              />
              <div role="tabpanel">{selectableTabs[selectedTab]?.component}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <RawResourcesPanel
                inputs={rawCurrentInputs}
                productionAmount={productionAmount}
                setProductionAmount={setProductionAmount}
                resourceBalances={resourceBalances}
                isSelected={true}
                onSelect={() => setUseRawResources(true)}
              />
              <p className="text-hud-muted">Only standard production is available for this resource.</p>
            </div>
          )}
        </div>

        {error && <HudNotice tone="bad" line={error} />}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hud-divider pt-3">
          <span className="flex items-center gap-1.5 text-hud-strong">
            {formatExact(Math.round(productionAmount))} {resourceName(selectedResource)}
            <ResourceIcon resource={selectedResource} size="xs" withTooltip={false} />
            {bonus > 1 && <span className="text-hud-good">{formatPercent(bonus - 1, { signed: true })} bonus</span>}
          </span>
          <span className="text-hud-label text-hud-cue">Time required {timeRequired}</span>
        </div>
        <HudButton
          kind={isDisabled || refusal ? "secondary" : "primary"}
          busy={isLoading ? "Starting…" : undefined}
          disabled={!ordersAllowed || isDisabled || refusal !== null}
          onClick={produce}
        >
          {refusal ?? (isDisabled ? "Not enough resources" : "Start production")}
        </HudButton>
      </div>
    </HudPanel>
  );
};

/** What a failed start says: the game's reason when it refused the order (play not open yet), else a retry. */
const productionError = (error: unknown): string => {
  if (error instanceof ActionRefusedError) return error.message;
  console.error(error);
  return "Production could not start. Try again.";
};
