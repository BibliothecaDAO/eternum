import { shipmentTravelSeconds } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds, TileOccupier } from "@bibliothecadao/types";

import { nativeArrivalConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { blitzPreset } from "../../../../../config/source/blitz/native";
import { type LabCommand, type LabFact, type LabScenario, wire } from "./lab-chain";
import { realmScenario } from "./realm-scenario";
import { balancesPaid, besideOnOpenLand } from "./spire-scenario";

const PRECISION = BigInt(RESOURCE_PRECISION);
const HOME = 7n;
const DESTINATION = 8n;

/** Two owned Blitz realms, a knight recipe and donkeys: the production and resource-transfer controls on a real game route. */
export const economyScenario = (): LabScenario => {
  const scenario = realmScenario();
  const { store } = scenario;
  const registry = store.require("GameRegistry", { game_id: 1 });
  const rules = store.require("SliceRules", { game_id: 1 });
  const home = store.require("Structure", { game_id: 1, entity_id: HOME });
  const at = {
    game_id: 1,
    ...besideOnOpenLand(store, scenario.opensOn),
    alt: false,
    entity_id: HOME,
    category: TileOccupier.RealmRegularLevel1,
    is_structure: true,
  };
  const destination = besideOnOpenLand(store, at);
  store.applyFacts([
    row("GameRegistry", store.wireKeyOf("GameRegistry", { game_id: 1 })!, { ...registry, preset_id: blitzPreset.id }),
    row("SliceRules", store.wireKeyOf("SliceRules", { game_id: 1 })!, {
      ...rules,
      day_unit_seconds: 0,
      mode_rules: blitzPreset.modeRules,
      command_mask: blitzPreset.commandMask,
    }),
    row("TileOccupancy", "0xe07", at),
    row("Structure", "0xe08", { ...home, entity_id: DESTINATION, metadata: { ...home.metadata, realm_id: 2 } }),
    row("TileOccupancy", "0xe09", { ...at, ...destination, entity_id: DESTINATION }),
    row("RealmKnowledge", "0xe10", { game_id: 1, structure_id: DESTINATION, learned: 0n }),
    row("StructureBuildings", "0xe11", {
      game_id: 1,
      entity_id: DESTINATION,
      packed_counts_1: 0n,
      packed_counts_2: 0n,
      packed_counts_3: 0n,
      population: {
        current: 0,
        max: store.require("StructureBuildings", { game_id: 1, entity_id: HOME }).population.max,
      },
    }),
    row("ResourceWeight", "0xe0a", { game_id: 1, entity_id: DESTINATION, capacity: 100_000n * PRECISION, weight: 0n }),
    balance(store, HOME, ResourcesIds.Wheat, 1_000n * PRECISION),
    balance(store, HOME, ResourcesIds.Donkey, 100n * PRECISION),
    balance(store, DESTINATION, ResourcesIds.Wheat, 0n),
    row(
      "ProductionRecipe",
      store.wireKeyOf("ProductionRecipe", { game_id: 1, resource_type: ResourcesIds.Knight }) ?? "0xb",
      {
        game_id: 1,
        resource_type: ResourcesIds.Knight,
        simple_output: PRECISION,
        simple_inputs: [{ resource_type: ResourcesIds.Wheat, amount: 2n * PRECISION }],
        complex_output: 10n * PRECISION,
        complex_inputs: [{ resource_type: ResourcesIds.Wheat, amount: 2n * PRECISION }],
      },
    ),
    row(
      "ResourceProduction",
      store.wireKeyOf("ResourceProduction", { game_id: 1, entity_id: HOME, resource_type: ResourcesIds.Knight }) ??
        "0xe0b",
      {
        remainder: 0,

        game_id: 1,
        entity_id: HOME,
        resource_type: ResourcesIds.Knight,
        building_count: 1,
        production_rate: PRECISION,
        output_amount_left: 0n,
        last_settled_at: scenario.startsAt,
      },
    ),
  ] as never);
  return {
    ...scenario,
    opensOn: at,
    answer: (command, chain, now) => {
      if (command.kind === "BurnResourceForResourceProduction") return produce(command, chain, now);
      if (command.kind === "SendResources") return transfer(command, chain, now);
      return scenario.answer(command, chain, now);
    },
  };
};

const row = (model: string, key: string, value: unknown): LabFact => ({ model, key, value: wire(value) });
const balance = (store: NativeFactStore, entity: bigint, resource: number, amount: bigint): LabFact =>
  row(
    "ResourceBalance",
    store.wireKeyOf("ResourceBalance", { game_id: 1, entity_id: entity, resource_type: resource }) ??
      `0xe${entity.toString(16)}${resource.toString(16)}`,
    {
      game_id: 1,
      entity_id: entity,
      resource_type: resource,
      balance: amount,
    },
  );

const produce = (command: LabCommand, chain: NativeFactStore, now: number): LabFact[] => {
  const [, home, resourceCount, resource, amountCount, cycles] = command.calldata.slice(4).map(BigInt);
  if (home !== HOME || resourceCount !== 1n || amountCount !== 1n || resource !== BigInt(ResourcesIds.Knight))
    throw new Error("The economy fixture produces one knight recipe at its home");
  const recipe = chain.require("ProductionRecipe", { game_id: 1, resource_type: Number(resource) });
  const production = chain.require("ResourceProduction", {
    game_id: 1,
    entity_id: home,
    resource_type: Number(resource),
  });
  return [
    ...balancesPaid(
      chain,
      home,
      recipe.complex_inputs.map((input) => ({ resource: input.resource_type, amount: input.amount * cycles })),
    ),
    row("ResourceProduction", "0xe0b", {
      ...production,
      output_amount_left: production.output_amount_left + recipe.complex_output * cycles,
      last_settled_at: now,
    }),
  ];
};

const transfer = (command: LabCommand, chain: NativeFactStore, now: number): LabFact[] => {
  const [, from, to, count, resource, amount] = command.calldata.slice(4).map(BigInt);
  if (from !== HOME || to !== DESTINATION || count !== 1n || resource !== BigInt(ResourcesIds.Wheat))
    throw new Error("The economy fixture sends wheat between its two realms");
  const rules = chain.require("SliceRules", { game_id: 1 });
  const weight = chain.require("ResourceRule", { game_id: 1, resource_type: Number(resource) }).unit_weight * amount;
  const capacity = BigInt(rules.capacity_config.donkey_capacity) * PRECISION;
  const donkeys = ((weight + capacity - 1n) / capacity) * PRECISION;
  const travel = shipmentTravelSeconds(Number(from), Number(to), chain, false);
  if (travel === undefined) throw new Error("The delivery requires both realms on the map");
  const tick = Math.floor((now + travel) / Number(rules.tick_config.delivery_tick_in_seconds));
  const arrival: NativeRows["ResourceArrival"] = {
    game_id: 1,
    entity_id: to,
    day: BigInt(Math.floor(tick / nativeArrivalConstants.SLOTS_PER_DAY)),
    slot: (tick % nativeArrivalConstants.SLOTS_PER_DAY) + 1,
    resources: [{ resource_type: Number(resource), amount }],
  };
  return [
    ...balancesPaid(chain, from, [
      { resource: Number(resource), amount },
      { resource: ResourcesIds.Donkey, amount: donkeys },
    ]),
    row("ResourceArrival", "0xe0c", arrival),
  ];
};
