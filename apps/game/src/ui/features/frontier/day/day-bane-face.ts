import { orderMeaning, type IconMeaning } from "@/ui/design-system/icon-meaning";
import { DAY_BANNER_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { aspects, orders, worldBanes, type WorldBaneId } from "@bibliothecadao/types";
import { nativeBaneConstants as bane, type NativeRows } from "@bibliothecadao/eternum/game-client";
import type { BaneDay } from "@bibliothecadao/eternum";
import type { DayHead, DayMembers } from "./day-banner-view";

type Rules = Pick<NativeRows["BaneRules"], "beast_percent" | "stamina_percent" | "production_percent">;
const WORLD_FACES = {
  [bane.BLOOD_MOON]: { icon: "moon", rule: (rules: Rules) => WORDS.beastBane(rules.beast_percent) },
  [bane.MIST_TIDE]: { icon: "waves", rule: (rules: Rules) => WORDS.staminaBane(rules.stamina_percent) },
  [bane.ASH_FALL]: { icon: "flame", rule: (rules: Rules) => WORDS.productionBane(rules.production_percent) },
} satisfies Record<WorldBaneId, { icon: IconMeaning; rule: (rules: Rules) => string }>;

export function worldBaneHead(kind: number, rules: Rules): DayHead {
  const entry = worldBanes.find((entry) => entry.id === kind);
  if (!entry) throw new Error(`Missing world bane ${kind}`);
  const face = WORLD_FACES[entry.id];
  return { tone: "warn", icon: face.icon, eyebrow: WORDS.worldBane, name: entry.name, rule: face.rule(rules) };
}

export function teamBaneHead(source: number): DayHead {
  const aspect = aspects.find((aspect) => aspect.id === source);
  if (!aspect) throw new Error(`Missing source Aspect ${source}`);
  return {
    tone: "bad", icon: "hyperstructure", eyebrow: WORDS.baneFrom(aspect.name), name: WORDS.rivalBane(aspect.name),
    rule: WORDS.heightBlocked,
    crests: orders.filter((order) => order.aspect === aspect.id).map(({ orderId }) => orderMeaning(orderId)),
  };
}

export function baneMembers(bane: BaneDay, timestamp: number): DayMembers {
  return bane.endedAt !== 0 && bane.endedAt <= timestamp
    ? { ended: WORDS.baneEnded, endedShort: WORDS.baneEndedShort }
    : { completed: bane.completed, required: bane.required };
}
