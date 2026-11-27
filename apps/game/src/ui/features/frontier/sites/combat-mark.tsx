import type { TroopType } from "@bibliothecadao/types";
import { type CombatMark, troopMark } from "@bibliothecadao/eternum";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { BEAST_MARK_TIPS, COMBAT_MARK_WORDS } from "@/ui/design-system/kit/words";

export interface CombatMarkLook {
  label: (typeof COMBAT_MARK_WORDS)[keyof typeof COMBAT_MARK_WORDS];
  icon: IconMeaning;
}

const MARK_LOOKS = {
  blade: { label: COMBAT_MARK_WORDS.blade, icon: "combat-blade" },
  bow: { label: COMBAT_MARK_WORDS.bow, icon: "combat-bow" },
} satisfies Record<CombatMark, CombatMarkLook>;

export const combatMarkOf = (category: TroopType): CombatMarkLook => MARK_LOOKS[troopMark(category)];

export const CombatMarkBadge = ({ category, tip }: { category: TroopType; tip?: string }) => {
  const { label, icon } = combatMarkOf(category);
  return (
    <span
      aria-hidden="true"
      data-tip={tip}
      data-combat-mark={label}
      className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-hud-line-strong bg-hud-dark"
    >
      <Icon name={icon} size={14} />
    </span>
  );
};

export const BeastMarkBadge = ({ category }: { category: TroopType }) => (
  <CombatMarkBadge category={category} tip={BEAST_MARK_TIPS[troopMark(category)]} />
);
