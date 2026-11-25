import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { aspectMeaning, type IconMeaning } from "@/ui/design-system/icon-meaning";
import { DAY_BANNER_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { type BaneDay, DAILY_QUEST_MODELS, readDailyQuest, readExpeditionRules } from "@bibliothecadao/eternum";
import {
  nativeBaneConstants as bane,
  safeInteger,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { aspectName, catalogAspectId, formatClockTime, worldBanes } from "@bibliothecadao/types";

import { dayClock } from "../hud/day-clock";

type WorldBaneKind = (typeof worldBanes)[number]["id"];
type BaneRules = NativeRows["BaneRules"];
export type BaneFigure = keyof typeof WORDS.baneFigures;

export interface BaneFace {
  name: string;
  title: string;
  chip: string;
  effect: string;
  doubles: boolean;
  figure: BaneFigure;
  percent: number | undefined;
  mark: "▾" | "▲";
  icon: IconMeaning;
}

type WorldEffect = Pick<BaneFace, "chip" | "effect" | "figure" | "percent" | "mark">;

const WORLD_BANE_EFFECTS = {
  [bane.BLOOD_MOON]: (rules) => ({
    chip: WORDS.beastChip(rules.beast_percent),
    effect: WORDS.beastBane(rules.beast_percent),
    figure: "guards",
    percent: rules.beast_percent,
    mark: "▲",
  }),
  [bane.MIST_TIDE]: (rules) => ({
    chip: WORDS.staminaChip(rules.stamina_percent),
    effect: WORDS.staminaBane(rules.stamina_percent),
    figure: "stamina",
    percent: rules.stamina_percent,
    mark: "▾",
  }),
  [bane.ASH_FALL]: (rules) => ({
    chip: WORDS.productionChip(rules.production_percent),
    effect: WORDS.productionBane(rules.production_percent),
    figure: "production",
    percent: rules.production_percent,
    mark: "▾",
  }),
} satisfies Record<WorldBaneKind, (rules: BaneRules) => WorldEffect>;

const WORLD_BANE_ICON: IconMeaning = "bane-world";

const isWorldBaneKind = (kind: number): kind is WorldBaneKind => kind in WORLD_BANE_EFFECTS;

export function baneFace(day: BaneDay, store: NativeFactStore, gameId: number): BaneFace {
  if (day.type === "team") {
    const caster = catalogAspectId(day.source);
    return {
      name: aspectName(caster),
      title: WORDS.teamBaneTitle(aspectName(caster)),
      chip: WORDS.heightChip,
      effect: WORDS.heightBane,
      doubles: false,
      figure: "height",
      percent: undefined,
      mark: "▾",
      icon: aspectMeaning(caster),
    };
  }
  const world = worldBanes.find((each) => each.id === day.kind);
  if (!world || !isWorldBaneKind(day.kind)) throw new Error(`Unknown world bane ${day.kind}`);
  const rules = store.require("BaneRules", { game_id: gameId });
  return {
    name: world.name,
    title: WORDS.worldBaneTitle(world.name),
    ...WORLD_BANE_EFFECTS[day.kind](rules),
    doubles: true,
    icon: WORLD_BANE_ICON,
  };
}

export const baneBroken = (day: BaneDay, now: number): boolean => day.endedAt !== 0 && day.endedAt <= now;

type BaneToday = BaneFace & { line: string };

export const useBaneToday = (realm: NativeRows["Structure"] | null): BaneToday | null => {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  const rules = realm && readExpeditionRules(setup.store, realm.game_id);
  if (!realm || !rules) return null;
  const day = readDailyQuest(setup.store, realm.game_id, safeInteger(realm.entity_id), now)?.reading.known?.bane;
  if (!day || baneBroken(day, now)) return null;
  const face = baneFace(day, setup.store, realm.game_id);
  const end = formatClockTime(dayClock(rules, now).endsAt);
  return { ...face, line: WORDS.baneFigureLine(face.name, WORDS.baneFigures[face.figure], face.percent, end) };
};
