import { type HexPosition, getNeighborHexes } from "@bibliothecadao/types";
import * as THREE from "three";
import { HEX_SIZE } from "../constants";
import { getWorldPositionForHex } from "../utils";

interface ThunderBoltConfig {
  radius: number;
  count: number;
  duration: number;
  persistent: boolean;
  debug: boolean;
}

interface ActiveThunderBolt {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  startTime: number;
  duration: number;
  hexPosition: HexPosition;
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
    radius: 4,
    count: 5,
    duration: 250,
    persistent: true,
    debug: true,
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

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
    });

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.2, 3, 0),
      new THREE.Vector3(-0.1, 6, 0),
      new THREE.Vector3(0.3, 9, 0),
      new THREE.Vector3(-0.2, 12, 0),
      new THREE.Vector3(0.1, 15, 0),
    ]);

    const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.1, 8, false);
    const mesh = new THREE.Mesh(tubeGeometry, material);

    mesh.position.copy(worldPos);
    mesh.position.y += 0.1;

    const randomRotation = Math.random() * Math.PI * 2;
    mesh.rotation.y = randomRotation;

    const scale = 1.0 + Math.random() * 0.5;
    mesh.scale.set(scale, scale, scale);

    this.thunderBolts.add(mesh);

    const duration = this.config.persistent ? 30000 : this.config.duration + Math.random() * 300;

    const thunderBolt: ActiveThunderBolt = {
      mesh,
      material,
      startTime: performance.now(),
      duration,
      hexPosition,
    };

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
        this.thunderBolts.remove(thunderBolt.mesh);
        thunderBolt.material.dispose();
        thunderBolt.mesh.geometry.dispose();
        this.activeThunderBolts.splice(i, 1);

        if (this.config.debug) {
          console.log(`Removed thunder bolt at hex (${thunderBolt.hexPosition.col}, ${thunderBolt.hexPosition.row})`);
        }
      } else if (!this.config.persistent) {
        const fadeProgress = progress < 0.3 ? progress / 0.3 : (1 - progress) / 0.7;
        thunderBolt.material.opacity = Math.max(0.1, fadeProgress);

        const intensity = Math.sin(elapsed * 0.01) * 0.5 + 0.8;
        thunderBolt.material.color.setRGB(intensity, intensity * 0.9, 1.0);
      } else {
        // For persistent bolts, just keep them flickering
        const intensity = Math.sin(elapsed * 0.01) * 0.5 + 0.8;
        thunderBolt.material.color.setRGB(intensity, intensity * 0.9, 1.0);
        thunderBolt.material.opacity = 0.8 + Math.sin(elapsed * 0.002) * 0.2;
      }
    }

    if (this.config.debug && this.activeThunderBolts.length > 0) {
      console.log(`Active thunder bolts: ${this.activeThunderBolts.length}`);
    }
  }

  public cleanup(): void {
    this.activeThunderBolts.forEach((thunderBolt) => {
      this.thunderBolts.remove(thunderBolt.mesh);
      thunderBolt.material.dispose();
      thunderBolt.mesh.geometry.dispose();
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
