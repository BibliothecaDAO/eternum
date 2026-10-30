import type { SkillPointChoice, SkillPointRank } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { StructureType } from "@bibliothecadao/types";
import { structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning, IconMark } from "@/ui/design-system/icon";
import { RESEARCH_TREE } from "@/ui/design-system/kit/words";

type SpendKind = SkillPointChoice["kind"];
type ScoutingChoice = Extract<SkillPointChoice, { kind: "Scouting" }>["value"];
export type AttributeKey = Lowercase<Exclude<SpendKind, "Stamina">>;
export type ScoutKind = Lowercase<ScoutingChoice["kind"]>;

/** Presentation and command construction for every permitted point use. */
export const POINT_CHOICES = {
  Battle: { key: "battle", mark: "order-rage", choice: () => ({ kind: "Battle", value: undefined }) },
  Logistics: { key: "logistics", mark: "order-skill", choice: () => ({ kind: "Logistics", value: undefined }) },
  Scouting: { key: "scouting", mark: "order-detection", choice: (kind) => ({ kind: "Scouting", value: kind }) },
  Homecoming: {
    key: "homecoming",
    mark: "order-enlightenment",
    choice: () => ({ kind: "Homecoming", value: undefined }),
  },
  Stamina: { key: "stamina", mark: "stamina", choice: (_kind, rank) => ({ kind: "Stamina", value: rank }) },
} satisfies {
  [K in SpendKind]: {
    key: Lowercase<K>;
    mark: IconMeaning;
    choice: (kind: ScoutingChoice, rank: SkillPointRank) => Extract<SkillPointChoice, { kind: K }>;
  };
};

/** Display order and the contract side code for each lodge choice. */
export const SCOUTING_CHOICES = {
  Rift: { key: "rift", side: research.KIND_RIFTS, icon: structureMeaning(StructureType.Rift, "frontier") },
  Camp: { key: "camp", side: research.KIND_CAMPS, icon: structureMeaning(StructureType.Camp, "frontier") },
  Sanctuaries: { key: "sanctuaries", side: research.KIND_SANCTUARIES, icon: ["shrine", "well"] },
} satisfies { [K in ScoutingChoice["kind"]]: { key: Lowercase<K>; side: number; icon: IconMark } };

export const scoutingChoices = Object.entries(SCOUTING_CHOICES).map(([kind, option]) => ({
  ...option,
  name: RESEARCH_TREE.kinds[option.key],
  choice: { kind: kind as ScoutingChoice["kind"], value: undefined },
}));

export type { ScoutingSide } from "@bibliothecadao/eternum";

export const availableScoutingChoices = (tier: (row: number) => number) =>
  scoutingChoices.filter(
    (option) => option.key !== "sanctuaries" || tier(research.ROW_SHRINE) > 0 || tier(research.ROW_WELL) > 0,
  );

export const pointChoices = Object.entries(POINT_CHOICES).map(([name, option]) => ({ ...option, name }));
