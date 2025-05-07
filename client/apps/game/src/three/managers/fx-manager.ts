import * as THREE from "three";

export class FXManager {
  private scene: THREE.Scene;
  private texture: THREE.Texture;
  private activeFX: Set<THREE.Object3D> = new Set();
  private clock = new THREE.Clock();

  constructor(scene: THREE.Scene, textureUrl: string) {
    this.scene = scene;
    this.texture = new THREE.TextureLoader().load(textureUrl);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  playFxAtCoords(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.renderOrder = Infinity;
    group.position.set(x, y, z);

    const material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.5, 1.5, 1.5);
    group.add(sprite);
    this.scene.add(group);
    this.activeFX.add(group);

    let elapsed = 0;

    const duration = 2.5;
    const hoverHeight = 1.5;

    const animate = () => {
      const delta = this.clock.getDelta();
      elapsed += delta;

      const t = elapsed;

      // Phase 1: Scale In and Fade In (0–0.2s)
      if (t < 0.2) {
        const f = t / 0.2;
        material.opacity = f;
        sprite.scale.set(1.5 * f, 1.5 * f, 1.5 * f);
      }

      // Phase 2: Idle Hover (0.2–1.5s)
      if (t >= 0.2 && t < 1.5) {
        const hover = Math.sin((t - 0.2) * Math.PI * 2) * 0.1;
        group.position.y = y + hover;
        material.opacity = 1;
      }

      // Phase 3: Rise and Fade Out (1.5–2.5s)
      if (t >= 1.5 && t < duration) {
        const f = (t - 1.5) / 1.0;
        group.position.y = y + hoverHeight * f;
        material.opacity = 1 - f;
      }

      if (t >= duration) {
        this.scene.remove(group);
        this.activeFX.delete(group);
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }
}
