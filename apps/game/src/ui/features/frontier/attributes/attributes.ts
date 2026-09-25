import { Eye, Flag, Footprints, Swords } from "@/ui/design-system/atoms/game-icons";

/**
 * An army's attributes as the agreed facts carry them (backend shapes v5). ArmyProgress is the one current fact for
 * levels and the pending offer; the attributes train's generated rows replace these types when it lands.
 */
export type Attribute = "Battle" | "Logistics" | "Scouting" | "Support";

export const ATTRIBUTES: readonly Attribute[] = ["Battle", "Logistics", "Scouting", "Support"];

export const MAX_ATTRIBUTE_LEVEL = 5;

export interface AttributeOfferFacts {
  id: number;
  source: "Level" | "Relic" | "Shrine";
  amount: number;
  choices: readonly Attribute[];
}

export interface ArmyProgressFacts {
  explorer_id: number;
  level: number;
  xp: number;
  battle: number;
  logistics: number;
  scouting: number;
  support: number;
  pending: AttributeOfferFacts | null;
}

/** The army's level in one attribute. */
export const attributeLevel = (progress: ArmyProgressFacts, attribute: Attribute): number =>
  ({
    Battle: progress.battle,
    Logistics: progress.logistics,
    Scouting: progress.scouting,
    Support: progress.support,
  })[attribute];

/** Where a chosen attribute's card lands: the army's attribute badge. */
export const attributeBadgeTarget = (explorerId: number): string => `attributes-${explorerId}`;

/** Each attribute's icon and its effect in one line (design §3.4). */
export const ATTRIBUTE_LOOK: Record<Attribute, { icon: typeof Swords; effect: string }> = {
  Battle: { icon: Swords, effect: "+10% damage dealt a level" },
  Logistics: { icon: Footprints, effect: "+30 max stamina a level" },
  Scouting: { icon: Eye, effect: "+1.5 points on camp and rift odds a level" },
  Support: { icon: Flag, effect: "+10% realm production a level, until midnight" },
};
