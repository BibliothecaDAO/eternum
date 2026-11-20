import type { Troops } from "@bibliothecadao/types";
import { Icon } from "@/ui/design-system/icon";

/** A combatant's mark follows its native troop category, including every site's beast. */
export const CombatMark = ({ category }: { category: Troops["category"] }) => {
  const bow = category === "Crossbowman";
  const label = bow ? "Bow" : "Blade";
  return (
    <span data-combat-mark={label} className="inline-flex items-center gap-1 text-hud-label text-hud-muted">
      <Icon name={bow ? "crossbowman-t1" : "attack"} size={20} />
      {label}
    </span>
  );
};
