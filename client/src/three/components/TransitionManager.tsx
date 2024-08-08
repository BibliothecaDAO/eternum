import * as THREE from "three";

const FADE_DURATION = 500;

export class TransitionManager {
  constructor(private renderer: THREE.WebGLRenderer) {}

  fadeOut(onComplete: () => void) {
    let opacity = 1;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      opacity = 1 - Math.min(elapsed / FADE_DURATION, 1);
      this.renderer.domElement.style.opacity = opacity.toString();

      if (elapsed < FADE_DURATION) {
        requestAnimationFrame(animate);
      } else {
        this.renderer.domElement.style.opacity = "0";
        onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  fadeIn() {
    let opacity = 0;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      opacity = Math.min(elapsed / FADE_DURATION, 1);
      this.renderer.domElement.style.opacity = opacity.toString();

      if (elapsed < FADE_DURATION) {
        requestAnimationFrame(animate);
      } else {
        this.renderer.domElement.style.opacity = "1";
      }
    };

    requestAnimationFrame(animate);
  }
}
