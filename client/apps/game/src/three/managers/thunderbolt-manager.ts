import { type HexPosition, getNeighborHexes } from "@bibliothecadao/types";
import * as THREE from "three";
import { env } from "../../../env";
import { HEX_SIZE } from "../constants";
import { getWorldPositionForHex } from "../utils";

interface ThunderBoltConfig {
  radius: number;
  count: number;
  duration: number;
  persistent: boolean;
  debug: boolean;
}

interface LightningSegment {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
}

interface ActiveThunderBolt {
  group: THREE.Group;
  segments: LightningSegment[];
  glow?: THREE.Mesh;
  startTime: number;
  duration: number;
  hexPosition: HexPosition;
  flickerSpeed: number;
}

/**
 * ThunderBoltManager - Manages thunder bolt effects in 3D scenes
 *
 * Usage in scene setup() method:
 * ```typescript
 * setup() {
 *   // Configure thunder bolts for this scene
 *   this.getThunderBoltManager().setConfig({
 *     radius: 6,        // How far from camera center to spawn bolts
 *     count: 8,         // Base number of bolts to spawn
 *     duration: 800,    // How long each bolt lasts (ms)
 *     persistent: false, // Whether bolts stay visible
 *     debug: true       // Enable console logging
 *   });
 * }
 * ```
 */
export class ThunderBoltManager {
  private thunderBolts: THREE.Group = new THREE.Group();
  private activeThunderBolts: ActiveThunderBolt[] = [];
  private config: ThunderBoltConfig = {
    radius: 2,
    count: 5,
    duration: 250,
    persistent: true,
    debug: env.VITE_PUBLIC_GRAPHICS_DEV === true,
  };

  constructor(
    private scene: THREE.Scene,
    private controls: any,
  ) {
    this.thunderBolts.name = "ThunderBolts";
    this.scene.add(this.thunderBolts);

    if (this.config.debug) {
      console.log("ThunderBoltManager initialized");
    }
  }

  public setConfig(config: Partial<ThunderBoltConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.debug) {
      console.log("ThunderBolt config updated:", this.config);
    }
  }

  public getConfig(): ThunderBoltConfig {
    return { ...this.config };
  }

  private generateLightningPath(height: number, subdivisions: number): THREE.Vector3[] {
    const points: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, height, 0)];
    let sway = 1.4;

    for (let i = 0; i < subdivisions; i++) {
      const refined: THREE.Vector3[] = [points[0]];

      for (let j = 0; j < points.length - 1; j++) {
        const start = points[j];
        const end = points[j + 1];
        const mid = start.clone().add(end).multiplyScalar(0.5);
        const progress = mid.y / height;
        const jitter = sway * (1 - progress * 0.8);
        mid.x += (Math.random() - 0.5) * jitter;
        mid.z += (Math.random() - 0.5) * jitter;
        refined.push(mid, end);
      }

      points.splice(0, points.length, ...refined);
      sway *= 0.55;
    }

    return points;
  }

  private generateBranchPaths(mainPath: THREE.Vector3[], height: number): THREE.Vector3[][] {
    const branches: THREE.Vector3[][] = [];
    const branchCount = Math.random() < 0.5 ? 1 : 2;
    const minIndex = Math.floor(mainPath.length * 0.35);
    const maxIndex = Math.floor(mainPath.length * 0.85);

    if (maxIndex <= minIndex) {
      return branches;
    }

    for (let i = 0; i < branchCount; i++) {
      const anchorIndex = THREE.MathUtils.randInt(minIndex, maxIndex);
      const anchor = mainPath[anchorIndex];
      const branchLength = height * (0.25 + Math.random() * 0.2);
      const segmentCount = 3 + Math.floor(Math.random() * 3);
      const direction = new THREE.Vector3(
        Math.random() - 0.5,
        0.6 + Math.random() * 0.6,
        Math.random() - 0.5,
      ).normalize();

      const branch: THREE.Vector3[] = [anchor.clone()];
      const step = branchLength / segmentCount;

      for (let j = 1; j <= segmentCount; j++) {
        const stepPoint = anchor
          .clone()
          .add(direction.clone().multiplyScalar(step * j))
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * step,
              (Math.random() - 0.5) * step * 0.5,
              (Math.random() - 0.5) * step,
            ),
          );
        branch.push(stepPoint);
      }

      branches.push(branch);
    }

    return branches;
  }

  private createLightningSegment(points: THREE.Vector3[], radius: number): LightningSegment {
    const curve = new THREE.CatmullRomCurve3(points);
    const tubularSegments = Math.max(12, points.length * 2);
    const tube = new THREE.TubeGeometry(curve, tubularSegments, radius, 6, false);
    const material = new THREE.MeshBasicMaterial({
      color: 0xbedbff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(tube, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    return { mesh, material };
  }

  private createImpactGlow(radius: number): THREE.Mesh {
    const geometry = new THREE.CircleGeometry(radius, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x97c2ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(geometry, material);
    glow.rotation.x = -Math.PI / 2;
    glow.castShadow = false;
    glow.receiveShadow = false;
    glow.position.y = 0.02;
    return glow;
  }

  private disposeThunderBolt(bolt: ActiveThunderBolt): void {
    bolt.segments.forEach((segment) => {
      bolt.group.remove(segment.mesh);
      segment.material.dispose();
      segment.mesh.geometry.dispose();
    });

    if (bolt.glow) {
      bolt.group.remove(bolt.glow);
      (bolt.glow.material as THREE.Material).dispose();
      bolt.glow.geometry.dispose();
    }

    this.thunderBolts.remove(bolt.group);
    bolt.group.clear();
  }

  private getCenterHexFromCamera(): HexPosition {
    const cameraTarget = new THREE.Vector3();

    // Get camera target from controls
    if (this.controls && this.controls.target) {
      cameraTarget.copy(this.controls.target);
    } else {
      // Fallback: use controls object position
      cameraTarget.copy(this.controls.object.position);
      cameraTarget.y = 0;
    }

    // Convert world position to hex coordinates
    const hexRadius = HEX_SIZE;
    const hexHeight = hexRadius * 2;
    const hexWidth = Math.sqrt(3) * hexRadius;
    const vertDist = hexHeight * 0.75;
    const horizDist = hexWidth;

    const row = Math.round(cameraTarget.z / vertDist);
    const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
    const col = Math.round((cameraTarget.x + rowOffset) / horizDist);

    return { col, row };
  }

  private createThunderBolt(hexPosition: HexPosition): void {
    const worldPos = getWorldPositionForHex(hexPosition);
    const height = 13 + Math.random() * 4;
    const mainPath = this.generateLightningPath(height, 5 + Math.floor(Math.random() * 2));
    const branches = this.generateBranchPaths(mainPath, height);
    const boltGroup = new THREE.Group();
    const segments: LightningSegment[] = [];

    const mainSegment = this.createLightningSegment(mainPath, 0.12);
    segments.push(mainSegment);
    boltGroup.add(mainSegment.mesh);

    branches.forEach((branch) => {
      const branchSegment = this.createLightningSegment(branch, 0.08);
      segments.push(branchSegment);
      boltGroup.add(branchSegment.mesh);
    });

    const glow = this.createImpactGlow(0.55 + Math.random() * 0.25);
    boltGroup.add(glow);

    boltGroup.position.copy(worldPos);
    boltGroup.position.y += 0.05;

    const randomRotation = Math.random() * Math.PI * 2;
    boltGroup.rotation.y = randomRotation;

    const duration = this.config.persistent ? 30000 : this.config.duration + Math.random() * 300;

    const thunderBolt: ActiveThunderBolt = {
      group: boltGroup,
      segments,
      glow,
      startTime: performance.now(),
      duration,
      hexPosition,
      flickerSpeed: 3 + Math.random() * 4,
    };

    this.thunderBolts.add(boltGroup);
    this.activeThunderBolts.push(thunderBolt);

    if (this.config.debug) {
      console.log(
        `Created thunder bolt at hex (${hexPosition.col}, ${hexPosition.row}) world pos (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)}), duration: ${duration}ms`,
      );
    }
  }

  private getRandomHexesAroundCenter(centerHex: HexPosition, radius: number, count: number): HexPosition[] {
    const positions: HexPosition[] = [];
    const positionSet = new Set<string>();

    let currentLayer = [centerHex];
    for (let i = 0; i < radius; i++) {
      const nextLayer: HexPosition[] = [];
      currentLayer.forEach((pos) => {
        getNeighborHexes(pos.col, pos.row).forEach((neighbor) => {
          const key = `${neighbor.col},${neighbor.row}`;
          if (!positionSet.has(key)) {
            positions.push(neighbor);
            positionSet.add(key);
            nextLayer.push(neighbor);
          }
        });
      });
      currentLayer = nextLayer;
    }

    const shuffled = positions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  public spawnThunderBolts(): void {
    const centerHex = this.getCenterHexFromCamera();
    const randomHexes = this.getRandomHexesAroundCenter(
      centerHex,
      this.config.radius,
      this.config.count + Math.floor(Math.random() * 3),
    );

    if (this.config.debug) {
      console.log(`Spawning ${randomHexes.length} thunder bolts around center (${centerHex.col}, ${centerHex.row})`);
      console.log("Thunder bolt positions:", randomHexes);
    }

    // Calculate spawn timing to ensure all bolts are visible for their full duration
    // Use maximum 10% of the bolt duration for the entire spawn sequence, capped at 50ms
    const maxSpawnPeriod = Math.min(this.config.duration * 0.1, 50);
    const spawnInterval = randomHexes.length > 1 ? maxSpawnPeriod / (randomHexes.length - 1) : 0;

    randomHexes.forEach((hex, index) => {
      setTimeout(
        () => {
          this.createThunderBolt(hex);
        },
        index * spawnInterval + Math.random() * 10,
      );
    });
  }

  public spawnThunderBoltAt(hexPosition: HexPosition): void {
    this.createThunderBolt(hexPosition);
  }

  public update(): void {
    const currentTime = performance.now();

    for (let i = this.activeThunderBolts.length - 1; i >= 0; i--) {
      const thunderBolt = this.activeThunderBolts[i];
      const elapsed = currentTime - thunderBolt.startTime;
      const progress = elapsed / thunderBolt.duration;

      if (progress >= 1 && !this.config.persistent) {
        this.disposeThunderBolt(thunderBolt);
        this.activeThunderBolts.splice(i, 1);

        if (this.config.debug) {
          console.log(`Removed thunder bolt at hex (${thunderBolt.hexPosition.col}, ${thunderBolt.hexPosition.row})`);
        }
      } else if (!this.config.persistent) {
        const fadeIn = Math.min(1, progress / 0.15);
        const fadeOut = progress > 0.35 ? 1 - (progress - 0.35) / 0.65 : 1;
        const flicker = 0.65 + Math.sin(elapsed * thunderBolt.flickerSpeed * 0.015) * 0.35;
        const opacity = THREE.MathUtils.clamp(fadeIn * fadeOut * (0.7 + flicker * 0.3), 0.05, 1);
        const intensity = THREE.MathUtils.lerp(0.8, 1.35, flicker);

        thunderBolt.segments.forEach(({ material }) => {
          material.opacity = opacity;
          material.color.setRGB(intensity, intensity * 0.86, 1.0);
        });

        if (thunderBolt.glow) {
          const glowMaterial = thunderBolt.glow.material as THREE.MeshBasicMaterial;
          glowMaterial.opacity = opacity * 0.6;
        }
      } else {
        // For persistent bolts, just keep them flickering
        const intensity = Math.sin(elapsed * thunderBolt.flickerSpeed * 0.015) * 0.4 + 1.0;
        const opacity = 0.75 + Math.sin(elapsed * thunderBolt.flickerSpeed * 0.006) * 0.2;

        thunderBolt.segments.forEach(({ material }) => {
          material.opacity = opacity;
          material.color.setRGB(intensity, intensity * 0.88, 1.05);
        });

        if (thunderBolt.glow) {
          const glowMaterial = thunderBolt.glow.material as THREE.MeshBasicMaterial;
          glowMaterial.opacity = opacity * 0.55;
        }
      }
    }

    if (this.config.debug && this.activeThunderBolts.length > 0) {
      console.log(`Active thunder bolts: ${this.activeThunderBolts.length}`);
    }
  }

  public cleanup(): void {
    this.activeThunderBolts.forEach((thunderBolt) => {
      this.disposeThunderBolt(thunderBolt);
    });
    this.activeThunderBolts.length = 0;

    if (this.config.debug) {
      console.log("ThunderBoltManager cleaned up");
    }
  }

  public getActiveCount(): number {
    return this.activeThunderBolts.length;
  }

  public clearAll(): void {
    if (this.config.debug) {
      console.log("Clearing all thunder bolts...");
    }
    this.cleanup();
  }

  // GUI setup helper
  public setupGUI(folder: any): void {
    const thunderFolder = folder.addFolder("Thunder Bolts");

    thunderFolder
      .add(this.config, "debug")
      .name("Debug Mode")
      .onChange((value: boolean) => {
        this.config.debug = value;
      });

    thunderFolder
      .add(this.config, "persistent")
      .name("Persistent Bolts")
      .onChange((value: boolean) => {
        this.config.persistent = value;
      });

    thunderFolder
      .add(this.config, "radius", 1, 10, 1)
      .name("Radius")
      .onChange((value: number) => {
        this.config.radius = value;
      });

    thunderFolder
      .add(this.config, "count", 1, 20, 1)
      .name("Count")
      .onChange((value: number) => {
        this.config.count = value;
      });

    thunderFolder
      .add(this.config, "duration", 100, 2000, 50)
      .name("Duration (ms)")
      .onChange((value: number) => {
        this.config.duration = value;
      });

    thunderFolder
      .add(
        {
          spawnNow: () => {
            console.log("Manually spawning thunder bolts...");
            this.spawnThunderBolts();
          },
        },
        "spawnNow",
      )
      .name("Spawn Now");

    thunderFolder
      .add(
        {
          clearAll: () => {
            this.clearAll();
          },
        },
        "clearAll",
      )
      .name("Clear All");

    thunderFolder
      .add(
        {
          testSingle: () => {
            const centerHex = this.getCenterHexFromCamera();
            console.log("Creating single thunder bolt at center...");
            this.spawnThunderBoltAt(centerHex);
          },
        },
        "testSingle",
      )
      .name("Test Single");

    thunderFolder.close();
  }
}
