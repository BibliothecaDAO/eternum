import { productionOutput, type ResourceManager } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import type { buildNativePreset } from "../../../config/deployer/clean/config/native-preset";
import type { TrackedTransaction } from "./driver";

/**
 * What a Frontier pass at real speed checks against its preset, from the chain's facts: free production at the
 * preset's rates, and exactly the wheat the preset charges for raising troops and for each explore and step. Its
 * multi-day gates (rollovers, token cap) stay with the accelerated design run.
 */
export interface FrontierRuleEvidence {
  rates: Array<{ resource: number; buildingCount: number; chainRate: string; presetRate: string }>;
  charges: Array<{ botId: number; kind: ChargedKind; troops: string; expected: string; charged: string }>;
}

type PresetDefinition = ReturnType<typeof buildNativePreset>;
type ChargedKind = "CreateExplorer" | "Explore" | "Move";
/** An action that takes wheat from its realm: a raise of one troop resource, or an explore or one step of an army. */
export type WheatCharge =
  | { kind: "CreateExplorer"; troopResource: number; troops: bigint }
  | { kind: "Explore" | "Move"; troops: bigint };
/** A realm's wheat as the client projects it: its balance, production row and armies tick. */
export type WheatState = NonNullable<ReturnType<ResourceManager["current"]>>;

const precision = BigInt(RESOURCE_PRECISION);

/**
 * The wheat an action costs its realm under the preset: raising pays the troop's recipe, exploring and travelling pay
 * food per troop (per hex travelled; the harness moves one hex at a time).
 */
export function expectedWheat(definition: PresetDefinition, charge: WheatCharge): bigint {
  if (charge.kind !== "CreateExplorer") {
    const stamina = definition.rules.troop_stamina_config;
    const perTroop = charge.kind === "Explore" ? stamina.stamina_explore_wheat_cost : stamina.stamina_travel_wheat_cost;
    return BigInt(perTroop) * charge.troops;
  }
  const { troopResource } = charge;
  const { recipe } = definition.resources.production.find(({ resource_type }) => resource_type === troopResource)!;
  const wheat = recipe.simple_inputs.find(({ resource_type }) => resource_type === ResourcesIds.Wheat);
  if (!wheat) return 0n;
  // As the contract charges a raise: each input of the recipe for the troops deployed, rounded up.
  const owed = charge.troops * precision * wheat.amount;
  return (owed + recipe.simple_output - 1n) / recipe.simple_output;
}

/**
 * What an action took from the realm's wheat: the balance before, plus what its farms grew up to the block that
 * settled the action, less the balance after. Null when neither its tick nor its balance changed.
 */
export function wheatCharged(before: WheatState, after: WheatState): bigint | null {
  if (after.production.last_settled_tick === before.production.last_settled_tick && after.balance === before.balance)
    return null;
  return (
    before.balance +
    productionOutput(before.production, after.production.last_settled_tick * after.tickSeconds, before.tickSeconds) -
    after.balance
  );
}

/** Each producing row on chain beside the preset's rate for one building of its resource. */
export function presetRates(
  definition: PresetDefinition,
  rows: ReadonlyArray<{ resource_type: number; building_count: number; production_rate: bigint }>,
): FrontierRuleEvidence["rates"] {
  return rows
    .filter((row) => row.building_count > 0)
    .map((row) => ({
      resource: row.resource_type,
      buildingCount: row.building_count,
      chainRate: row.production_rate.toString(),
      presetRate: definition.resources.resources
        .find(({ resource_type }) => resource_type === row.resource_type)!
        .realm_rate.toString(),
    }));
}

export function frontierRuleChecks(
  evidence: FrontierRuleEvidence,
  actions: ReadonlyArray<Pick<TrackedTransaction, "outcome">>,
) {
  const raises = evidence.charges.filter(({ kind }) => kind === "CreateExplorer");
  const food = evidence.charges.filter(({ kind }) => kind !== "CreateExplorer");
  const exact = (charges: FrontierRuleEvidence["charges"]) =>
    charges.length > 0 && charges.every(({ expected, charged }) => expected === charged);
  return {
    frontierPresetRates:
      evidence.rates.length > 0 &&
      evidence.rates.every(
        ({ buildingCount, chainRate, presetRate }) => BigInt(chainRate) === BigInt(buildingCount) * BigInt(presetRate),
      ),
    frontierTroopRaiseCharge: exact(raises),
    frontierFoodCharge: exact(food),
    frontierNoGameplayRejection: actions.every(({ outcome }) => outcome !== "rejected" && outcome !== "reverted"),
  };
}
