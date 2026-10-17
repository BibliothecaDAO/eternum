export const ENDGAME_VARIATIONS = {
  surge: {
    label: "Spire surge",
    duration: 7,
    awaken: 1.5,
    settle: 1.5,
    width: 2.2,
    turbulence: 0.65,
    opacity: 0.88,
    endOpacity: 0.78,
  },
  tide: {
    label: "Choking tide",
    duration: 11,
    awaken: 2,
    settle: 2,
    width: 4.8,
    turbulence: 1.3,
    opacity: 0.94,
    endOpacity: 0.92,
  },
  fracture: {
    label: "Fractured veil",
    duration: 9,
    awaken: 2,
    settle: 1.5,
    width: 3.2,
    turbulence: 2.4,
    opacity: 0.84,
    endOpacity: 0.86,
  },
} as const;
export type EndgameVariation = keyof typeof ENDGAME_VARIATIONS;
export interface EndgameSettings {
  variation: EndgameVariation;
  spires: "awaken" | "rise";
  spared: "none" | "realm";
  busy: boolean;
  shipped?: boolean;
}
export type EndgamePhase = "live" | "awakening" | "spreading" | "frozen";
export function endgameFrame(settings: EndgameSettings, elapsed: number | null) {
  const choice = settings.shipped ? { duration: 2, awaken: 0, settle: 2 } : ENDGAME_VARIATIONS[settings.variation];
  const seconds = elapsed === null ? 0 : Math.max(0, Math.min(choice.duration, elapsed));
  const emergence = choice.awaken === 0 ? 0 : Math.min(1, seconds / choice.awaken);
  const spread = settings.shipped
    ? 0
    : Math.max(0, Math.min(1, (seconds - choice.awaken) / (choice.duration - choice.awaken - choice.settle)));
  const settle = Math.max(0, Math.min(1, (seconds - choice.duration + choice.settle) / choice.settle));
  const phase: EndgamePhase =
    elapsed === null
      ? "live"
      : seconds >= choice.duration
        ? "frozen"
        : seconds < choice.awaken
          ? "awakening"
          : "spreading";
  return { phase, seconds, emergence, spread, settle, finished: phase === "frozen" };
}
export function readEndgameSettings(search: string): EndgameSettings {
  const q = new URLSearchParams(search);
  const value = q.get("variation");
  return {
    variation: value === "tide" || value === "fracture" ? value : "surge",
    spires: q.get("spires") === "rise" ? "rise" : "awaken",
    spared: q.get("gameMode") === "frontier" ? "realm" : "none",
    busy: q.get("busy") === "1",
    shipped: q.get("shipped") === "1",
  };
}
