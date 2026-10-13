/**
 * An army's stamina bar, wherever it is drawn (its dock card, its map plate): five segments of the army's own maximum,
 * so a full bar reads full whatever its Logistics.
 */
export const STAMINA_SEGMENTS = 5;

/** How much of the bar is filled, from 0 to 1; undefined while the army's stamina is unknown. */
export const staminaFill = (stamina: { current: number; max: number } | undefined): number | undefined =>
  stamina && stamina.max > 0 ? Math.min(1, Math.max(0, stamina.current / stamina.max)) : undefined;
