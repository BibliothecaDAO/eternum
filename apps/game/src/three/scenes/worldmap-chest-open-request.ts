/** The HUD asks the world map to open a chest with an army beside it; the scene plays the opening and sends it. */
const CHEST_OPEN_REQUEST_EVENT = "chestOpenRequest";

interface ChestOpenRequest {
  explorerId: number;
  /** The chest's tile, in contract coordinates. */
  hex: { col: number; row: number };
}

export const requestChestOpening = (request: ChestOpenRequest): void => {
  window.dispatchEvent(new CustomEvent(CHEST_OPEN_REQUEST_EVENT, { detail: request }));
};

export const onChestOpenRequest = (handle: (request: ChestOpenRequest) => void): (() => void) => {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<Partial<ChestOpenRequest>>).detail;
    if (typeof detail?.explorerId !== "number" || !detail.hex) return;
    handle({ explorerId: detail.explorerId, hex: detail.hex });
  };
  window.addEventListener(CHEST_OPEN_REQUEST_EVENT, listener);
  return () => window.removeEventListener(CHEST_OPEN_REQUEST_EVENT, listener);
};
