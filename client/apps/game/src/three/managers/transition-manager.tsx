import { useUIStore } from "@/hooks/store/use-ui-store";
import * as THREE from "three";

const FADE_DURATION = 300;

export class TransitionManager {
  private fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;

  constructor(private renderer: THREE.WebGLRenderer) {}

  fadeOut(onComplete: () => void) {
    if (this.isDestroyed) {
      return;
    }

    if (this.fadeTimeoutId) {
      clearTimeout(this.fadeTimeoutId);
      this.fadeTimeoutId = null;
    }

    const { setIsLoadingScreenEnabled } = useUIStore.getState();
    setIsLoadingScreenEnabled(true);
    this.fadeTimeoutId = setTimeout(() => {
      this.fadeTimeoutId = null;
      if (this.isDestroyed) {
        return;
      }
      onComplete();
    }, FADE_DURATION);
  }

  fadeIn() {
    if (this.fadeTimeoutId) {
      clearTimeout(this.fadeTimeoutId);
      this.fadeTimeoutId = null;
    }
    const { setIsLoadingScreenEnabled, setTooltip } = useUIStore.getState();
    setIsLoadingScreenEnabled(false);
    setTooltip(null);
  }

  destroy() {
    if (this.fadeTimeoutId) {
      clearTimeout(this.fadeTimeoutId);
      this.fadeTimeoutId = null;
    }
    this.isDestroyed = true;
  }
}
