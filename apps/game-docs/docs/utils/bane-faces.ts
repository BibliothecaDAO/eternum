import type { IconMeaning } from "../../../game/src/ui/design-system/icon-meaning";
import { ASPECT_PAGE_WORDS, DAY_BANNER_WORDS as WORDS } from "../../../game/src/ui/design-system/kit/words";
import { worldBanes } from "@bibliothecadao/types";
import { nativeBaneConstants as bane, type NativeRows } from "@bibliothecadao/eternum/game-client";

interface DayHead {
  icon: IconMeaning;
  name: string;
  rule: string;
}

type Rules = Pick<NativeRows["BaneRules"], "beast_percent" | "stamina_percent" | "production_percent">;
const WORLD_FACES = {
  [bane.BLOOD_MOON]: { icon: "moon", rule: (rules: Rules) => WORDS.beastBane(rules.beast_percent) },
  [bane.MIST_TIDE]: { icon: "waves", rule: (rules: Rules) => WORDS.staminaBane(rules.stamina_percent) },
  [bane.ASH_FALL]: { icon: "flame", rule: (rules: Rules) => WORDS.productionBane(rules.production_percent) },
} satisfies Record<(typeof worldBanes)[number]["id"], { icon: IconMeaning; rule: (rules: Rules) => string }>;

export function worldBaneHead(kind: number, rules: Rules): DayHead {
  const entry = worldBanes.find((entry) => entry.id === kind);
  if (!entry) throw new Error(`Missing world bane ${kind}`);
  const face = WORLD_FACES[entry.id];
  return { icon: face.icon, name: entry.name, rule: face.rule(rules) };
}

export function triumphHead(stage: keyof typeof WORDS.triumphRule, percent: number): DayHead {
  return { icon: "star", name: ASPECT_PAGE_WORDS.triumph[stage], rule: WORDS.triumphRule[stage](percent) };
}
