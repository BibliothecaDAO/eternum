import { type HexPosition, getNeighborHexes } from "@bibliothecadao/types";
import * as THREE from "three";
import { env } from "../../../env";
import { HEX_SIZE } from "../constants";
import { getWorldPositionForHex } from "../utils";

// Module-level temp vectors to avoid allocations in hot paths
// These are reused across all thunderbolt generation calls
const tempDirection = new THREE.Vector3();
const tempJitter = new THREE.Vector3();
const tempSubDirection = new THREE.Vector3();
const tempCameraTarget = new THREE.Vector3();

interface ThunderBoltConfig {
  radius: number;
  count: number;
  duration: number;
  persistent: boolean;
  debug: boolean;
}

interface LightningLayer {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
}

interface LightningSegment {
  layers: LightningLayer[]; // Multiple layers: core, body, glow
}

interface ActiveThunderBolt {
  group: THREE.Group;
  segments: LightningSegment[];
  glow?: THREE.Group;
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

  // Pooled geometries for impact glow (created once, reused for all thunderbolts)
  private readonly glowCoreGeometry: THREE.CircleGeometry;
  private readonly glowMidGeometry: THREE.CircleGeometry;
  private readonly glowOuterGeometry: THREE.CircleGeometry;

  // Pooled materials for impact glow (created once, cloned for each thunderbolt)
  // Using prototype materials that define the base properties
  private readonly glowCoreMaterialPrototype: THREE.MeshBasicMaterial;
  private readonly glowMidMaterialPrototype: THREE.MeshBasicMaterial;
  private readonly glowOuterMaterialPrototype: THREE.MeshBasicMaterial;

  constructor(
    private scene: THREE.Scene,
    private controls: any,
  ) {
    this.thunderBolts.name = "ThunderBolts";
    this.scene.add(this.thunderBolts);

    // Pre-create pooled geometries for impact glow (unit size, scaled via mesh transform)
    // These are shared across all thunderbolts to avoid geometry allocation per-bolt
    this.glowCoreGeometry = new THREE.CircleGeometry(1, 16);
    this.glowMidGeometry = new THREE.CircleGeometry(1, 16);
    this.glowOuterGeometry = new THREE.CircleGeometry(1, 16);

    // Pre-create pooled material prototypes for impact glow
    // These define base properties; opacity is animated per-instance
    this.glowCoreMaterialPrototype = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.glowMidMaterialPrototype = new THREE.MeshBasicMaterial({
      color: 0xaaccff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.glowOuterMaterialPrototype = new THREE.MeshBasicMaterial({
      color: 0x6688bb,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    if (this.config.debug) {
      console.log("ThunderBoltManager initialized with pooled geometries and materials");
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
    const branchCount = 2 + Math.floor(Math.random() * 2); // 2-3 main branches
    const minIndex = Math.floor(mainPath.length * 0.25);
    const maxIndex = Math.floor(mainPath.length * 0.85);

    if (maxIndex <= minIndex) {
      return branches;
    }

    for (let i = 0; i < branchCount; i++) {
      const anchorIndex = THREE.MathUtils.randInt(minIndex, maxIndex);
      const anchor = mainPath[anchorIndex];
      const branchLength = height * (0.2 + Math.random() * 0.25);
      const segmentCount = 4 + Math.floor(Math.random() * 3);

      // Direction tends outward and slightly downward - use temp vector
      tempDirection
        .set((Math.random() - 0.5) * 1.5, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 1.5)
        .normalize();

      const branch: THREE.Vector3[] = [anchor.clone()];
      const step = branchLength / segmentCount;

      for (let j = 1; j <= segmentCount; j++) {
        const jitterAmount = step * (0.3 + (j / segmentCount) * 0.4); // More jitter toward end
        // Use temp vectors for intermediate calculations
        tempJitter.set(
          (Math.random() - 0.5) * jitterAmount,
          (Math.random() - 0.5) * jitterAmount * 0.5,
          (Math.random() - 0.5) * jitterAmount,
        );
        // Create new Vector3 for the step point (must persist in branch array)
        const stepPoint = anchor.clone();
        stepPoint.x += tempDirection.x * step * j + tempJitter.x;
        stepPoint.y += tempDirection.y * step * j + tempJitter.y;
        stepPoint.z += tempDirection.z * step * j + tempJitter.z;
        branch.push(stepPoint);
      }

      branches.push(branch);

      // Add sub-branches (smaller forks off main branches)
      if (Math.random() < 0.6 && branch.length > 3) {
        const subAnchorIndex = Math.floor(branch.length * (0.3 + Math.random() * 0.4));
        const subAnchor = branch[subAnchorIndex];
        const subLength = branchLength * 0.4;
        const subSegments = 2 + Math.floor(Math.random() * 2);

        // Use temp vector for sub-direction
        tempSubDirection
          .set(
            tempDirection.x + (Math.random() - 0.5) * 0.8,
            tempDirection.y * 0.5,
            tempDirection.z + (Math.random() - 0.5) * 0.8,
          )
          .normalize();

        const subBranch: THREE.Vector3[] = [subAnchor.clone()];
        const subStep = subLength / subSegments;

        for (let k = 1; k <= subSegments; k++) {
          // Use temp vector for jitter calculation
          tempJitter.set(
            (Math.random() - 0.5) * subStep * 0.5,
            (Math.random() - 0.5) * subStep * 0.3,
            (Math.random() - 0.5) * subStep * 0.5,
          );
          // Create new Vector3 for the sub point (must persist in subBranch array)
          const subPoint = subAnchor.clone();
          subPoint.x += tempSubDirection.x * subStep * k + tempJitter.x;
          subPoint.y += tempSubDirection.y * subStep * k + tempJitter.y;
          subPoint.z += tempSubDirection.z * subStep * k + tempJitter.z;
          subBranch.push(subPoint);
        }

        branches.push(subBranch);
      }
    }

    return branches;
  }

  /**
   * Create a multi-layered lightning segment with core, body, and glow
   * @param points - Path points for the lightning
   * @param baseRadius - Base radius (will be scaled for each layer)
   * @param isBranch - Whether this is a branch (thinner, less prominent)
   */
  private createLightningSegment(
    points: THREE.Vector3[],
    baseRadius: number,
    isBranch: boolean = false,
  ): LightningSegment {
    const curve = new THREE.CatmullRomCurve3(points);
    const tubularSegments = Math.max(12, points.length * 2);
    const layers: LightningLayer[] = [];

    // Layer configuration based on whether it's main bolt or branch
    const layerConfigs = isBranch
      ? [
          // Branch: simpler, 2 layers
          { radiusMult: 0.4, color: 0xffffff, opacity: 0.9, radialSegments: 4 }, // Core
          { radiusMult: 1.0, color: 0xaaccff, opacity: 0.4, radialSegments: 5 }, // Glow
        ]
      : [
          // Main bolt: 3 layers for dramatic effect
          { radiusMult: 0.25, color: 0xffffff, opacity: 1.0, radialSegments: 4 }, // Bright core
          { radiusMult: 0.6, color: 0xddeeff, opacity: 0.7, radialSegments: 5 }, // Body
          { radiusMult: 1.5, color: 0x88aadd, opacity: 0.25, radialSegments: 6 }, // Outer glow
        ];

    for (const config of layerConfigs) {
      const radius = baseRadius * config.radiusMult;
      const tube = new THREE.TubeGeometry(curve, tubularSegments, radius, config.radialSegments, false);
      const material = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: config.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(tube, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      layers.push({ mesh, material });
    }

    return { layers };
  }

  private createImpactGlow(radius: number): THREE.Group {
    const glowGroup = new THREE.Group();

    // Inner bright core - use pooled geometry and clone prototype material
    // Cloning a material is faster than creating from scratch (reuses shader program)
    const coreMaterial = this.glowCoreMaterialPrototype.clone();
    const core = new THREE.Mesh(this.glowCoreGeometry, coreMaterial);
    core.rotation.x = -Math.PI / 2;
    core.position.y = 0.03;
    core.scale.setScalar(radius * 0.3);
    glowGroup.add(core);

    // Middle glow - use pooled geometry and clone prototype material
    const midMaterial = this.glowMidMaterialPrototype.clone();
    const mid = new THREE.Mesh(this.glowMidGeometry, midMaterial);
    mid.rotation.x = -Math.PI / 2;
    mid.position.y = 0.02;
    mid.scale.setScalar(radius * 0.7);
    glowGroup.add(mid);

    // Outer soft glow - use pooled geometry and clone prototype material
    const outerMaterial = this.glowOuterMaterialPrototype.clone();
    const outer = new THREE.Mesh(this.glowOuterGeometry, outerMaterial);
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = 0.01;
    outer.scale.setScalar(radius * 1.5);
    glowGroup.add(outer);

    return glowGroup;
  }

  private updateGlowOpacity(glow: THREE.Group, multiplier: number): void {
    const opacities = [0.9, 0.5, 0.25]; // Core, mid, outer base opacities
    let index = 0;
    glow.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshBasicMaterial;
        mat.opacity = opacities[index] * multiplier;
        index++;
      }
    });
  }

  private disposeThunderBolt(bolt: ActiveThunderBolt): void {
    bolt.segments.forEach((segment) => {
      segment.layers.forEach((layer) => {
        bolt.group.remove(layer.mesh);
        layer.material.dispose();
        layer.mesh.geometry.dispose();
      });
    });

    if (bolt.glow) {
      bolt.glow.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Only dispose materials, NOT geometries (they're pooled and shared)
          (child.material as THREE.Material).dispose();
        }
      });
      bolt.group.remove(bolt.glow);
    }

    this.thunderBolts.remove(bolt.group);
    bolt.group.clear();
  }

  private getCenterHexFromCamera(): HexPosition {
    // Use module-level temp vector to avoid allocation
    // Get camera target from controls
    if (this.controls && this.controls.target) {
      tempCameraTarget.copy(this.controls.target);
    } else {
      // Fallback: use controls object position
      tempCameraTarget.copy(this.controls.object.position);
      tempCameraTarget.y = 0;
    }

    // Convert world position to hex coordinates
    const hexRadius = HEX_SIZE;
    const hexHeight = hexRadius * 2;
    const hexWidth = Math.sqrt(3) * hexRadius;
    const vertDist = hexHeight * 0.75;
    const horizDist = hexWidth;

    const row = Math.round(tempCameraTarget.z / vertDist);
    const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
    const col = Math.round((tempCameraTarget.x + rowOffset) / horizDist);

    return { col, row };
  }

  private createThunderBolt(hexPosition: HexPosition): void {
    const worldPos = getWorldPositionForHex(hexPosition);
    const height = 13 + Math.random() * 4;
    const mainPath = this.generateLightningPath(height, 5 + Math.floor(Math.random() * 2));
    const branches = this.generateBranchPaths(mainPath, height);
    const boltGroup = new THREE.Group();
    const segments: LightningSegment[] = [];

    // Create main bolt with layered glow (not a branch)
    const mainSegment = this.createLightningSegment(mainPath, 0.15, false);
    segments.push(mainSegment);
    mainSegment.layers.forEach((layer) => boltGroup.add(layer.mesh));

    // Create branches (thinner, simpler)
    branches.forEach((branch) => {
      const branchSegment = this.createLightningSegment(branch, 0.08, true);
      segments.push(branchSegment);
      branchSegment.layers.forEach((layer) => boltGroup.add(layer.mesh));
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
        const baseFade = fadeIn * fadeOut;
        const intensity = THREE.MathUtils.lerp(0.8, 1.35, flicker);

        // Update all layers in each segment
        thunderBolt.segments.forEach((segment) => {
          segment.layers.forEach((layer, layerIndex) => {
            // Core layers (index 0) stay brighter, outer layers fade more
            const layerFade = layerIndex === 0 ? 1.0 : 0.7 + layerIndex * 0.1;
            const opacity = THREE.MathUtils.clamp(baseFade * (0.7 + flicker * 0.3) * layerFade, 0.02, 1);
            layer.material.opacity = opacity * (layer.material.opacity > 0.5 ? 1.0 : 0.8);

            // Only tint non-white layers
            if (layerIndex > 0) {
              layer.material.color.setRGB(intensity * 0.9, intensity * 0.85, 1.0);
            }
          });
        });

        if (thunderBolt.glow) {
          this.updateGlowOpacity(thunderBolt.glow, baseFade * flicker);
        }
      } else {
        // For persistent bolts, just keep them flickering
        const intensity = Math.sin(elapsed * thunderBolt.flickerSpeed * 0.015) * 0.4 + 1.0;
        const baseOpacity = 0.75 + Math.sin(elapsed * thunderBolt.flickerSpeed * 0.006) * 0.2;

        thunderBolt.segments.forEach((segment) => {
          segment.layers.forEach((layer, layerIndex) => {
            const layerMult = layerIndex === 0 ? 1.0 : 0.6;
            layer.material.opacity = baseOpacity * layerMult;

            if (layerIndex > 0) {
              layer.material.color.setRGB(intensity, intensity * 0.88, 1.05);
            }
          });
        });

        if (thunderBolt.glow) {
          this.updateGlowOpacity(thunderBolt.glow, baseOpacity);
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

  /**
   * Fully dispose the manager including pooled geometries and materials.
   * Call this when the scene is being destroyed.
   */
  public destroy(): void {
    this.cleanup();

    // Dispose pooled geometries
    this.glowCoreGeometry.dispose();
    this.glowMidGeometry.dispose();
    this.glowOuterGeometry.dispose();

    // Dispose pooled material prototypes
    this.glowCoreMaterialPrototype.dispose();
    this.glowMidMaterialPrototype.dispose();
    this.glowOuterMaterialPrototype.dispose();

    // Remove from scene
    this.scene.remove(this.thunderBolts);

    if (this.config.debug) {
      console.log("ThunderBoltManager destroyed (pooled geometries and materials disposed)");
    }
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
