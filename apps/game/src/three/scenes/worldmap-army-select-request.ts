/** The HUD asks the world map to select one of the player's armies; the scene frames the camera and selects it. */
export const ARMY_SELECT_REQUEST_EVENT = "armySelectRequest";

export const requestArmySelection = (entityId: number): void => {
  window.dispatchEvent(new CustomEvent(ARMY_SELECT_REQUEST_EVENT, { detail: { entityId } }));
};

export const readArmySelectRequest = (event: Event): number | null => {
  const detail = (event as CustomEvent<{ entityId?: unknown }>).detail;
  return typeof detail?.entityId === "number" ? detail.entityId : null;
};
