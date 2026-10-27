import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders, useActNowRefusal } from "@/utils/can-issue-orders";
import { ActionFailureNotice } from "@/ui/features/event-feed/action-failure-notice";
import { type ActionFailure, actionFailure } from "@/ui/features/event-feed/notify";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { AmountInput, HudButton, HudNotice, HudPanel, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules";
import { isVillageLikeStructureCategory } from "@/ui/lib/structure-capabilities";
import { configManager, getBuildingQuantity } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import {
  getBuildingFromResource,
  RealmInfo,
  ResourcesIds,
  formatWait,
  resourceName,
  formatPercent,
  formatCharge,
  formatTypedNumber,
} from "@bibliothecadao/types";
import { useEffect, useState } from "react";
import {
  coversRun,
  fromUnits,
  oneCycleOf,
  planProductionRun,
  type ProductionRecipe,
  type ProductionRun,
  type RunSizing,
} from "./production-run";
import { RunInputsPanel, type RunInput } from "./run-inputs-panel";

export const ResourceProductionControls = ({
  selectedResource,
  useRawResources: requestedRawResources,
  setUseRawResources,
  sizing,
  setSizing,
  realm,
  bonusPercent,
  compact = false,
}: {
  selectedResource: number;
  useRawResources: boolean;
  setUseRawResources: (value: boolean) => void;
  sizing: RunSizing;
  setSizing: (sizing: RunSizing) => void;
  realm: RealmInfo;
  /** The running bonus on this resource's output, in ten-thousandths. */
  bonusPercent: number;
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
  // Why the last start did not happen: told until the next one.
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const ordersAllowed = useUIStore(canIssueOrders);
  const refusal = useActNowRefusal();
  const currentDefaultTick = useCurrentDefaultTick();

  const laborEnabled = configManager.isCommandEnabled("BurnLaborForResourceProduction");
  const useRawResources = !laborEnabled || requestedRawResources;
  const rawRecipe = recipeOf(selectedResource, false, bonusPercent);
  const laborRecipe = laborEnabled ? recipeOf(selectedResource, true, bonusPercent) : undefined;
  const canUseLabor = laborRecipe !== undefined;

  // If labor can't be used and the current panel is labor, force user into standard production
  useEffect(() => {
    if (!canUseLabor && !useRawResources) {
      setUseRawResources(true);
    }
  }, [canUseLabor, useRawResources, setUseRawResources]);

  const resourceManager = useResourceManager(realm.entityId);
  // Each input's balance in resource units, as the chain spends it; an unknown one is left out, so it covers nothing.
  const balances: Record<number, bigint> = {};
  [...(rawRecipe?.inputs ?? []), ...(laborRecipe?.inputs ?? [])].forEach(({ resource }) => {
    const balance = resourceManager.balanceWithProduction(currentDefaultTick, resource)?.balance;
    if (balance !== undefined) balances[resource] = BigInt(Math.floor(balance));
  });

  const recipe = useRawResources ? rawRecipe : laborRecipe;
  const run = recipe && planProductionRun(recipe, sizing, balances);
  const verdict = runVerdict(recipe, run, sizing, balances);
  const isDisabled = verdict !== null;

  const produce = async () => {
    if (!run || isDisabled || !canIssueOrders() || isLoading) return;
    setFailure(null);
    setIsLoading(true);
    const send = useRawResources ? burn_resource_for_resource_production : burn_labor_for_resource_production;
    try {
      await send({
        from_entity_id: realm.entityId,
        produced_resource_types: [selectedResource],
        production_cycles: [Number(run.cycles)],
        signer: account,
      });
    } catch (error) {
      setFailure(actionFailure(error, "Production could not start. Try again."));
    } finally {
      setIsLoading(false);
    }
  };

  if (!rawRecipe && !laborRecipe) return null;

  // Switching recipe keeps the output the run makes, since the other recipe may not burn the budgeted input.
  const chooseRecipe = (raw: boolean) => {
    if (raw === useRawResources) return;
    if (sizing.by !== "output") setSizing({ by: "output", amount: run ? fromUnits(run.outputUnits) : 1 });
    setUseRawResources(raw);
  };
  const amountField = (
    <AmountInput
      label={`Amount of ${resourceName(selectedResource)}`}
      value={sizing.by === "output" ? sizing.amount : run ? fromUnits(run.outputUnits) : 0}
      max={Number.POSITIVE_INFINITY}
      onChange={(amount) => setSizing({ by: "output", amount })}
    />
  );

  if (compact)
    return (
      <section aria-label={`${resourceName(selectedResource)} production`} className="flex flex-col gap-2">
        {canUseLabor && (
          <div role="group" aria-label="Production recipe" className="flex gap-1">
            <HudButton kind="secondary" size="sm" aria-pressed={useRawResources} onClick={() => chooseRecipe(true)}>
              Resources
            </HudButton>
            <HudButton kind="secondary" size="sm" aria-pressed={!useRawResources} onClick={() => chooseRecipe(false)}>
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
                .map((input) => `${formatCharge(fromUnits(input.units))} ${resourceName(input.resource)}`)
                .join(" · ")}`}
        </p>
        {failure ? (
          <ActionFailureNotice failure={failure} />
        ) : (
          (refusal ?? verdict) && <HudNotice line={refusal ?? verdict ?? ""} />
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
  const standardCycles = run && rawRecipe ? Number(run.outputUnits) / Number(rawRecipe.outputUnits) : 0;
  const timeRequired = standardCycles
    ? formatWait(
        Math.floor((standardCycles / buildingCount) * (isVillageLikeStructureCategory(realm.category) ? 2 : 1)),
      )
    : "0s";
  const panelFor = (panelRecipe: ProductionRecipe | undefined, raw: boolean, title: string) => (
    <RunInputsPanel
      title={title}
      inputs={panelRecipe && runInputs(planProductionRun(panelRecipe, sizing, balances), sizing, balances)}
      onBudget={(resource, amount) => {
        chooseRecipe(raw);
        setSizing({ by: "input", resource, amount });
      }}
      onMax={() => {
        chooseRecipe(raw);
        setSizing({ by: "max" });
      }}
      onSelect={() => chooseRecipe(raw)}
    />
  );
  const rawPanel = panelFor(rawRecipe, true, "Resources required");
  // Only the tabs the player can select; the tab is derived from the production mode so the two never disagree.
  const tabs = [
    ...(laborRecipe
      ? [{ label: "Labor Production", panel: panelFor(laborRecipe, false, "Labor required"), isRaw: false }]
      : []),
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
          </div>
          {tabs.length > 1 ? (
            <div className="flex flex-col gap-2">
              <HudTabs
                tabs={tabs.map((tab, index) => ({ key: index, label: tab.label }))}
                value={selectedTab}
                onChange={(index) => chooseRecipe(tabs[index].isRaw)}
              />
              <div role="tabpanel">{tabs[selectedTab]?.panel}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rawPanel}
              <p className="text-hud-muted">Standard production only</p>
            </div>
          )}
        </div>

        {failure && <ActionFailureNotice failure={failure} />}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hud-divider pt-3">
          <span className="flex items-center gap-1.5 text-hud-strong">
            {run ? runOutputLine(run, selectedResource) : "—"}
            <ResourceIcon resource={selectedResource} size="xs" withTooltip={false} />
            {bonusPercent > 0 && (
              <span className="text-hud-good">{formatPercent(bonusPercent / 10_000, { signed: true })} bonus</span>
            )}
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

/**
 * A recipe in the chain's units, with the bonus on its output: the simple one burns labor, the complex one resources.
 * Undefined when this game defines none, or one that burns or makes nothing, which the chain refuses.
 */
const recipeOf = (resource: number, simple: boolean, bonusPercent: number): ProductionRecipe | undefined => {
  const recipe = configManager.getRecipeUnits(resource, simple);
  return recipe && recipe.inputs.length > 0 && recipe.outputUnits > 0n
    ? { ...recipe, bonusPercent: BigInt(bonusPercent) }
    : undefined;
};

/**
 * Why the run cannot start, or null when it can: no recipe, no whole cycle (the chain refuses zero cycles, whatever
 * sized the run), or an input short of the run's burn.
 */
const runVerdict = (
  recipe: ProductionRecipe | undefined,
  run: ProductionRun | undefined,
  sizing: RunSizing,
  balances: Record<number, bigint>,
): string | null => {
  if (!recipe || !run) return "This recipe is unknown here";
  if (run.cycles === 0n) return noCycleReason(recipe, sizing);
  return coversRun(run, balances) ? null : "Not enough resources";
};

/**
 * Why a sizing came to no whole cycle: a budget under one cycle's burn, nothing asked for, or holdings under it. The
 * least budget is an amount to type, written as a field shows it ("0.8 Copper"), never rounded as a charge is.
 */
const noCycleReason = (recipe: ProductionRecipe, sizing: RunSizing): string => {
  if (sizing.by === "input")
    return `Spend at least ${formatTypedNumber(fromUnits(oneCycleOf(recipe, sizing.resource)))} ${resourceName(sizing.resource)}`;
  if (sizing.by === "output") return "Enter an amount to make";
  return "Not enough resources";
};

/** The rows a run's panel shows: each input held against its burn, and the budget typed into the one that sizes it. */
const runInputs = (run: ProductionRun, sizing: RunSizing, balances: Record<number, bigint>): RunInput[] =>
  run.inputs.map(({ resource, units }) => ({
    resource,
    held: balances[resource] === undefined ? undefined : fromUnits(balances[resource]),
    burn: fromUnits(units),
    short: balances[resource] === undefined || units > balances[resource],
    budget: sizing.by === "input" && sizing.resource === resource ? sizing.amount : undefined,
  }));

/** What the run makes: "10 Crossbowman T1", the whole cycles' output, which may be more than was typed. */
const runOutputLine = (run: ProductionRun, resource: number) =>
  `${formatCharge(fromUnits(run.outputUnits))} ${resourceName(resource)}`;
