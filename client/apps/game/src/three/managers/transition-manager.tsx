import { useUIStore } from "@/hooks/store/use-ui-store";
import * as THREE from "three";

const FADE_DURATION = 300;
// Extra delay after scene is mounted before dismissing loading screen
// Gives time for player structure data (buildings, resources) to sync into RECS
const POST_MOUNT_DELAY = 1500;

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
    setTimeout(() => {
      const { setIsLoadingScreenEnabled, setTooltip } = useUIStore.getState();
      setIsLoadingScreenEnabled(false);
      setTooltip(null);
    }, POST_MOUNT_DELAY);
  }
}
