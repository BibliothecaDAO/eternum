export class ShadowRefreshPolicy {
  private cameraCellKey: string | null = null;
  private dirty = true;
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

  markContentChanged(): void {
    this.dirty = true;
  }

  observeSun(signature: readonly number[]): void {
    if (this.sunSignature && signaturesMatch(this.sunSignature, signature)) {
      return;
    }

    this.sunSignature = [...signature];
    this.dirty = true;
  }

  consumeRefresh(deltaMs: number, minimumIntervalMs: number): boolean {
    this.elapsedSinceRefreshMs += deltaMs;
    if (!this.dirty || this.elapsedSinceRefreshMs < minimumIntervalMs) {
      return false;
    }

    this.dirty = false;
    this.elapsedSinceRefreshMs = 0;
    return true;
  }
}

function signaturesMatch(previous: readonly number[], next: readonly number[]): boolean {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every((value, index) => Math.abs(value - next[index]) < 0.05);
}
