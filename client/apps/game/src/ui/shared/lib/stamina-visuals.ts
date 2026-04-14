export const STAMINA_RECHARGING_FILL_CLASS = "stamina-recharging-fill";
export const STAMINA_RECHARGING_TRACK_CLASS = "stamina-recharging-track";
export const STAMINA_RECHARGING_TEXT_CLASS = "stamina-recharging-text";

export const isStaminaRecharging = (current: number, max: number): boolean => {
  if (!Number.isFinite(current) || !Number.isFinite(max)) {
    return false;
  }

  if (max <= 0) {
    return false;
  }

  return current >= 0 && current < max;
};
