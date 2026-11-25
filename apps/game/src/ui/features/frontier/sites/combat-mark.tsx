import type { TroopType } from "@bibliothecadao/types";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";

export interface CombatMarkLook {
  label: "Blade" | "Bow";
  icon: IconMeaning;
}

const BLADE: CombatMarkLook = { label: "Blade", icon: "attack" };
const BOW: CombatMarkLook = { label: "Bow", icon: "crossbowman-t1" };

const COMBAT_MARKS = { Knight: BLADE, Paladin: BLADE, Crossbowman: BOW } satisfies Record<TroopType, CombatMarkLook>;

export const combatMarkOf = (category: TroopType): CombatMarkLook => COMBAT_MARKS[category];

export const CombatMark = ({ category, size = 20 }: { category: TroopType; size?: 14 | 16 | 20 }) => {
  const { label, icon } = combatMarkOf(category);
  return (
    <span data-combat-mark={label} className="inline-flex items-center gap-1 text-hud-label text-hud-muted">
      <Icon name={icon} size={size} />
      {label}
    </span>
  );
};

export const CombatBadge = ({ category }: { category: TroopType }) => {
  const { label, icon } = combatMarkOf(category);
  return (
    <span
      aria-hidden="true"
      data-tip={label}
      data-combat-mark={label}
      className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-hud-line-strong bg-hud-dark"
    >
      <Icon name={icon} size={14} />
    </span>
  );
};
