import { formatGameClock } from "@bibliothecadao/types";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { toast } from "@/ui/features/event-feed/notify";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { isExplicitSpectateSession } from "./spectator-session";
import { configManager, getBlockTimestamp } from "@bibliothecadao/eternum";

/**
 * Whether this viewer watches the game rather than plays it: the HUD spectates, or the session was entered to spectate
 * (`?spectate=true`) whatever the account owns. A watcher has nothing of their own in the game.
 */
const isWatching = (state: { isSpectating: boolean } = useUIStore.getState()): boolean =>
  state.isSpectating || isExplicitSpectateSession();

/** The same, for a rendered surface. */
export const useIsWatching = (): boolean => useUIStore(isWatching);

/**
 * Whether this viewer plays this game: not watching, and the game not over. Surfaces that only a player has are shown
 * on it; React surfaces can subscribe with useUIStore(canIssueOrders). Whether an order can be sent right now is the
 * other half of the gate, actNowRefusal.
 */
export function canIssueOrders(state: { isSpectating: boolean } = useUIStore.getState()): boolean {
  return !isWatching(state) && !configManager.isGameOver();
}

/**
 * Why a player cannot act now, or null when they can: before play opens, "Starts in 3m 12s". Play opens as the
 * chain's "game not started" check reads it, at the main phase and never before settling, at once in dev mode. Every
 * action a player takes reads this one gate; its controls stay shown, disabled, with this reason.
 */
export const actNowRefusal = (now: number = getBlockTimestamp().currentBlockTimestamp): string | null =>
  refusalBefore(playOpensAt(), now);

/** The same gate for a rendered control, live on the chain clock so it opens on its own. */
export const useActNowRefusal = (): string | null => actNowRefusal(useNowSeconds());

/** For an order given outside a control (the map, a tap): true while play has not opened, telling the player when. */
export const refusedBeforePlay = (): boolean => {
  const refusal = actNowRefusal();
  if (refusal) toast.info(refusal);
  return refusal !== null;
};

export const refusalBefore = (opensAt: number, now: number): string | null =>
  now < opensAt ? `Starts in ${formatGameClock(opensAt - now)}` : null;

const playOpensAt = (): number => {
  if (configManager.getDevModeConfig().dev_mode_on) return 0;
  const { startMainAt, startSettlingAt } = configManager.getSeasonConfig();
  return Math.max(startMainAt, startSettlingAt);
};
