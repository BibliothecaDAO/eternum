let casterRevision = 0;

/**
 * Something that casts the sun's shadow appeared, left or changed shape: a site used up, a building placed, an army
 * leaving the map. The shadow map is drawn only on demand, so each scene's is drawn again once at its next refresh.
 */
export const markShadowCastersChanged = (): void => {
  casterRevision += 1;
};

export class ShadowRefreshPolicy {
  private cameraCellKey: string | null = null;
  private seenCasterRevision = casterRevision;
  private dirty = true;
  private lightMoved = false;
  private elapsedSinceRefreshMs = Number.POSITIVE_INFINITY;
  private sunSignature: readonly number[] | null = null;

  markCameraCell(col: number, row: number): void {
    const nextKey = `${col},${row}`;
    if (nextKey === this.cameraCellKey) {
      return;
    }

    this.cameraCellKey = nextKey;
    this.dirty = true;
  }

  observeSun(signature: readonly number[]): void {
    if (this.sunSignature && signaturesMatch(this.sunSignature, signature)) {
      return;
    }

    this.sunSignature = [...signature];
    this.lightMoved = true;
    this.dirty = true;
  }

  consumeRefresh(deltaMs: number, minimumIntervalMs = 100): boolean {
    this.elapsedSinceRefreshMs += deltaMs;
    if (this.seenCasterRevision !== casterRevision) {
      this.seenCasterRevision = casterRevision;
      this.dirty = true;
    }
    if (!this.dirty || (!this.lightMoved && this.elapsedSinceRefreshMs < minimumIntervalMs)) {
      return false;
    }

    this.dirty = false;
    this.lightMoved = false;
    this.elapsedSinceRefreshMs = 0;
    return true;
  }
}

function signaturesMatch(previous: readonly number[], next: readonly number[]): boolean {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every((value, index) => Math.abs(value - next[index]) < 0.0001);
}
