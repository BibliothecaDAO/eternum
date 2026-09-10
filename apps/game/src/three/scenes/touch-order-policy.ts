export type TouchTapIntent = "select" | "arm" | "commit";

interface ResolveTouchTapIntentInput {
  isTouch: boolean;
  isActionTarget: boolean;
  armedHexKey: string | null;
  tappedHexKey: string | null;
}

/**
 * Touch has no hover and no right-click, so an order takes two taps: the first tap on a
 * reachable hex arms it (shows the desktop hover preview), the second tap on the same hex
 * commits it. Mouse input and taps on non-action hexes keep the plain select behaviour.
 */
export function resolveTouchTapIntent(input: ResolveTouchTapIntentInput): TouchTapIntent {
  if (!input.isTouch || !input.isActionTarget || input.tappedHexKey === null) {
    return "select";
  }

  return input.armedHexKey === input.tappedHexKey ? "commit" : "arm";
}
