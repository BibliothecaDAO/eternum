import * as THREE from "three";
import useUIStore from "@/hooks/store/useUIStore";

const FADE_DURATION = 300;

export class TransitionManager {
  constructor(private renderer: THREE.WebGLRenderer) {}

  fadeOut(onComplete: () => void) {
    const { setIsLoadingScreenEnabled } = useUIStore.getState();
    setIsLoadingScreenEnabled(true);
    setTimeout(() => {
      onComplete();
    }, FADE_DURATION);
  }

  fadeIn() {
    const { setIsLoadingScreenEnabled, setTooltip } = useUIStore.getState();
    setIsLoadingScreenEnabled(false);
    setTooltip(null);
  }
}
