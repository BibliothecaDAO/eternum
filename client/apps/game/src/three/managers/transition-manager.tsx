import { useUIStore } from "@/hooks/store/use-ui-store";

const FADE_DURATION = 300;

export class TransitionManager {
  private fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private resolveFadeOut: ((completed: boolean) => void) | null = null;
  private destroyed = false;

  fadeOut(): Promise<boolean> {
    if (this.destroyed) {
      return Promise.resolve(false);
    }

    this.cancelPendingFadeOut();

    const { setIsLoadingScreenEnabled } = useUIStore.getState();
    setIsLoadingScreenEnabled(true);
    return new Promise((resolve) => {
      this.resolveFadeOut = resolve;
      this.fadeTimeoutId = setTimeout(() => this.completeFadeOut(), FADE_DURATION);
    });
  }

  fadeIn() {
    this.cancelPendingFadeOut();
    const { setIsLoadingScreenEnabled, setTooltip } = useUIStore.getState();
    setIsLoadingScreenEnabled(false);
    setTooltip(null);
  }

  isActive() {
    return !this.destroyed;
  }

  destroy() {
    this.destroyed = true;
    this.cancelPendingFadeOut();
  }

  private completeFadeOut() {
    const resolve = this.resolveFadeOut;
    this.fadeTimeoutId = null;
    this.resolveFadeOut = null;
    resolve?.(true);
  }

  private cancelPendingFadeOut() {
    if (this.fadeTimeoutId) {
      clearTimeout(this.fadeTimeoutId);
      this.fadeTimeoutId = null;
    }

    const resolve = this.resolveFadeOut;
    this.resolveFadeOut = null;
    resolve?.(false);
  }
}
