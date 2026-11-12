import { Color, DataTexture, LinearFilter, RGBAFormat, UnsignedByteType, Vector2 } from "three";
import type Node from "three/src/nodes/core/Node.js";
import { smoothstep, texture, uniform } from "three/tsl";

/** A light that glows onto the ground round it: its colour, brightest at its middle, and how far it reaches. */
export interface GroundLight {
  colour: Color;
  reach: number;
}

/** The square of ground the map covers, in world units, round the camera's target: the widest view and a margin. */
const COVERS = 48;
const TEXELS = 128;
/** The brightest a texel holds; the map's bytes store a light divided by it. */
const BRIGHTEST = 4;
/** The map follows the camera in these steps, so it is written again only when the camera has moved this far. */
const FOLLOW_STEP = 4;

/**
 * Fires, orbs and glowing buildings light the ground round them (renderer-aaa-2, step 6). Each light is written into a
 * small map of the ground round the camera, once when a light or the camera's square changes, and the ground reads it
 * once a pixel; nothing is drawn each frame for it, and it is the same on WebGPU and WebGL2.
 */
export class GroundLights {
  private readonly lights = new Map<string, { x: number; z: number; light: GroundLight }>();
  private readonly texels = new Uint8Array(TEXELS * TEXELS * 4);
  private readonly sums = new Float32Array(TEXELS * TEXELS * 3);
  private readonly map = new DataTexture(this.texels, TEXELS, TEXELS, RGBAFormat, UnsignedByteType);
  private readonly corner = uniform(new Vector2(0, 0));
  private dirty = true;

  constructor() {
    this.map.name = "ground-lights";
    this.map.magFilter = LinearFilter;
    this.map.minFilter = LinearFilter;
    this.map.generateMipmaps = false;
    this.map.needsUpdate = true;
  }

  set(key: string, x: number, z: number, light: GroundLight): void {
    const was = this.lights.get(key);
    if (was && was.x === x && was.z === z && was.light === light) return;
    this.lights.set(key, { x, z, light });
    this.dirty = true;
  }

  remove(key: string): void {
    if (this.lights.delete(key)) this.dirty = true;
  }

  /** Keeps the map centred on the camera's target; writes it again if anything changed since. */
  follow(x: number, z: number): void {
    const cornerX = Math.round(x / FOLLOW_STEP) * FOLLOW_STEP - COVERS / 2;
    const cornerZ = Math.round(z / FOLLOW_STEP) * FOLLOW_STEP - COVERS / 2;
    if (cornerX !== this.corner.value.x || cornerZ !== this.corner.value.y) {
      this.corner.value.set(cornerX, cornerZ);
      this.dirty = true;
    }
    if (this.dirty) this.write();
  }

  /** The light the ground receives at a point of the world, fading out at the map's edge. */
  at(world: Node<"vec3">): Node<"vec3"> {
    const uv = world.xz.sub(this.corner).div(COVERS);
    const edge = uv.min(uv.oneMinus());
    const inside = smoothstep(0, 0.1, edge.x.min(edge.y));
    return texture(this.map, uv).rgb.mul(BRIGHTEST).mul(inside);
  }

  /** The light the map holds at a point of the world, as the ground reads it: for tests and probes. */
  read(x: number, z: number): { r: number; g: number; b: number } {
    const col = Math.floor(((x - this.corner.value.x) / COVERS) * TEXELS);
    const row = Math.floor(((z - this.corner.value.y) / COVERS) * TEXELS);
    if (col < 0 || row < 0 || col >= TEXELS || row >= TEXELS) return { r: 0, g: 0, b: 0 };
    const at = (row * TEXELS + col) * 4;
    const [r, g, b] = [0, 1, 2].map((channel) => (this.texels[at + channel] / 255) * BRIGHTEST);
    return { r, g, b };
  }

  dispose(): void {
    this.map.dispose();
  }

  private write(): void {
    this.dirty = false;
    const sums = this.sums.fill(0);
    const texel = COVERS / TEXELS;
    const { x: cornerX, y: cornerZ } = this.corner.value;
    for (const { x, z, light } of this.lights.values()) {
      const fromX = Math.max(0, Math.floor((x - light.reach - cornerX) / texel));
      const toX = Math.min(TEXELS - 1, Math.ceil((x + light.reach - cornerX) / texel));
      const fromZ = Math.max(0, Math.floor((z - light.reach - cornerZ) / texel));
      const toZ = Math.min(TEXELS - 1, Math.ceil((z + light.reach - cornerZ) / texel));
      for (let row = fromZ; row <= toZ; row += 1) {
        for (let col = fromX; col <= toX; col += 1) {
          const distance = Math.hypot(cornerX + (col + 0.5) * texel - x, cornerZ + (row + 0.5) * texel - z);
          const falloff = Math.max(0, 1 - distance / light.reach) ** 2;
          if (falloff === 0) continue;
          const at = (row * TEXELS + col) * 3;
          sums[at] += light.colour.r * falloff;
          sums[at + 1] += light.colour.g * falloff;
          sums[at + 2] += light.colour.b * falloff;
        }
      }
    }
    for (let index = 0; index < TEXELS * TEXELS; index += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        this.texels[index * 4 + channel] = Math.round(Math.min(1, sums[index * 3 + channel] / BRIGHTEST) * 255);
      }
      this.texels[index * 4 + 3] = 255;
    }
    this.map.needsUpdate = true;
  }
}
