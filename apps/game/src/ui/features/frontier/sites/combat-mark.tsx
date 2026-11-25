import type { Troops } from "@bibliothecadao/types";
import { Icon } from "@/ui/design-system/icon";

const combatClass = (category: Troops["category"]) =>
  category === "Crossbowman" ? ({ label: "Bow", icon: "crossbowman-t1" } as const) : ({ label: "Blade", icon: "attack" } as const);

export const CombatMark = ({ category, size = 20 }: { category: Troops["category"]; size?: 14 | 16 | 20 }) => {
  const { label, icon } = combatClass(category);
  return (
    <span data-combat-mark={label} className="inline-flex items-center gap-1 text-hud-label text-hud-muted">
      <Icon name={icon} size={size} />
      {label}
    </span>
  );
};

export const CombatBadge = ({ category }: { category: Troops["category"] }) => {
  const { label, icon } = combatClass(category);
  return (
    <span
      role="img"
      aria-label={label}
      data-tip={label}
      data-combat-mark={label}
      className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-hud-line-strong bg-hud-dark"
    >
      <Icon name={icon} size={14} />
    </span>
  );
};
