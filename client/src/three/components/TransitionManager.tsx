import * as THREE from "three";

export class TransitionManager {
  constructor(private renderer: THREE.WebGLRenderer) {
    console.log("Transition manager");
  }

  fadeOut(onComplete: () => void) {
    let opacity = 1;
    const startTime = performance.now();
    const duration = 500; // 500ms for the fade

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      opacity = 1 - Math.min(elapsed / duration, 1);
      this.renderer.domElement.style.opacity = opacity.toString();

      if (elapsed < duration) {
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
    const duration = 500; // 500ms for the fade

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      opacity = Math.min(elapsed / duration, 1);
      this.renderer.domElement.style.opacity = opacity.toString();

      if (elapsed < duration) {
        requestAnimationFrame(animate);
      } else {
        this.renderer.domElement.style.opacity = "1";
      }
    };

    requestAnimationFrame(animate);
  }
}
