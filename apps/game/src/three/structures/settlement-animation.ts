import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Mesh, type Object3D } from "three";
import type { WeatherState } from "../managers/weather-manager";

type Motion = "banner" | "flame";
interface AnimatedSurface {
  mesh: Mesh;
  original: BufferGeometry;
  geometry: BufferGeometry;
  rest: Float32Array;
  motion: Motion;
  minY: number;
  height: number;
}

/** Deforms small authored surfaces; cloned geometry keeps cached GLTFs untouched. */
export class SettlementAnimation {
  private readonly surfaces: AnimatedSurface[] = [];
  private seconds = 0;

  constructor(source: Object3D, instances: readonly Mesh[]) {
    const motions = new Map<string, Motion>();
    source.traverse((node) => {
      if (node instanceof Mesh && ["banner", "flame"].includes(node.userData.settlementMotion)) {
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
        minY: bounds.min.y,
        height: bounds.max.y - bounds.min.y,
      });
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
    for (const surface of this.surfaces) {
      if (surface.motion === "banner") this.waveBanner(surface, wind);
      else this.flickerFlame(surface, wind);
      surface.geometry.getAttribute("position").needsUpdate = true;
      surface.geometry.computeVertexNormals();
    }
  }

  dispose(): void {
    for (const surface of this.surfaces) {
      surface.mesh.geometry = surface.original;
      surface.geometry.dispose();
    }
    this.surfaces.length = 0;
  }

  private waveBanner(surface: AnimatedSurface, wind: Pick<WeatherState, "windX" | "windZ">): void {
    const positions = surface.geometry.getAttribute("position") as BufferAttribute;
    const speed = Math.min(1, Math.hypot(wind.windX, wind.windZ));
    for (let i = 0; i < positions.count; i++) {
      const x = surface.rest[i * 3];
      const y = surface.rest[i * 3 + 1];
      const z = surface.rest[i * 3 + 2];
      const free = 1 - (y - surface.minY) / surface.height;
      const wave = Math.sin(this.seconds * (2.5 + speed * 2) - free * 5 + x * 18);
      const ripple = Math.sin(this.seconds * 5 - free * 9 + x * 32) * 0.2;
      const sway = free * (0.012 + speed * 0.04) * (wave + ripple);
      positions.setXYZ(
        i,
        x + wind.windX * free * 0.025,
        y + Math.abs(sway) * free * 0.2,
        z + sway + wind.windZ * free * 0.045,
      );
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
