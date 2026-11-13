import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders, useActNowRefusal } from "@/utils/can-issue-orders";
import { ActionFailureNotice } from "@/ui/features/event-feed/action-failure-notice";
import { type ActionFailure, actionFailure } from "@/ui/features/event-feed/notify";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { AmountInput, HudButton, HudNotice, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules";
import { isVillageLikeStructureCategory } from "@/ui/lib/structure-capabilities";
import { configManager, getBuildingQuantity } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import {
  getBuildingFromResource,
  RealmInfo,
  formatWait,
  resourceName,
  formatPercent,
  formatCharge,
  formatTypedNumber,
} from "@bibliothecadao/types";
import { useState } from "react";
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
  sizing,
  setSizing,
  realm,
  bonusPercent,
  compact = false,
}: {
  selectedResource: number;
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
      systemCalls: { burn_resource_for_resource_production },
    },
  } = useGame();

  const [isLoading, setIsLoading] = useState(false);
  // Why the last start did not happen: told until the next one.
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const ordersAllowed = useUIStore(canIssueOrders);
  const refusal = useActNowRefusal();
  const currentDefaultTick = useCurrentDefaultTick();

  const recipe = recipeOf(selectedResource, bonusPercent);

  const resourceManager = useResourceManager(realm.entityId);
  // Each input's balance in resource units, as the chain spends it; an unknown one is left out, so it covers nothing.
  const balances: Record<number, bigint> = {};
  (recipe?.inputs ?? []).forEach(({ resource }) => {
    const balance = resourceManager.balanceWithProduction(currentDefaultTick, resource)?.balance;
    if (balance !== undefined) balances[resource] = BigInt(Math.floor(balance));
  });

  const run = recipe && planProductionRun(recipe, sizing, balances);
  const verdict = runVerdict(recipe, run, sizing, balances);
  const isDisabled = verdict !== null;

  const produce = async () => {
    if (!run || isDisabled || !canIssueOrders() || isLoading) return;
    setFailure(null);
    setIsLoading(true);
    try {
      await burn_resource_for_resource_production({
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

  if (!recipe) return null;

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
  const standardCycles = run ? Number(run.outputUnits) / Number(recipe.outputUnits) : 0;
  const timeRequired = standardCycles
    ? formatWait(
        Math.floor((standardCycles / buildingCount) * (isVillageLikeStructureCategory(realm.category) ? 2 : 1)),
      )
    : "0s";
  const inputsPanel = (
    <RunInputsPanel
      title="Resources required"
      inputs={runInputs(planProductionRun(recipe, sizing, balances), sizing, balances)}
      onBudget={(resource, amount) => setSizing({ by: "input", resource, amount })}
      onMax={() => setSizing({ by: "max" })}
      onSelect={() => {}}
    />
  );

  return (
    <HudPanel kind="section" title={`Start production · ${resourceName(selectedResource)}`} collapsible={false}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ResourceIcon resource={selectedResource} size="md" />
              {amountField}
            </div>
          </div>
          <div className="flex flex-col gap-2">{inputsPanel}</div>
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
 * The recipe that burns resources, in the chain's units, with the bonus on its output. Undefined when this game defines
 * none, or one that burns or makes nothing, which the chain refuses.
 */
const recipeOf = (resource: number, bonusPercent: number): ProductionRecipe | undefined => {
  const recipe = configManager.getRecipeUnits(resource, false);
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
