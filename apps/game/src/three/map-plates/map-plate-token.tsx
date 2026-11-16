import { formatExact, formatPercent } from "@bibliothecadao/types";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudStamina, HudTierChip, type StaminaBar } from "@/ui/design-system/kit/hud-elements";
import { UNDEFENDED } from "@/ui/design-system/kit/words";

import { chipWidth, labelWidth } from "./map-plate-layout";
import { type MapPlate, type PlateTroops, type PlateWatched } from "./map-plate-model";

/**
 * What a token says: whose, what kind, how strong (tier and count, or undefended), an army's stamina. Never what a site
 * holds (the owner, 2026-10-20: "dont display the rift essence and the camp labor"): its opened plate tells it.
 */
interface TokenReading {
  icon: IconMeaning;
  /**
   * The strongest tier and the whole count: an army's troops, a structure's guard; none for an undefended one. A beast's
   * guard has no tier to tell: its species (the disk's portrait, `beast` in words) stands for its strength.
   */
  strength: { tier: PlateTroops["tier"] | null; count: number } | null;
  /** A Frontier beast guarding the site, by its species' name. */
  beast: string | null;
  /** A structure with guard slots and none filled; a Frontier realm, with no guard to tell, is not undefended. */
  undefended: boolean;
  /** An army's stamina. */
  stamina: StaminaBar | null;
  /** To a watching viewer, its player's initial on the disk, in their seat's colour. */
  mark: PlateWatched["mark"];
}

export const tokenReading = (plate: MapPlate): TokenReading => {
  if (plate.kind === "army")
    return {
      icon: `${plate.troops.type}-t${plate.troops.tier}` as IconMeaning,
      strength: { tier: plate.troops.tier, count: plate.troops.count },
      beast: null,
      undefended: false,
      stamina: plate.stamina ?? null,
      mark: plate.watched?.mark ?? null,
    };
  const guards = plate.guards ?? [];
  return {
    icon: plate.icon,
    strength:
      guards.length === 0
        ? null
        : {
            tier: guards.some((slot) => slot.beast)
              ? null
              : (guards.reduce<number>((top, slot) => Math.max(top, slot.tier), 1) as PlateTroops["tier"]),
            count: guards.reduce((sum, slot) => sum + slot.count, 0),
          },
    beast: plate.beast ?? null,
    undefended: plate.guards !== null && guards.length === 0,
    stamina: null,
    mark: plate.watched?.mark ?? null,
  };
};

/** The token's sizes (map-plates.css .mp-token__*): its disk, the strip's row and its overlap of the disk, the
 * stamina bar, the gap between readings, the strip's padding and frame. */
const TOKEN = { disk: 30, row: 18, overlap: 2, stamina: 4, gap: 3, frame: 2 * 4 + 2 };

/** A token's box, as map-plates.css draws it. */
export const tokenSize = (plate: MapPlate): { width: number; height: number } => {
  const reading = tokenReading(plate);
  if (!reading.strength) return { width: TOKEN.disk, height: TOKEN.disk };
  const chip = reading.strength.tier === null ? 0 : chipWidth(reading.strength.tier) + TOKEN.gap;
  const width = TOKEN.frame + chip + labelWidth(formatExact(reading.strength.count), true);
  return {
    width: Math.max(TOKEN.disk, Math.ceil(width)),
    height: TOKEN.disk - TOKEN.overlap + TOKEN.row + (reading.stamina === null ? 0 : TOKEN.stamina),
  };
};

/**
 * A thing's token, its plate closed (the owner's 2026-10-19 pick: "icons everywhere, full plate on hover"; at 13:00Z,
 * "3 rings is too much. Tokens are actually way better."): the pin, its kind's painting (an army's troop painting) in a
 * disk ringed in its side's colour, and under it what the plate's second row says, in brief: the tier chip and count (an
 * army's troops, a structure's guard; a camp's or rift's guard alone), an army's stamina as a tight bar; an
 * undefended structure's ring dashed, with nothing under it. A beast's guard shows its species' portrait and its count,
 * never a tier.
 */
export const Token = ({ plate }: { plate: MapPlate }) => <TokenView reading={tokenReading(plate)} />;

const TokenView = ({ reading }: { reading: TokenReading }) => (
  <div className="mp-token" role="img" aria-label={tokenWords(reading)}>
    <span className="mp-token__disk" data-undefended={reading.undefended}>
      <Icon name={reading.icon} size={20} />
      {reading.mark && (
        <span className="ui-seat mp-token__seat" data-ink={reading.mark.ink} aria-hidden>
          {reading.mark.letter}
        </span>
      )}
    </span>
    {reading.strength && (
      <span className="mp-token__strip">
        {reading.strength.tier !== null && <HudTierChip tier={reading.strength.tier} />}
        <span className="mp-count">{formatExact(reading.strength.count)}</span>
      </span>
    )}
    {reading.stamina !== null && (
      <span className="mp-plate__stamina mp-token__stamina">
        <HudStamina stamina={reading.stamina} />
      </span>
    )}
  </div>
);

/** A mark in words, for whoever reads the map without seeing it: its strength and stamina. */
const tokenWords = (reading: TokenReading): string =>
  [
    reading.undefended
      ? UNDEFENDED
      : reading.strength &&
        `${reading.strength.tier === null ? reading.beast : `T${reading.strength.tier}`} ${formatExact(reading.strength.count)}`,
    reading.stamina !== null && `Stamina ${formatPercent(reading.stamina.current / reading.stamina.max)}`,
  ]
    .filter(Boolean)
    .join(", ");
