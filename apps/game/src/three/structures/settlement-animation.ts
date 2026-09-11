import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Mesh, type Object3D } from "three";
import type { WeatherState } from "../managers/weather-manager";
import { SettlementAtmosphere } from "./settlement-atmosphere";

type Motion = "banner" | "flame" | "spin" | "foliage";
interface AnimatedSurface {
  mesh: Mesh;
  original: BufferGeometry;
  geometry: BufferGeometry;
  rest: Float32Array;
  motion: Motion;
  centerX: number;
  centerZ: number;
  minY: number;
  height: number;
}

/** Deforms small authored surfaces; cloned geometry keeps cached GLTFs untouched. */
export class SettlementAnimation {
  private readonly surfaces: AnimatedSurface[] = [];
  private seconds = 0;
  private readonly atmosphere: SettlementAtmosphere;

  constructor(source: Object3D, instances: readonly Mesh[]) {
    this.atmosphere = new SettlementAtmosphere(source, instances);
    const motions = new Map<string, Motion>();
    source.traverse((node) => {
      if (node instanceof Mesh && ["banner", "flame", "spin", "foliage"].includes(node.userData.settlementMotion)) {
        motions.set(node.geometry.uuid, node.userData.settlementMotion);
      }
    });
    for (const mesh of instances) {
      const motion = motions.get(mesh.geometry.uuid);
      if (!motion) continue;
      const original = mesh.geometry;
      const geometry = original.clone();
      const positions = geometry.getAttribute("position");
      const rest = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) {
        rest.set([positions.getX(i), positions.getY(i), positions.getZ(i)], i * 3);
      }
      geometry.setAttribute("position", new BufferAttribute(rest.slice(), 3).setUsage(DynamicDrawUsage));
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      this.surfaces.push({
        mesh,
        original,
        geometry,
        rest,
        motion,
        centerX: (bounds.min.x + bounds.max.x) / 2,
        centerZ: (bounds.min.z + bounds.max.z) / 2,
        minY: bounds.min.y,
        height: bounds.max.y - bounds.min.y,
      });
      // A spinning gem must stay visible through the full sweep, including oblique facets.
      if (motion === "spin") {
        const radius = Math.hypot(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2;
        const centerX = (bounds.min.x + bounds.max.x) / 2;
        const centerZ = (bounds.min.z + bounds.max.z) / 2;
        bounds.min.x = centerX - radius;
        bounds.max.x = centerX + radius;
        bounds.min.z = centerZ - radius;
        bounds.max.z = centerZ + radius;
      }
      // Conservative bounds include wind displacement without a per-frame bounds scan.
      bounds.expandByScalar(0.12);
      geometry.computeBoundingSphere();
      geometry.boundingSphere!.radius += 0.12;
      mesh.geometry = geometry;
    }
  }

  update(delta: number, wind: Pick<WeatherState, "windX" | "windZ">): void {
    if (delta <= 0) return;
    this.seconds += delta;
    this.atmosphere.update(this.seconds, wind);
    for (const surface of this.surfaces) {
      if (surface.motion === "banner") this.waveBanner(surface, wind);
      else if (surface.motion === "flame") this.flickerFlame(surface, wind);
      else if (surface.motion === "foliage") this.swayFoliage(surface, wind);
      else this.spinGem(surface);
      surface.geometry.getAttribute("position").needsUpdate = true;
      surface.geometry.computeVertexNormals();
    }
  }

  dispose(): void {
    this.atmosphere.dispose();
    for (const surface of this.surfaces) {
      surface.mesh.geometry = surface.original;
      surface.geometry.dispose();
    }
    this.surfaces.length = 0;
  }

  private spinGem(surface: AnimatedSurface): void {
    const positions = surface.geometry.getAttribute("position") as BufferAttribute;
    const angle = (this.seconds * Math.PI) / 6;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (let i = 0; i < positions.count; i++) {
      const x = surface.rest[i * 3] - surface.centerX;
      const z = surface.rest[i * 3 + 2] - surface.centerZ;
      positions.setXYZ(
        i,
        surface.centerX + x * cosine + z * sine,
        surface.rest[i * 3 + 1],
        surface.centerZ - x * sine + z * cosine,
      );
    }
  }

  private waveBanner(surface: AnimatedSurface, wind: Pick<WeatherState, "windX" | "windZ">): void {
    const positions = surface.geometry.getAttribute("position") as BufferAttribute;
    const speed = Math.min(1, Math.hypot(wind.windX, wind.windZ));
    const clothScale = Math.min(1, surface.height / 0.32);
    for (let i = 0; i < positions.count; i++) {
      const x = surface.rest[i * 3];
      const y = surface.rest[i * 3 + 1];
      const z = surface.rest[i * 3 + 2];
      const free = 1 - (y - surface.minY) / surface.height;
      const wave = Math.sin(this.seconds * (2.5 + speed * 2) - free * 5 + x * 18);
      const ripple = Math.sin(this.seconds * 5 - free * 9 + x * 32) * 0.2;
      const sway = clothScale * free * (0.012 + speed * 0.04) * (wave + ripple);
      positions.setXYZ(
        i,
        x + wind.windX * free * 0.025 * clothScale,
        y + Math.abs(sway) * free * 0.2,
        z + sway + wind.windZ * free * 0.045 * clothScale,
      );
    }
  }

  private swayFoliage(surface: AnimatedSurface, wind: Pick<WeatherState, "windX" | "windZ">): void {
    const positions = surface.geometry.getAttribute("position") as BufferAttribute;
    const phase = surface.centerX * 13 + surface.centerZ * 9;
    const sway = Math.sin(this.seconds * 1.8 + phase) * 0.009;
    for (let i = 0; i < positions.count; i++) {
      const x = surface.rest[i * 3];
      const y = surface.rest[i * 3 + 1];
      const z = surface.rest[i * 3 + 2];
      const free = (y - surface.minY) / surface.height;
      positions.setXYZ(i, x + free * (sway + wind.windX * 0.014), y, z + free * (sway * 0.6 + wind.windZ * 0.014));
    }
  }

  private flickerFlame(surface: AnimatedSurface, wind: Pick<WeatherState, "windX" | "windZ">): void {
    const positions = surface.geometry.getAttribute("position") as BufferAttribute;
    const phase = surface.rest[0] * 37;
    const pulse = 1 + 0.11 * Math.sin(this.seconds * 8 + phase) + 0.045 * Math.sin(this.seconds * 17 + phase);
    for (let i = 0; i < positions.count; i++) {
      const x = surface.rest[i * 3];
      const y = surface.rest[i * 3 + 1];
      const z = surface.rest[i * 3 + 2];
      const rise = (y - surface.minY) / surface.height;
      const curl = rise * rise * Math.sin(this.seconds * 6 + rise * 4 + phase) * 0.022;
      positions.setXYZ(
        i,
        x + curl + wind.windX * rise * 0.045,
        surface.minY + (y - surface.minY) * pulse,
        z + wind.windZ * rise * 0.045,
      );
    }
  }
}
