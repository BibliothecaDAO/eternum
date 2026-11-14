import {
  entityHomeNamespace,
  researchChoice,
  researchTier,
  seasonDay,
  expeditionRealmSite,
  getTroopResourceId,
  readExpeditionRules,
  readTroopRaiseCost,
} from "@bibliothecadao/eternum";
import {
  BiomeType,
  BUILDINGS_CENTER,
  getNeighborOffsets,
  RESOURCE_PRECISION,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";

import { musterStamina, openArmySlots } from "@bibliothecadao/eternum/troop-stamina";
import { nativeResearchConstants as research, type NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { standTheArmyAtTheEdge } from "./explore-scenario";
import { wire, type LabCommand, type LabFact, type LabScenario } from "./lab-chain";
import { realmScenario } from "./realm-scenario";
import { armySpent, balancesPaid, revealedTile } from "./spire-scenario";

type Hex = { col: number; row: number };
type Answer = (command: LabCommand, chain: NativeFactStore, now: number) => LabFact[];

/**
 * The game the click-latency steps play (/lab/game?scenario=actions): realm 7 a full Settlement with the labor to be
 * raised, its army at the edge of the land it has seen. The chain answers each command a player's click sends as the
 * contract writes its facts: Move and Explore (movement.cairo: the army on its last tile, its stamina paid, an explored
 * tile revealed), CreateBuilding (construction.cairo: the building on its plot), CreateExplorer (troops.cairo: a new
 * army beside the realm's site, its troops and their raise paid), LevelUp and EnterDepth as the realm and spire games
 * do.
 */
export const actionsScenario = (): LabScenario => {
  const realm = realmScenario();
  standTheArmyAtTheEdge(realm.store);
  const answers: Record<string, Answer> = {
    Move: moveArmy,
    Explore: exploreTile,
    CreateBuilding: placeBuilding,
    CreateExplorer: deployArmy,
  };
  return {
    ...realm,
    answer: (command, chain, now) => (answers[command.kind] ?? realm.answer)(command, chain, now),
  };
};

/** A command's span after its variant, as felts: fields and spans in ABI order. */
const spanOf = (command: LabCommand): bigint[] => command.calldata.slice(5).map((felt) => BigInt(felt));

/** Where `directions` lead from `from`, one neighbour per step. */
const walk = (from: Hex, directions: number[]): Hex =>
  directions.reduce((hex, direction) => {
    const offset = getNeighborOffsets(hex.row)[direction];
    return { col: hex.col + offset.i, row: hex.row + offset.j };
  }, from);

/** The army's occupancy moved to `to`: its old row gone, the same row on its new tile. */
const occupancyMoved = (chain: NativeFactStore, explorerId: bigint, to: Hex): LabFact[] => {
  const [key, occupancy] = [...chain.entries("TileOccupancy")].find(([, row]) => row.entity_id === explorerId)!;
  return [
    { model: "TileOccupancy", key, value: null },
    { model: "TileOccupancy", key: `0x1ad${to.col}${to.row}`, value: wire({ ...occupancy, ...to }) },
  ];
};

const staminaRules = (chain: NativeFactStore) => chain.require("SliceRules", { game_id: 1 }).troop_stamina_config;

/** Move: the army walks its path and pays travel stamina for each step. */
const moveArmy: Answer = (command, chain, now) => {
  const [explorerId, length, ...directions] = spanOf(command);
  const steps = directions.slice(0, Number(length)).map(Number);
  const from = chain.entityOccupancy(1, Number(explorerId))!;
  return [
    ...occupancyMoved(chain, explorerId, walk(from, steps)),
    armySpent(chain, explorerId, staminaRules(chain).stamina_travel_stamina_cost * steps.length, now),
  ];
};

/** Explore: the tile beyond the army revealed, the army on it, explore stamina paid. */
const exploreTile: Answer = (command, chain, now) => {
  const explorerId = BigInt(command.fields.explorer_id);
  const from = chain.entityOccupancy(1, Number(explorerId))!;
  const to = walk(from, [Number(command.fields.direction)]);
  return [
    revealedTile(`0x1ae${to.col}${to.row}`, to, BiomeType.Grassland),
    ...occupancyMoved(chain, explorerId, to),
    armySpent(chain, explorerId, staminaRules(chain).stamina_explore_stamina_cost, now),
  ];
};

/** CreateBuilding: the building on the plot its path leads to from the castle. */
const placeBuilding: Answer = (command) => {
  const [structureId, length, ...rest] = spanOf(command);
  const directions = rest.slice(0, Number(length)).map(Number);
  const category = Number(rest[Number(length)]);
  const plot = walk({ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] }, directions);
  return [
    {
      model: "Building",
      key: `0x1af${plot.col}${plot.row}`,
      value: {
        game_id: 1,
        structure_id: structureId.toString(),
        inner_col: plot.col,
        inner_row: plot.row,
        category,
        paused: false,
        labor_paid: "0",
      },
    },
  ];
};

/**
 * CreateExplorer: a new army of the realm's, its stamina full, on the tile beside the realm's site the command names;
 * the troops leave home and their raise (the wheat) is paid. The lab's realm deploys the same troops as its first army,
 * so the new army stands as that one's kind does.
 */
const deployArmy: Answer = (command, chain, now) => {
  const structureId = BigInt(command.fields.structure_id);
  const category = Object.keys(TroopType)[Number(command.fields.category)] as TroopType;
  const tier = Object.keys(TroopTier)[Number(command.fields.tier)] as TroopTier;
  const amount = BigInt(command.fields.amount);
  const [, first] = [...chain.entries("ExplorerTroops")].find(([, row]) => row.owner === structureId)!;
  if (first.troops.category !== category || first.troops.tier !== tier)
    throw new Error(`The lab deploys ${first.troops.category} ${first.troops.tier} only, not ${category} ${tier}`);
  const [, firstAt] = [...chain.entries("TileOccupancy")].find(([, row]) => row.entity_id === first.explorer_id)!;
  const explorerId =
    1n +
    [...chain.entries("ExplorerTroops")].reduce(
      (most, [, row]) => (row.explorer_id > most ? row.explorer_id : most),
      0n,
    );
  const site = expeditionRealmSite(readExpeditionRules(chain, 1)!, entityHomeNamespace(structureId), now)!;
  const to = walk(site, [Number(command.fields.direction)]);
  const troops = getTroopResourceId(category, tier);
  const whole = Number(amount / BigInt(RESOURCE_PRECISION));
  const raise = readTroopRaiseCost(chain, 1, Number(structureId), troops, whole, now);
  if (!raise) throw new Error(`The lab's realm ${structureId} holds an unknown balance its raise needs`);
  const realm = chain.require("Structure", { game_id: 1, entity_id: structureId });
  const slot = openArmySlots(chain, {
    game_id: 1,
    entity_id: structureId,
    allowedSlots: realm.base.troop_max_explorer_count,
  })?.find((slot) => slot.slot === Number(command.fields.slot));
  if (!slot) throw new Error("The lab deployment requires an open army slot");
  const progress = deploymentProgress(chain, structureId, explorerId);
  const rules = chain.require("SliceRules", { game_id: 1 });
  const maximum = musterStamina(
    { ...slot, inherited: null }, { category, tier }, now, rules.troop_stamina_config,
    progress.logistics, rules.tick_config.armies_tick_in_seconds,
  ).max;
  const stamina = slot.inherited
    ? { ...slot.inherited, amount: BigInt(Math.min(Number(slot.inherited.amount), maximum)) }
    : { amount: BigInt(maximum), settled_at: BigInt(now), remainder: 0 };
  const day = seasonDay(readExpeditionRules(chain, 1)!, now)!;
  return [
    { model: "ArmyProgress", key: `0xaf${explorerId}`, value: wire(progress) },
    {
      model: "ArmySlot",
      key: chain.wireKeyOf("ArmySlot", { game_id: 1, structure_id: structureId, epoch: BigInt(day), slot: slot.slot }) ?? `0xae${explorerId}`,
      value: wire({ game_id: 1, structure_id: structureId, epoch: day, slot: slot.slot, explorer_id: explorerId, stamina }),
    },
    {
      model: "ArmyDay",
      key: `0xad${explorerId}`,
      value: wire({ game_id: 1, explorer_id: explorerId, day }),
    },
    {
      model: "ExplorerTroops",
      key: `0x1b0${explorerId}`,
      value: wire({
        ...first,
        explorer_id: explorerId,
        troops: {
          ...first.troops,
          count: amount,
          stamina: { Slot: slot.slot },
        },
      }),
    },
    { model: "TileOccupancy", key: `0x1b1${explorerId}`, value: wire({ ...firstAt, ...to, entity_id: explorerId }) },
    ...balancesPaid(chain, structureId, [{ resource: troops, amount }, ...raise]),
  ];
};

/** A new army starts with its realm's training and no earned XP or unspent points. */
const deploymentProgress = (chain: NativeFactStore, home: bigint, explorerId: bigint) => {
  const { learned } = chain.require("RealmKnowledge", { game_id: 1, structure_id: home });
  const scouting = researchTier(learned, research.ROW_SCOUTS_LODGE);
  let scoutingKinds = 0;
  for (let rank = 1; rank <= scouting; rank += 1)
    scoutingKinds += (researchChoice(learned, research.ROW_SCOUTS_LODGE, rank) + 1) * 4 ** (rank - 1);
  return {
    game_id: 1,
    explorer_id: explorerId,
    xp: 0,
    common_points: 0,
    uncommon_points: 0,
    rare_points: 0,
    epic_points: 0,
    legendary_points: 0,
    battle: researchTier(learned, research.ROW_WAR_HALL),
    logistics: researchTier(learned, research.ROW_SUPPLY_YARD),
    homecoming: researchTier(learned, research.ROW_HEARTH),
    scouting,
    scouting_kinds: scoutingKinds,
  };
};
