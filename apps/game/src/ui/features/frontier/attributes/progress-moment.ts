import { AudioManager } from "@/audio/core/AudioManager";
import { momentSpeed } from "@/ui/motion/motion-scale";
import { riseSprite } from "@/ui/motion/motion-layer";
import { playHaptic } from "@/ui/motion/motion-settings";
import { XP_STAR_ICON } from "./xp-star";

const LEVEL_UP_MS = 400;

/**
 * Design §3.11 §2 on the world, for the player's own army when its ArmyProgress changes: an XP gain ticks and floats
 * "+N XP" from the army's tile, and each level gained plays the level-up beat (the cue, a 20 ms haptic and a ring burst
 * of 24 around the army), one after another, faster as they repeat. The army's card renders its bar and badge from the
 * fact; this is only the flourish.
 */
export const playArmyProgress = ({
  xp,
  levels,
  at,
  burst,
  now = performance.now(),
}: {
  xp: number;
  levels: number;
  /** The army's tile on screen, or null when it is off camera. */
  at: { x: number; y: number } | null;
  /** The scene's burst at the army (its playBurst chokepoint). */
  burst: () => void;
  now?: number;
}): void => {
  if (xp > 0) {
    void AudioManager.getInstance().play("xp.tick");
    if (at) riseSprite({ at, icon: XP_STAR_ICON, label: `+${xp} XP` });
  }
  let delay = 0;
  for (let level = 0; level < levels; level += 1) {
    const beat = () => {
      void AudioManager.getInstance().play("ui.levelup");
      playHaptic(1);
      burst();
    };
    if (delay === 0) beat();
    else window.setTimeout(beat, delay);
    delay += LEVEL_UP_MS * momentSpeed("level-up", 1, now + delay);
  }
};
