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
  resourceName,
  formatPercent,
  formatCharge,
} from "@bibliothecadao/types";
import { useEffect, useState } from "react";
import {
  coversRun,
  maxProductionOutput,
  planProductionRun,
  type ProductionRecipe,
  type ProductionRun,
} from "./production-run";
import { RunInputsPanel } from "./run-inputs-panel";

export const ResourceProductionControls = ({
  selectedResource,
  useRawResources: requestedRawResources,
  setUseRawResources,
  productionAmount,
  setProductionAmount,
  realm,
  bonus,
  compact = false,
}: {
  selectedResource: number;
  useRawResources: boolean;
  setUseRawResources: (value: boolean) => void;
  productionAmount: number;
  setProductionAmount: (value: number) => void;
  realm: RealmInfo;
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
  const rawRecipe = resourceRecipe(selectedResource, bonus);
  const laborRecipe = laborEnabled ? laborRecipeFor(selectedResource, bonus) : undefined;
  const canUseLabor = laborRecipe !== undefined;

  // If labor can't be used and the current panel is labor, force user into standard production
  useEffect(() => {
    if (!canUseLabor && !useRawResources) {
      setUseRawResources(true);
    }
  }, [canUseLabor, useRawResources, setUseRawResources]);

  const resourceManager = useResourceManager(realm.entityId);
  const resourceBalances = (() => {
    const balances: Record<number, number> = {};
    const inputs = [...(rawRecipe?.inputs ?? []), ...(laborRecipe?.inputs ?? [])];
    inputs.forEach(({ resource }) => {
      // An unknown balance is left out, so the run it would cover reads as short.
      const balance = resourceManager.balanceWithProduction(currentDefaultTick, resource)?.balance;
      if (balance !== undefined) balances[resource] = divideByPrecision(balance, false);
    });
    return balances;
  })();

  const recipe = useRawResources ? rawRecipe : laborRecipe;
  const run = recipe && planProductionRun(recipe, productionAmount);
  const verdict =
    run === undefined
      ? "This recipe is unknown here"
      : coversRun(run, resourceBalances)
        ? null
        : "Not enough resources";
  const isDisabled = verdict !== null;

  const produce = async () => {
    if (!run || isDisabled || !canIssueOrders() || isLoading) return;
    setError(null);
    setIsLoading(true);
    const send = useRawResources ? burn_resource_for_resource_production : burn_labor_for_resource_production;
    try {
      await send({
        from_entity_id: realm.entityId,
        produced_resource_types: [selectedResource],
        production_cycles: [run.cycles],
        signer: account,
      });
    } catch (error) {
      setError(productionError(error));
    } finally {
      setIsLoading(false);
    }
  };

  if (!rawRecipe && !laborRecipe) return null;

  const sizeToHoldings = (sized: ProductionRecipe | undefined) => () => {
    if (sized) setProductionAmount(maxProductionOutput(sized, resourceBalances));
  };
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
          {run === undefined
            ? "—"
            : `${runOutputLine(run, selectedResource)} from ${run.inputs
                .map((input) => `${formatCharge(input.amount)} ${resourceName(input.resource)}`)
                .join(" · ")}`}
        </p>
        {(error || verdict || refusal) && (
          <HudNotice tone={error ? "bad" : undefined} line={error ?? refusal ?? verdict ?? ""} />
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

  const buildingCount = getBuildingQuantity(realm.entityId, getBuildingFromResource(selectedResource), store);
  const standardCycles = run && rawRecipe ? run.output / rawRecipe.outputPerCycle : 0;
  const timeRequired = standardCycles
    ? formatWait(
        Math.floor((standardCycles / buildingCount) * (isVillageLikeStructureCategory(realm.category) ? 2 : 1)),
      )
    : "0s";
  const rawPanel = (
    <RunInputsPanel
      title="Resources required"
      inputs={rawRecipe && planProductionRun(rawRecipe, productionAmount).inputs}
      balances={resourceBalances}
      onMax={sizeToHoldings(rawRecipe)}
      onSelect={() => setUseRawResources(true)}
    />
  );
  const laborPanel = laborRecipe && (
    <RunInputsPanel
      title="Labor required"
      inputs={planProductionRun(laborRecipe, productionAmount).inputs}
      balances={resourceBalances}
      onMax={sizeToHoldings(laborRecipe)}
      onSelect={() => setUseRawResources(false)}
    />
  );
  // Only the tabs the player can select; the tab is derived from the production mode so the two never disagree.
  const tabs = [
    ...(laborPanel ? [{ label: "Labor Production", panel: laborPanel, isRaw: false }] : []),
    { label: "Resource Production", panel: rawPanel, isRaw: true },
  ];
  const selectedTab = Math.max(
    0,
    tabs.findIndex((tab) => tab.isRaw === useRawResources),
  );

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
          {tabs.length > 1 ? (
            <div className="flex flex-col gap-2">
              <HudTabs
                tabs={tabs.map((tab, index) => ({ key: index, label: tab.label }))}
                value={selectedTab}
                onChange={(index) => setUseRawResources(tabs[index].isRaw)}
              />
              <div role="tabpanel">{tabs[selectedTab]?.panel}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rawPanel}
              <p className="text-hud-muted">Only standard production is available for this resource.</p>
            </div>
          )}
        </div>

        {error && <HudNotice tone="bad" line={error} />}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hud-divider pt-3">
          <span className="flex items-center gap-1.5 text-hud-strong">
            {run ? runOutputLine(run, selectedResource) : "—"}
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
          {refusal ?? verdict ?? "Start production"}
        </HudButton>
      </div>
    </HudPanel>
  );
};

/** The standard recipe, burning resources; undefined when this game defines none, or one that burns nothing. */
const resourceRecipe = (resource: number, bonus: number): ProductionRecipe | undefined => {
  const inputs = configManager.getRecipeInputs(resource, false);
  const output = configManager.getRecipeOutput(resource, false);
  return inputs?.length && output ? { inputs, outputPerCycle: output * bonus } : undefined;
};

/** The labor recipe, burning labor; undefined when it burns nothing, which the chain refuses. */
const laborRecipeFor = (resource: number, bonus: number): ProductionRecipe | undefined => {
  const labor = configManager.getLaborConfig(resource);
  return labor.inputResources.length && labor.resourceOutputPerInputResources
    ? { inputs: labor.inputResources, outputPerCycle: labor.resourceOutputPerInputResources * bonus }
    : undefined;
};

/** What the run makes: "10 Crossbowman T1", the whole cycles' output, which may be more than was typed. */
const runOutputLine = (run: ProductionRun, resource: number) => `${formatCharge(run.output)} ${resourceName(resource)}`;

/** What a failed start says: the game's reason when it refused the order (play not open yet), else a retry. */
const productionError = (error: unknown): string => {
  if (error instanceof ActionRefusedError) return error.message;
  console.error(error);
  return "Production could not start. Try again.";
};
