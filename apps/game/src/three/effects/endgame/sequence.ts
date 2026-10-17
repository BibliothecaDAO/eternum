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

export function endgameFrame(elapsed: number | null) {
  const sequence = ENDGAME_SEQUENCE;
  const seconds = elapsed === null ? 0 : Math.max(0, Math.min(sequence.duration, elapsed));
  const materialisation = elapsed === null ? 0 : Math.min(1, seconds / sequence.materialise);
  const contraction = Math.max(
    0,
    Math.min(1, (seconds - sequence.contractAt) / (sequence.burstAt - sequence.contractAt)),
  );
  const burst = Math.max(0, Math.min(1, (seconds - sequence.burstAt) / 1.4));
  const spread = Math.max(
    0,
    Math.min(1, (seconds - sequence.burstAt) / (sequence.duration - sequence.burstAt - sequence.settle)),
  );
  const settle = Math.max(0, Math.min(1, (seconds - sequence.duration + sequence.settle) / sequence.settle));
  const orbScale =
    seconds < sequence.burstAt
      ? 1 - contraction * 0.94
      : 0.06 + Math.min(1, (seconds - sequence.burstAt) / 0.25) * 0.94;
  const phase =
    elapsed === null
      ? "live"
      : seconds >= sequence.duration
        ? "frozen"
        : seconds < sequence.contractAt
          ? "materialising"
          : seconds < sequence.burstAt
            ? "contracting"
            : seconds < sequence.burstAt + 0.4
              ? "bursting"
              : "spreading";
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

/** Ephemeral presentation time follows the native game-end fact; opening an ended game shows its final state. */
export class GameEndTimeline {
  private gameId: number | null = null;
  private elapsed: number | null = null;
  observe(gameId: number, ended: boolean, deltaSeconds: number) {
    const entering = this.gameId !== gameId;
    this.gameId = gameId;
    if (!ended) this.elapsed = null;
    else if (entering) this.elapsed = ENDGAME_SEQUENCE.duration;
    else this.elapsed = Math.min(ENDGAME_SEQUENCE.duration, (this.elapsed ?? 0) + Math.max(0, deltaSeconds));
    return this.frame;
  }
  skip(): boolean {
    if (this.elapsed === null || this.frame.finished) return false;
    this.elapsed = ENDGAME_SEQUENCE.duration;
    return true;
  }
  get frame() {
    return endgameFrame(this.elapsed);
  }
}
