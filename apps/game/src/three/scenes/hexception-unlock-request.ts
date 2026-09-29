import type { BuildingType } from "@bibliothecadao/types";

/** The HUD asks the realm board to fly a research unlock into every building of its category the board shows. */
const UNLOCK_FLIGHT_EVENT = "researchUnlockFlight";

interface UnlockFlight {
  category: BuildingType;
  /** Where the unlock leaves from on screen: the tree's medallion. */
  from: { x: number; y: number };
  icon: string;
}

export const requestUnlockFlight = (flight: UnlockFlight): void => {
  window.dispatchEvent(new CustomEvent(UNLOCK_FLIGHT_EVENT, { detail: flight }));
};

export const onUnlockFlight = (handle: (flight: UnlockFlight) => void): (() => void) => {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<Partial<UnlockFlight>>).detail;
    if (detail?.category === undefined || !detail.from || !detail.icon) return;
    handle({ category: detail.category, from: detail.from, icon: detail.icon });
  };
  window.addEventListener(UNLOCK_FLIGHT_EVENT, listener);
  return () => window.removeEventListener(UNLOCK_FLIGHT_EVENT, listener);
};
