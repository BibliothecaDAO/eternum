import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { TroopTier, TroopType, formatPercent } from "@bibliothecadao/types";

/** A modifier's bonus or malus as a signed percent ("+10%", "-5%"), or the word for none. */
export const biomeBonusText = (bonus: number, none = "No Bonus"): string =>
  Math.round((bonus - 1) * 100) === 0 ? none : formatPercent(bonus - 1, { signed: true });

const ModifierChip = ({ modifier, none }: { modifier: number; none: string }) => {
  const text = biomeBonusText(modifier, none);
  if (text === none) return text;
  return <span className={`${modifier < 1 ? "text-hud-bad" : "text-hud-good"} text-hud-strong`}>{text}</span>;
};

const formatStaminaModifier = (modifier: number, isAttacker: boolean) => (
  <ModifierChip modifier={modifier} none={isAttacker ? "No Bonus" : "No Penalty"} />
);

export const formatBiomeBonus = (bonus: number) => <ModifierChip modifier={bonus} none="No Bonus" />;

// Compact version of formatTypeAndBonuses for tight layouts (multi-guard view)
const formatTypeAndBonusesCompact = (
  category: TroopType,
  tier: TroopTier,
  biomeBonus: number,
  staminaModifier: number,
  isAttacker: boolean,
) => {
  return (
    <div className="text-hud-body text-hud-accent">
      <div className="flex items-center justify-between mb-1">
        <span className="text-hud-strong text-hud-accent">
          {TroopType[category]} {tier}
        </span>
      </div>
      <div className="flex justify-between items-center text-hud-label gap-1">
        <div className="flex items-center gap-1 bg-hud-hover px-1.5 py-0.5 rounded">
          <SemanticIcon name="map" className="w-3 h-3 text-hud-accent" />
          <span>{formatBiomeBonus(biomeBonus)}</span>
        </div>
        <div className="flex items-center gap-1 bg-hud-hover px-1.5 py-0.5 rounded">
          <SemanticIcon name="stamina" className="w-3 h-3 text-hud-accent" />
          <span>{formatStaminaModifier(staminaModifier, isAttacker)}</span>
        </div>
      </div>
    </div>
  );
};

export const formatTypeAndBonuses = (
  category: TroopType,
  tier: TroopTier,
  biomeBonus: number,
  staminaModifier: number,
  isAttacker: boolean,
  isCompact = false,
) => {
  // Use compact version for cramped layouts
  if (isCompact) {
    return formatTypeAndBonusesCompact(category, tier, biomeBonus, staminaModifier, isAttacker);
  }

  // Original version for normal layouts
  return (
    <div className="text-hud-body text-hud-accent mb-2">
      <h4 className="flex items-center mb-2">
        <span className="text-hud-strong text-hud-accent">
          {TroopType[category]} {tier}
        </span>
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center p-2.5 bg-hud-hover rounded-md hover:bg-hud-chosen transition-colors shadow-sm">
          <div className="w-6 h-6 mr-2 flex items-center justify-center text-hud-accent">
            <SemanticIcon name="map" className="w-5 h-5" />
          </div>
          <div>
            <div className="text-hud-label text-hud-muted uppercase">Terrain Bonus</div>
            <div className="text-hud-title">{formatBiomeBonus(biomeBonus)}</div>
          </div>
        </div>

        <div className="flex items-center p-2.5 bg-hud-hover rounded-md hover:bg-hud-chosen transition-colors shadow-sm">
          <div className="w-6 h-6 mr-2 flex items-center justify-center text-hud-accent">
            <SemanticIcon name="stamina" className="w-5 h-5" />
          </div>
          <div>
            <div className="text-hud-label text-hud-muted uppercase">Stamina {isAttacker ? "Bonus" : "Penalty"}</div>
            <div className="text-hud-title">{formatStaminaModifier(staminaModifier, isAttacker)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
