import { buildingIds, frontierPreset } from "./frontier/native";
import { frontierDevconPreset } from "./frontier/devcon";
import { blitzPreset } from "./blitz/native";
import { eternumPreset } from "./eternum/native";
import { duelPreset } from "./duel/native";
import type { NativePreset } from "./common/native-preset";
import {
  FRONTIER_ACCELERATED_PRESET_ID,
  FRONTIER_FIXTURE_PRESET_ID,
  FRONTIER_PLAYGROUND_PRESET_ID,
  nativeGameModeOf,
} from "./common/native-preset-modes";
import { ResourcesIds } from "../../packages/types/src/constants";
import type { GameType } from "./common/types";

const modes: Record<GameType, NativePreset> = {
  frontier: frontierPreset,
  blitz: blitzPreset,
  eternum: eternumPreset,
  duel: duelPreset,
};
/**
 * Frontier 120 times faster, for automated tests only: a 1 s armies tick and a 120 s day unit, so its drawn days last 4
 * to 12 minutes, a bag 40 minutes and its season of 21 bags 14 hours. Presets are immutable, so it has its own id.
 */
const frontierAcceleratedPreset: NativePreset = {
  ...frontierPreset,
  id: FRONTIER_ACCELERATED_PRESET_ID,
  clockScale: { days: 120, activity: 120 },
};

const frontierFixturePreset: NativePreset = {
  ...frontierPreset,
  id: FRONTIER_FIXTURE_PRESET_ID,
};

/** Labor, wheat and troops a Settlement's castle stores: two full deploys of its level. A grant above it is lost. */
const SETTLEMENT_STORE = 6_000;
/** Essence weighs nothing and has no store: enough for every research tier, Ethereal I to III included (~4.1M). */
const PLAYGROUND_ESSENCE = 5_000_000;

/**
 * Frontier's playground, for dev only (owner, 10-26: "I get a fully upgrade realm with all rss and all spires upgrade
 * unlock, I wanna test how it looks and feels"): Frontier's rules and clocks, with a realm that starts with Essence for
 * every research tier and full stores, and levels, researches and builds for a token of labor. Everything a player
 * does there is played through the real game; only prices and the starting stock differ.
 */
const frontierPlaygroundPreset: NativePreset = {
  ...frontierPreset,
  id: FRONTIER_PLAYGROUND_PRESET_ID,
  research: frontierPreset.research.map((tier) => ({ ...tier, laborCost: 0 })),
  balance: {
    startingResources: [
      { resource: ResourcesIds.Essence, amount: PLAYGROUND_ESSENCE },
      { resource: ResourcesIds.Labor, amount: SETTLEMENT_STORE },
      { resource: ResourcesIds.Wheat, amount: SETTLEMENT_STORE },
      { resource: ResourcesIds.Knight, amount: SETTLEMENT_STORE },
    ],
    realmUpgradeCosts: Object.fromEntries(
      [1, 2, 3].map((level) => [level, [{ resource: ResourcesIds.Labor, amount: 100 }]]),
    ),
    buildings: { simpleBuildingCost: Object.fromEntries(buildingIds.map((id) => [id, []])) },
  },
};

export const nativePresets: Record<number, NativePreset> = Object.fromEntries(
  [
    ...Object.values(modes),
    frontierDevconPreset,
    frontierAcceleratedPreset,
    frontierFixturePreset,
    frontierPlaygroundPreset,
  ].map((preset) => {
    if (nativeGameModeOf(preset.id) !== preset.gameType)
      throw new Error(`Native preset ${preset.id} plays ${preset.gameType}, not ${nativeGameModeOf(preset.id)}`);
    return [preset.id, preset];
  }),
);

export function nativePresetForId(id: number): NativePreset {
  const preset = nativePresets[id];
  if (!preset) throw new Error(`Unsupported native preset ${id}`);
  return preset;
}
export function nativePresetIdFor(gameType: GameType): number {
  const preset = modes[gameType];
  if (!preset) throw new Error("No native preset for " + gameType);
  return preset.id;
}
