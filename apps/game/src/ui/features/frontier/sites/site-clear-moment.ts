import { AudioManager } from "@/audio/core/AudioManager";
import { getResourceSoundId } from "@/three/sound/utils";
import { toast } from "@/ui/features/event-feed/notify";
import { findBankedCounter, flyToBankedCounter } from "@/ui/motion/moments/banked-flight";
import { playHaptic } from "@/ui/motion/motion-settings";
import { formatGain, resourceName } from "@bibliothecadao/types";
import { showClearBanner } from "./fight-banner";
import { payoutSprites, type SiteClear } from "./site-outcome";

const GUARD_FALLS_MS = 300;

export const playSiteClear = ({
  clear,
  at,
  burst,
}: {
  clear: SiteClear;
  /** The site's tile on screen. */
  at: { x: number; y: number };
  /** The scene's dust burst at the site (its playBurst chokepoint). */
  burst: () => void;
}): void => {
  void AudioManager.getInstance().play("combat.victory");
  playHaptic(1);
  burst();
  showClearBanner(clear);
  // The payout's counter holds from now, as its balance arrives with the story.
  if (clear.reward) payHome(clear.reward, at);
  setTimeout(() => {
    void AudioManager.getInstance().play("site.clear");
  }, GUARD_FALLS_MS);
};

const payHome = ({ resourceId, amount: paid }: NonNullable<SiteClear["reward"]>, from: { x: number; y: number }) => {
  const counter = findBankedCounter(resourceId);
  const label = `${formatGain(paid)} ${resourceName(resourceId, true)}`;
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
