import type { Troops } from "@bibliothecadao/types";
import { Icon } from "@/ui/design-system/icon";

export const CombatMark = ({ category, size = 20 }: { category: Troops["category"]; size?: 14 | 16 | 20 }) => {
  const bow = category === "Crossbowman";
  const label = bow ? "Bow" : "Blade";
  return (
    <span data-combat-mark={label} className="inline-flex items-center gap-1 text-hud-label text-hud-muted">
      <Icon name={bow ? "crossbowman-t1" : "attack"} size={size} />
      {label}
    </span>
  );
};
