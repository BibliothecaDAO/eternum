import { AudioManager } from "@/audio/core/AudioManager";
import { getResourceSoundId } from "@/three/sound/utils";
import { toast } from "@/ui/features/event-feed/notify";
import { findBankedCounter, flyToBankedCounter } from "@/ui/motion/moments/banked-flight";
import { playHaptic } from "@/ui/motion/motion-settings";
import { formatGain, resourceName } from "@bibliothecadao/types";
import { create } from "zustand";
import { payoutSprites, type SiteClear } from "./site-outcome";

/**
 * Design §3.11 §3, the site cleared, after the exchange (the world's troop-diff numbers already play from the armies'
 * facts): the guard falls with its cue, a haptic and a dust burst of 24 at the site, and the payout flies home to its
 * banked counter, whose "+N" is the toast. Only with no counter on screen does a toast say it instead. What the fight
 * did reads on its result, which the acting surface shows; a ruin's result is its chest, opened here.
 */
interface RuinChestOpening {
  siteId: number;
  /** Whole troops the army lost in the winning exchange. */
  troopsLost: number;
  shownAt: number;
}

const useRuinChestStore = create<{ opening: RuinChestOpening | null }>(() => ({ opening: null }));

export const useRuinChest = () => useRuinChestStore((state) => state.opening);

export const closeRuinChest = (): void => useRuinChestStore.setState({ opening: null });

const GUARD_FALLS_MS = 300;

export const playSiteClear = ({
  clear,
  troopsLost,
  at,
  burst,
}: {
  clear: SiteClear;
  troopsLost: number;
  /** The site's tile on screen. */
  at: { x: number; y: number };
  /** The scene's dust burst at the site (its playBurst chokepoint). */
  burst: () => void;
}): void => {
  void AudioManager.getInstance().play("combat.victory");
  playHaptic(1);
  burst();
  // The payout's counter holds from now, as its balance arrives with the story.
  if (clear.reward) payHome(clear.reward, at);
  setTimeout(() => {
    void AudioManager.getInstance().play("site.clear");
    if (clear.kind === "Ruin")
      useRuinChestStore.setState({ opening: { siteId: clear.siteId, troopsLost, shownAt: performance.now() } });
  }, GUARD_FALLS_MS);
};

const payHome = ({ resourceId, amount: paid }: NonNullable<SiteClear["reward"]>, from: { x: number; y: number }) => {
  const counter = findBankedCounter(resourceId);
  const label = `${formatGain(paid)} ${resourceName(resourceId)}`;
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
