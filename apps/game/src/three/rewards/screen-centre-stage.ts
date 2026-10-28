import type { Matrix4 } from "three";

import type { ChestGlow, ChestPresentationBeats, ChestTransitions } from "./chest-transitions";

/** The transition slot of the chest a reward stages at the screen's centre: it stands on no tile. */
export const CENTRE_KEY = "centre";

/** What staging needs once the chest's model is ready: its pool, where it stands, and its animation clock. */
export interface ReadyStage {
  transitions: ChestTransitions;
  placement: Matrix4;
  time: number;
}

/**
 * The one chest a reward stages at the screen's centre, from its request to its end, its model's loading included.
 * Each request is a generation: ending the stage (the map is left) or a newer request makes every earlier one stale,
 * and a stale request stages and announces nothing once its loading finishes, however late, even after the map is
 * entered again.
 */
export class ScreenCentreStage {
  private generation = 0;

  /** `prepare` loads what the chest needs, and says where it stands now; null when it cannot stand anywhere. */
  constructor(private readonly prepare: () => Promise<ReadyStage | null>) {}

  async present(beats: ChestPresentationBeats, glow?: ChestGlow): Promise<boolean> {
    const generation = ++this.generation;
    const ready = await this.prepare();
    if (generation !== this.generation || !ready) return false;
    return ready.transitions.present(CENTRE_KEY, ready.placement, ready.time, beats, glow);
  }

  /** Ends the staged chest, if one stands, and every request still loading. */
  end(transitions: ChestTransitions | undefined): void {
    this.generation++;
    transitions?.cancel(CENTRE_KEY);
  }
}
