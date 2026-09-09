import type { ModelLabSettings } from "./model-lab-settings";

export const MODEL_LAB_SEQUENCE_SECONDS = 6;

/** Lab movement preview; it never changes a game's state. */
export function sampleModelLabMotion(action: ModelLabSettings["action"], seconds: number) {
  const progress = Math.min(1, Math.max(0, seconds / MODEL_LAB_SEQUENCE_SECONDS));
  const eased = progress * progress * (3 - 2 * progress);
  return {
    shipZ: action === "move" ? 0.5 - eased * 3.5 : 0.5,
    sailing: action === "move",
    phase: action === "move" ? "Under way" : "At anchor",
    progress,
  };
}
