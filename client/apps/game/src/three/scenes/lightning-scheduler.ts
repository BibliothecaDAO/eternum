export class LightningScheduler {
  private startTimeout: ReturnType<typeof setTimeout> | null = null;
  private strikeTimeout: ReturnType<typeof setTimeout> | null = null;

  scheduleStart(callback: () => void, delayMs: number): void {
    this.clearStart();
    this.startTimeout = setTimeout(() => {
      this.startTimeout = null;
      callback();
    }, delayMs);
  }

  scheduleStrike(callback: () => void, delayMs: number): void {
    this.clearStrike();
    this.strikeTimeout = setTimeout(() => {
      this.strikeTimeout = null;
      callback();
    }, delayMs);
  }

  clear(): void {
    this.clearStart();
    this.clearStrike();
  }

  private clearStart(): void {
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
  }

  private clearStrike(): void {
    if (this.strikeTimeout) {
      clearTimeout(this.strikeTimeout);
      this.strikeTimeout = null;
    }
  }
}
