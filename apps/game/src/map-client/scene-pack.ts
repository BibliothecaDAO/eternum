import {
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  RenderTarget,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { WebGPURenderer } from "three/webgpu";

import { configureGltfTextureSupport } from "@/three/utils/utils";

import { appendModelVertices, type KitModel, type KitTexture } from "./unit-models";

/** How a mesh is shaded: plainly, as ground with the hex grid, as water, or as a plant the wind moves. */
export type MeshKind = "solid" | "ground" | "water" | "plant";

interface MeshRecord {
  kind: MeshKind;
  vertexOffset: number;
  vertexCount: number;
  indexOffset: number;
  indexCount: number;
  instanceOffset: number;
  instanceCount: number;
  castsShadow: boolean;
  /** Which of the pack's textures paints the mesh; -1 for none. */
  texture: number;
}

/** A hex of the land as the renderer is told of it: its middle, its biome and its palette colour, known or not. */
export interface PackedHex {
  x: number;
  z: number;
  biome: string;
  /** The biome's ground colour, linear red, green and blue. */
  colour: readonly [number, number, number];
  explored: boolean;
}

/** The key light and the sky's, as a matt surface receives them. */
export interface PackedLight {
  toward: readonly [number, number, number];
  colour: readonly [number, number, number];
  sky: readonly [number, number, number];
  ground: readonly [number, number, number];
  centre: readonly [number, number, number];
}

/** The scene as the renderer takes it: a table (JSON) over one buffer of floats and texture pixels. */
export interface PackedScene {
  table: string;
  buffer: Uint8Array;
}

/** One placement of a mesh: its matrix, column by column, then its tint. */
export type Placement = readonly number[];

/** A placement at a point of the ground, turned about the vertical and grown evenly, in a tint. */
export function placedAt(
  at: readonly [number, number, number],
  yaw: number,
  scale: number,
  tint: readonly [number, number, number],
): Placement {
  const [cos, sin] = [Math.cos(yaw) * scale, Math.sin(yaw) * scale];
  // prettier-ignore
  return [
    cos, 0, -sin, 0,
    0, scale, 0, 0,
    sin, 0, cos, 0,
    at[0], at[1], at[2], 1,
    tint[0], tint[1], tint[2], 1,
  ];
}

/**
 * Gathers a scene for the map's renderer: meshes with their placements, the textures that paint them, the unit
 * models and the hexes, into the one table and buffer the renderer starts from.
 */
export class ScenePack {
  private readonly floats: number[];
  private readonly meshes: MeshRecord[] = [];

  /**
   * `unitFloats` are the unit models' vertices as they were read, once: they open the pack's buffer, where the
   * models' own records expect them.
   */
  constructor(
    private readonly textures: TexturePixels,
    unitFloats: readonly number[],
  ) {
    this.floats = [...unitFloats];
  }

  /** A mesh given as plain arrays: three floats a place, a facing and a colour, with its triangles' corners. */
  addPlainMesh(
    kind: MeshKind,
    geometry: {
      positions: ArrayLike<number>;
      normals: ArrayLike<number>;
      colours: ArrayLike<number>;
      indices: Uint32Array;
    },
    placements: readonly Placement[],
    castsShadow: boolean,
  ): void {
    const vertexOffset = this.floats.length;
    const vertexCount = geometry.positions.length / 3;
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      const at = vertex * 3;
      const { positions, normals, colours } = geometry;
      this.floats.push(positions[at], positions[at + 1], positions[at + 2]);
      this.floats.push(normals[at], normals[at + 1], normals[at + 2]);
      this.floats.push(colours[at], colours[at + 1], colours[at + 2], 0, 0, 0);
    }
    this.finishMesh(kind, vertexOffset, vertexCount, geometry.indices, placements, castsShadow, -1);
  }

  /** Every mesh of a loaded model, each under its own texture, placed wherever the model stands. */
  async addModel(kind: MeshKind, model: Object3D, placements: readonly Placement[]): Promise<void> {
    model.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    model.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object);
    });
    for (const mesh of meshes) {
      const material = mesh.material as Material & {
        map?: Texture | null;
        color?: { r: number; g: number; b: number };
      };
      const map = material.map ?? null;
      const vertexOffset = this.floats.length;
      const { positions } = appendModelVertices(this.floats, mesh, material.color ?? { r: 1, g: 1, b: 1 }, map);
      const texture = map ? (await this.textures.read(map)).index : -1;
      this.finishMesh(kind, vertexOffset, positions.length / 3, indicesOf(mesh), placements, true, texture);
    }
  }

  /** The table and buffer the renderer starts from. */
  finish(scene: { light: PackedLight; hexes: readonly PackedHex[]; units: readonly KitModel[] }): PackedScene {
    const hexes = this.appendHexes(scene.hexes);
    const floatBytes = new Uint8Array(new Float32Array(this.floats).buffer);
    const painted = this.textures.all();
    const buffer = new Uint8Array(
      floatBytes.length + painted.reduce((total, texture) => total + texture.pixels.length, 0),
    );
    buffer.set(floatBytes);
    let offset = floatBytes.length;
    const textures = painted.map(({ pixels, size }) => {
      buffer.set(pixels, offset);
      offset += pixels.length;
      return { offset: offset - pixels.length, size };
    });
    const table = {
      meshes: this.meshes,
      floatCount: this.floats.length,
      light: scene.light,
      textures,
      kits: scene.units,
      hexes,
    };
    return { table: JSON.stringify(table), buffer };
  }

  private finishMesh(
    kind: MeshKind,
    vertexOffset: number,
    vertexCount: number,
    indices: Uint32Array,
    placements: readonly Placement[],
    castsShadow: boolean,
    texture: number,
  ): void {
    const indexOffset = this.floats.length;
    // Indices are carried as 32-bit integers in the float buffer's bytes.
    for (const value of new Float32Array(indices.buffer, indices.byteOffset, indices.length)) this.floats.push(value);
    const instanceOffset = this.floats.length;
    for (const placement of placements) this.floats.push(...placement);
    this.meshes.push({
      kind,
      vertexOffset,
      vertexCount,
      indexOffset,
      indexCount: indices.length,
      instanceOffset,
      instanceCount: placements.length,
      castsShadow,
      texture,
    });
  }

  /** Four floats a hex: its middle, its biome's place among the biomes named, and 1 where it is explored. */
  private appendHexes(hexes: readonly PackedHex[]) {
    const named = [...new Map(hexes.map((hex) => [hex.biome, hex.colour])).entries()];
    const offset = this.floats.length;
    for (const hex of hexes) {
      const biome = named.findIndex(([name]) => name === hex.biome);
      this.floats.push(hex.x, hex.z, biome, hex.explored ? 1 : 0);
    }
    return { offset, count: hexes.length, biomes: named.map(([name, colour]) => ({ name, colour })) };
  }
}

function indicesOf(mesh: Mesh): Uint32Array {
  const { index } = mesh.geometry;
  const count = index?.count ?? mesh.geometry.getAttribute("position").count;
  return Uint32Array.from({ length: count }, (_, at) => (index ? index.getX(at) : at));
}

/** What the texture reader asks of the renderer it draws through. */
interface PixelRenderer {
  setRenderTarget(target: RenderTarget | null): void;
  renderAsync(scene: Scene, camera: OrthographicCamera): Promise<void>;
  readRenderTargetPixelsAsync(
    target: RenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<ArrayLike<number>>;
  dispose(): void;
}

/**
 * Reads each texture's pixels, whatever format the GPU holds it in, once per texture: the texture is drawn onto a
 * small target of a WebGL context kept for this, and read back. It is also what tells the model loader which
 * compressed formats the device can take.
 */
export class TexturePixels {
  private readonly material = new MeshBasicMaterial({ toneMapped: false });
  private readonly scene = new Scene().add(new Mesh(new PlaneGeometry(2, 2), this.material));
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly read_: Array<{ texture: Texture; pixels: Uint8Array; size: number }> = [];

  private constructor(
    private readonly renderer: PixelRenderer,
    private readonly size: number,
  ) {}

  /** Opens the reader on WebGL2, which every device the game runs on has. */
  static async open(size: number): Promise<TexturePixels> {
    const renderer = new WebGPURenderer({ forceWebGL: true });
    await renderer.init();
    configureGltfTextureSupport(renderer);
    return new TexturePixels(renderer as unknown as PixelRenderer, size);
  }

  async read(texture: Texture, size = this.size): Promise<KitTexture> {
    const known = this.read_.findIndex((entry) => entry.texture === texture);
    if (known >= 0) return { index: known, ...this.read_[known] };
    const target = new RenderTarget(size, size);
    this.material.map = texture;
    this.material.needsUpdate = true;
    this.renderer.setRenderTarget(target);
    await this.renderer.renderAsync(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    const read = await this.renderer.readRenderTargetPixelsAsync(target, 0, 0, size, size);
    target.dispose();
    const pixels = rowsReversed(Uint8Array.from(read), size);
    this.read_.push({ texture, pixels, size });
    return { index: this.read_.length - 1, pixels, size };
  }

  all(): ReadonlyArray<{ pixels: Uint8Array; size: number }> {
    return this.read_;
  }

  dispose(): void {
    this.material.dispose();
    this.renderer.dispose();
  }
}

/** The renderer reads a target's rows from the bottom up; a texture's pixels go top row first. */
function rowsReversed(pixels: Uint8Array, size: number): Uint8Array {
  const reversed = new Uint8Array(pixels.length);
  for (let row = 0; row < size; row += 1) {
    reversed.set(pixels.subarray(row * size * 4, (row + 1) * size * 4), (size - 1 - row) * size * 4);
  }
  return reversed;
}
