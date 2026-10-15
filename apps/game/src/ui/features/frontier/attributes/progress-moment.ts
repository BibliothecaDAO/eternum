import { AudioManager } from "@/audio/core/AudioManager";
import { riseSprite } from "@/ui/motion/motion-layer";
import { iconUrl } from "@/ui/design-system/icon-meaning";

/**
 * Design §3.11 §2 on the world, for the player's own army when its ArmyProgress changes: an XP gain ticks and floats
 * "+N XP" from the army's tile. The army's card renders its ring and badge from the fact; this is only the flourish.
 */
export const playArmyProgress = ({
  xp,
  at,
}: {
  xp: number;
  /** The army's tile on screen, or null when it is off camera. */
  at: { x: number; y: number } | null;
}): void => {
  if (xp <= 0) return;
  void AudioManager.getInstance().play("xp.tick");
  if (at) riseSprite({ at, icon: iconUrl("star"), label: `+${xp} XP` });
};
