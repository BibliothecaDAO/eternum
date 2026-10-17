export const ENDGAME_SEQUENCE = {
  label: "Fractured veil",
  duration: 9,
  materialise: 0.8,
  contractAt: 1,
  burstAt: 2,
  settle: 1.5,
  width: 3.2,
  turbulence: 2.4,
  opacity: 0.84,
  endOpacity: 0.86,
} as const;
export interface EndgameSettings {
  spires: "awaken" | "materialise";
  spared: "none" | "realm";
  busy: boolean;
  shipped?: boolean;
}
export type EndgamePhase = "live" | "materialising" | "contracting" | "bursting" | "spreading" | "frozen";
export function endgameFrame(settings: EndgameSettings, elapsed: number | null) {
  const sequence = ENDGAME_SEQUENCE;
  const duration = settings.shipped ? 2 : sequence.duration;
  const seconds = elapsed === null ? 0 : Math.max(0, Math.min(duration, elapsed));
  const materialisation = elapsed === null || settings.shipped ? 0 : Math.min(1, seconds / sequence.materialise);
  const contraction = settings.shipped
    ? 0
    : Math.max(0, Math.min(1, (seconds - sequence.contractAt) / (sequence.burstAt - sequence.contractAt)));
  const burst = settings.shipped ? 0 : Math.max(0, Math.min(1, (seconds - sequence.burstAt) / 1.4));
  const spread = settings.shipped
    ? 0
    : Math.max(0, Math.min(1, (seconds - sequence.burstAt) / (duration - sequence.burstAt - sequence.settle)));
  const settleDuration = settings.shipped ? 2 : sequence.settle;
  const settle = Math.max(0, Math.min(1, (seconds - duration + settleDuration) / settleDuration));
  const phase: EndgamePhase =
    elapsed === null
      ? "live"
      : seconds >= duration
        ? "frozen"
        : settings.shipped
          ? "spreading"
          : seconds < sequence.contractAt
            ? "materialising"
            : seconds < sequence.burstAt
              ? "contracting"
              : seconds < sequence.burstAt + 0.4
                ? "bursting"
                : "spreading";
  const orbScale = settings.shipped
    ? 1
    : seconds < sequence.burstAt
      ? 1 - contraction * 0.94
      : 0.06 + Math.min(1, (seconds - sequence.burstAt) / 0.25) * 0.94;
  return {
    phase,
    seconds,
    materialisation,
    contraction,
    orbScale,
    burst,
    spread,
    settle,
    finished: phase === "frozen",
  };
}
export function readEndgameSettings(search: string): EndgameSettings {
  const q = new URLSearchParams(search);
  return {
    spires: q.get("spires") === "awaken" ? "awaken" : "materialise",
    spared: q.get("gameMode") === "frontier" ? "realm" : "none",
    busy: q.get("busy") === "1",
    shipped: q.get("shipped") === "1",
  };
}
