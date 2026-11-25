import { DAY_BANNER_WORDS as WORDS } from "@/ui/design-system/kit/words";
import type { BaneDay } from "@bibliothecadao/eternum";
import {
  nativeBaneConstants as bane,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { aspectName, worldBanes } from "@bibliothecadao/types";

type WorldBaneKind = (typeof worldBanes)[number]["id"];
type BaneRules = NativeRows["BaneRules"];

export interface BaneFace {
  name: string;
  title: string;
  chip: string;
  effect: string;
  doubles: boolean;
}

const WORLD_BANE_EFFECTS = {
  [bane.BLOOD_MOON]: (rules) => ({
    chip: WORDS.beastChip(rules.beast_percent),
    effect: WORDS.beastBane(rules.beast_percent),
  }),
  [bane.MIST_TIDE]: (rules) => ({
    chip: WORDS.staminaChip(rules.stamina_percent),
    effect: WORDS.staminaBane(rules.stamina_percent),
  }),
  [bane.ASH_FALL]: (rules) => ({
    chip: WORDS.productionChip(rules.production_percent),
    effect: WORDS.productionBane(rules.production_percent),
  }),
} satisfies Record<WorldBaneKind, (rules: BaneRules) => { chip: string; effect: string }>;

const isWorldBaneKind = (kind: number): kind is WorldBaneKind => kind in WORLD_BANE_EFFECTS;

export function baneFace(day: BaneDay, store: NativeFactStore, gameId: number): BaneFace {
  if (day.type === "team")
    return {
      name: aspectName(day.source),
      title: WORDS.teamBaneTitle(aspectName(day.source)),
      chip: WORDS.heightChip,
      effect: WORDS.heightBane,
      doubles: false,
    };
  const world = worldBanes.find((each) => each.id === day.kind);
  if (!world || !isWorldBaneKind(day.kind)) throw new Error(`Unknown world bane ${day.kind}`);
  const rules = store.require("BaneRules", { game_id: gameId });
  return { name: world.name, title: WORDS.worldBaneTitle(world.name), ...WORLD_BANE_EFFECTS[day.kind](rules), doubles: true };
}

export const baneBroken = (day: BaneDay, now: number): boolean => day.endedAt !== 0 && day.endedAt <= now;
