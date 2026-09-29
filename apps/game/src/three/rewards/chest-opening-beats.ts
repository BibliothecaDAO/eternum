import { INTENSITY, type Intensity } from "@/ui/motion/motion-scale";
import { MathUtils, type Object3D } from "three";
import type { RewardSummoning } from "./reward-summoning";

/** The chest moment as the world needs it: its beat, the rarity once known, when the tap landed and the tell began. */
export interface ChestBeat {
  phase: "anticipation" | "tell" | "burst" | "reveal";
  intensity: Intensity | null;
  openedAt: number;
  tellAt: number | null;
}

const TAP_MS = 80;
const WOBBLE_HZ = 2;
const HOLD_VIOLET = "#c9a2ff";
const HOLD_SEAM = 0.45;
const TELL_SEAM = 0.9;
/** The runes and crystals turn to the rarity's colour over the tell's first 250 ms. */
const RUNE_RAMP_MS = 250;
/** Below rare the lid only glows; rare raises a light column and epic a much taller one. */
const BEAMS = [
  { limit: 0.35, reach: 1, boost: 1 },
  { limit: 0.35, reach: 1, boost: 1 },
  { limit: 1, reach: 2.6, boost: 1.8 },
  { limit: 1, reach: 4.2, boost: 2.4 },
] as const;
const HOLD_BEAM = BEAMS[0];

/**
 * The world's half of the chest moment (design §3.11 §1) on one C2 actor: a squash on the tap, a wobble with light
 * leaking from the seams while the result is pending, then the tell: the rune rings, crystals and seam turn the
 * rarity's colour (the epic shaking harder), so the rarity reads before the lid moves. At the burst the lid springs
 * open with a light column at rare and above, taller for epic. It reads the beat each frame
 * and keeps no clock of its own, so the HUD and the world never drift apart. It moves the chest object inside its
 * placement, never the placement, and runs after the summoning's own update each frame.
 */
export class ChestOpeningBeats {
  private opened = false;

  constructor(
    private readonly chest: Object3D,
    private readonly effect: RewardSummoning,
  ) {}

  get hasOpened(): boolean {
    return this.opened;
  }

  update(beat: ChestBeat, now: number): void {
    const since = now - beat.openedAt;
    this.chest.scale.setScalar(tapSquash(since));
    this.chest.rotation.z = 0;

    if (beat.phase === "anticipation") {
      const amplitude = MathUtils.degToRad(INTENSITY.holdAmplitudeDeg[1]);
      this.chest.rotation.z = Math.sin((since / 1000) * Math.PI * 2 * WOBBLE_HZ) * amplitude;
      this.effect.setGlow({ seam: HOLD_SEAM, tint: HOLD_VIOLET, beam: HOLD_BEAM });
      return;
    }
    const intensity = beat.intensity ?? 0;
    const tint = INTENSITY.colour[intensity];
    const beam = BEAMS[intensity];
    const runes = beat.tellAt === null ? 1 : MathUtils.clamp((now - beat.tellAt) / RUNE_RAMP_MS, 0, 1);
    if (beat.phase === "tell") {
      // The column rises from the open lid at the burst; while shut, the lid only glows.
      this.effect.setGlow({ seam: TELL_SEAM, tint, runes, beam: HOLD_BEAM });
      this.chest.rotation.z =
        Math.sin((since / 1000) * Math.PI * 2 * WOBBLE_HZ * 1.5) *
        MathUtils.degToRad(INTENSITY.holdAmplitudeDeg[intensity]);
      // The epic's second, harder shake: a jitter on top of its wobble, after the glow has placed the chest.
      if (intensity === 3) {
        this.chest.position.x += Math.sin(since * 0.09) * 0.03;
        this.chest.position.z += Math.cos(since * 0.11) * 0.02;
      }
      return;
    }
    this.effect.setGlow({ seam: 0, tint, runes: 1, beam });
    if (!this.opened) {
      this.opened = true;
      this.effect.open();
    }
  }
}

/** The tap: squash to 0.92, spring to 1.06, settle at 1, all inside 80 ms plus a short settle. */
const tapSquash = (since: number): number => {
  if (since < 0 || since > TAP_MS * 2) return 1;
  if (since < TAP_MS / 2) return MathUtils.lerp(1, 0.92, since / (TAP_MS / 2));
  if (since < TAP_MS) return MathUtils.lerp(0.92, 1.06, (since - TAP_MS / 2) / (TAP_MS / 2));
  return MathUtils.lerp(1.06, 1, (since - TAP_MS) / TAP_MS);
};
