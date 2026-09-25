import { AudioManager } from "@/audio/core/AudioManager";
import { getResourceSoundId } from "@/three/sound/utils";
import { toast } from "@/ui/features/event-feed/notify";
import { findBankedCounter, flyToBankedCounter } from "@/ui/motion/moments/banked-flight";
import { playHaptic } from "@/ui/motion/motion-settings";
import { ResourcesIds } from "@bibliothecadao/types";
import { create } from "zustand";
import { payoutSprites, type SiteClear } from "./site-outcome";

/**
 * Design §3.11 §3, the site cleared, after the exchange (the world's troop-diff numbers already play from the armies'
 * facts): the guard falls with its cue, a haptic and a dust burst of 24 at the site; a compact card slides up with what
 * it cost and paid; and the payout flies home to its banked counter, whose "+N" is the toast. Only with no counter on
 * screen does a toast say it instead. The card waits 800 ms after it lands, or a tap.
 */
export interface SiteClearCard {
  clear: SiteClear;
  /** The army's troops lost in the fight; undefined while not known. */
  troopsLost: number | undefined;
  shownAt: number;
}

const useSiteClearStore = create<{ card: SiteClearCard | null }>(() => ({ card: null }));

export const useSiteClearCard = () => useSiteClearStore((state) => state.card);

export const closeSiteClearCard = (): void => useSiteClearStore.setState({ card: null });

const GUARD_FALLS_MS = 300;
const CARD_HOLD_MS = 250 + 800;

let closing: ReturnType<typeof setTimeout> | undefined;

const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export const playSiteClear = ({
  clear,
  troopsLost,
  at,
  burst,
}: {
  clear: SiteClear;
  troopsLost: number | undefined;
  /** The site's tile on screen. */
  at: { x: number; y: number };
  /** The scene's dust burst at the site (its playBurst chokepoint). */
  burst: () => void;
}): void => {
  void AudioManager.getInstance().play("combat.victory");
  playHaptic(1);
  burst();
  // The payout's counter holds from now, as its balance arrives with the story; the icons leave with the card.
  if (clear.reward) payHome(clear.reward, at);
  setTimeout(() => {
    void AudioManager.getInstance().play("site.clear");
    useSiteClearStore.setState({ card: { clear, troopsLost, shownAt: performance.now() } });
    clearTimeout(closing);
    closing = setTimeout(closeSiteClearCard, CARD_HOLD_MS);
  }, GUARD_FALLS_MS);
};

const payHome = ({ resourceId, amount: paid }: NonNullable<SiteClear["reward"]>, from: { x: number; y: number }) => {
  const counter = findBankedCounter(resourceId);
  const label = `+${amount.format(paid)} ${ResourcesIds[resourceId]}`;
  if (!counter) {
    setTimeout(() => toast.success(label), GUARD_FALLS_MS);
    return;
  }
  flyToBankedCounter({
    resourceId,
    counter,
    from,
    count: payoutSprites(paid),
    delayMs: GUARD_FALLS_MS,
    announce: paid,
    onLanded: () => void AudioManager.getInstance().play(getResourceSoundId(resourceId)),
  });
};
