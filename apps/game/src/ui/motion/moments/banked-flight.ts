import type { ResourcesIds } from "@bibliothecadao/types";
import { announceLanding, holdUntilLanding } from "../landing-hold";
import { flySprites } from "../motion-layer";

/** A landing always releases its counter, even if the flight never reports one. */
const RELEASE_AFTER_MS = 1_500;

/** The `data-fly-target` a resource's banked counter carries. */
export const bankedCounterTarget = (resourceId: ResourcesIds): string => `resource-${resourceId}`;

/** The resource's banked counter on screen, if the HUD shows one. */
export const findBankedCounter = (resourceId: ResourcesIds): Element | null =>
  document.querySelector(`[data-fly-target="${bankedCounterTarget(resourceId)}"]`);

export const resourceIcon = (resourceId: ResourcesIds): string => `/images/resources/${resourceId}.png`;

/**
 * Earned resources flying home: `count` icons arc from a point into the resource's banked counter, which keeps the
 * number it showed until the first one lands, then rolls to its balance fact. The hold starts at once, so a balance
 * that arrives with the news waits for its icons even when the flight leaves `delayMs` later. `onLanded` runs once.
 */
export const flyToBankedCounter = ({
  resourceId,
  counter,
  from,
  count,
  popMs = 0,
  delayMs = 0,
  announce,
  onLanded,
}: {
  resourceId: ResourcesIds;
  counter: Element;
  from: { x: number; y: number };
  count: number;
  popMs?: number;
  /** How long the counter holds before the icons leave, while the moment's earlier beats play. */
  delayMs?: number;
  /** An amount for the counter to show as its "+N" when the first icon lands. */
  announce?: number;
  onLanded?: () => void;
}): void => {
  const release = holdUntilLanding(bankedCounterTarget(resourceId));
  let landed = false;
  const land = () => {
    if (landed) return;
    landed = true;
    release();
    if (announce !== undefined) announceLanding(bankedCounterTarget(resourceId), announce);
    onLanded?.();
  };
  const fly = () => flySprites({ from, to: counter, icon: resourceIcon(resourceId), count, popMs, onArrive: land });
  if (delayMs > 0) setTimeout(fly, delayMs);
  else fly();
  setTimeout(land, delayMs + RELEASE_AFTER_MS);
};
