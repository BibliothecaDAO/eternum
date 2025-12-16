import { BufferAttribute, BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry } from "three";
import { DEFAULT_PATH_CONFIG } from "../types/path";

/**
 * Creates the base quad geometry for path segments.
 * Each quad has 4 vertices forming a ribbon segment.
 *
 * UV layout:
 *   (0,0)──────(1,0)   ← Start of segment
 *     │          │
 *     │   QUAD   │
 *     │          │
 *   (0,1)──────(1,1)   ← End of segment
 *
 * UV.x: 0 = left edge, 1 = right edge (for thickness)
 * UV.y: 0 = segment start, 1 = segment end (for interpolation)
 */
export function createPathQuadGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();

  // 4 vertices for a quad
  // Position is dummy - actual position computed in shader from instance attributes
  const positions = new Float32Array([
    0, 0, 0, // vertex 0 (top-left)
    0, 0, 0, // vertex 1 (top-right)
    0, 0, 0, // vertex 2 (bottom-left)
    0, 0, 0, // vertex 3 (bottom-right)
  ]);

  // UVs encode which corner of the quad this vertex is
  const uvs = new Float32Array([
    0, 0, // vertex 0: left edge, segment start
    1, 0, // vertex 1: right edge, segment start
    0, 1, // vertex 2: left edge, segment end
    1, 1, // vertex 3: right edge, segment end
  ]);

  // Two triangles forming the quad
  const indices = new Uint16Array([
    0, 2, 1, // first triangle
    1, 2, 3, // second triangle
  ]);

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));

  return geometry;
}

/**
 * Instance attribute buffer manager for path segments.
 * Uses Structure of Arrays (SoA) layout for cache efficiency.
 */
export class PathInstanceBuffers {
  readonly maxSegments: number;

  // Instance attributes (SoA layout)
  readonly startPositions: Float32Array; // vec3 per segment
  readonly endPositions: Float32Array; // vec3 per segment
  readonly lengths: Float32Array; // float per segment
  readonly pathProgress: Float32Array; // float per segment (cumulative 0-1)
  readonly colors: Float32Array; // vec3 per segment
  readonly opacities: Float32Array; // float per segment

  // Three.js buffer attributes
  readonly startPositionAttr: InstancedBufferAttribute;
  readonly endPositionAttr: InstancedBufferAttribute;
  readonly lengthAttr: InstancedBufferAttribute;
  readonly pathProgressAttr: InstancedBufferAttribute;
  readonly colorAttr: InstancedBufferAttribute;
  readonly opacityAttr: InstancedBufferAttribute;

  // Tracking
  private activeCount = 0;

  constructor(maxSegments: number = DEFAULT_PATH_CONFIG.maxSegments) {
    this.maxSegments = maxSegments;

    // Allocate typed arrays
    this.startPositions = new Float32Array(maxSegments * 3);
    this.endPositions = new Float32Array(maxSegments * 3);
    this.lengths = new Float32Array(maxSegments);
    this.pathProgress = new Float32Array(maxSegments);
    this.colors = new Float32Array(maxSegments * 3);
    this.opacities = new Float32Array(maxSegments);

    // Create buffer attributes
    this.startPositionAttr = new InstancedBufferAttribute(this.startPositions, 3);
    this.endPositionAttr = new InstancedBufferAttribute(this.endPositions, 3);
    this.lengthAttr = new InstancedBufferAttribute(this.lengths, 1);
    this.pathProgressAttr = new InstancedBufferAttribute(this.pathProgress, 1);
    this.colorAttr = new InstancedBufferAttribute(this.colors, 3);
    this.opacityAttr = new InstancedBufferAttribute(this.opacities, 1);

    // Enable dynamic updates
    this.startPositionAttr.setUsage(35048); // DYNAMIC_DRAW
    this.endPositionAttr.setUsage(35048);
    this.lengthAttr.setUsage(35048);
    this.pathProgressAttr.setUsage(35048);
    this.colorAttr.setUsage(35048);
    this.opacityAttr.setUsage(35048);
  }

  /**
   * Get current active segment count
   */
  get count(): number {
    return this.activeCount;
  }

  /**
   * Set the active segment count and mark buffers for update
   */
  setCount(count: number): void {
    this.activeCount = Math.min(count, this.maxSegments);
  }

  /**
   * Mark all buffers as needing GPU update
   */
  markNeedsUpdate(): void {
    this.startPositionAttr.needsUpdate = true;
    this.endPositionAttr.needsUpdate = true;
    this.lengthAttr.needsUpdate = true;
    this.pathProgressAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.opacityAttr.needsUpdate = true;
  }

  /**
   * Mark only opacity buffer for update (used for visibility changes)
   */
  markOpacityNeedsUpdate(): void {
    this.opacityAttr.needsUpdate = true;
  }

  /**
   * Set segment data at a specific index
   */
  setSegment(
    index: number,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
    length: number,
    progress: number,
    r: number,
    g: number,
    b: number,
    opacity: number,
  ): void {
    if (index >= this.maxSegments) return;

    const i3 = index * 3;

    this.startPositions[i3] = startX;
    this.startPositions[i3 + 1] = startY;
    this.startPositions[i3 + 2] = startZ;

    this.endPositions[i3] = endX;
    this.endPositions[i3 + 1] = endY;
    this.endPositions[i3 + 2] = endZ;

    this.lengths[index] = length;
    this.pathProgress[index] = progress;

    this.colors[i3] = r;
    this.colors[i3 + 1] = g;
    this.colors[i3 + 2] = b;

    this.opacities[index] = opacity;
  }

  /**
   * Set opacity for a range of segments
   */
  setOpacityRange(startIndex: number, count: number, opacity: number): void {
    const end = Math.min(startIndex + count, this.maxSegments);
    for (let i = startIndex; i < end; i++) {
      this.opacities[i] = opacity;
    }
  }

  /**
   * Clear segment (set opacity to 0)
   */
  clearSegment(index: number): void {
    if (index < this.maxSegments) {
      this.opacities[index] = 0;
    }
  }

  /**
   * Dispose of GPU resources
   */
  dispose(): void {
    this.startPositionAttr.array = new Float32Array(0);
    this.endPositionAttr.array = new Float32Array(0);
    this.lengthAttr.array = new Float32Array(0);
    this.pathProgressAttr.array = new Float32Array(0);
    this.colorAttr.array = new Float32Array(0);
    this.opacityAttr.array = new Float32Array(0);
  }
}

/**
 * Creates the complete instanced buffer geometry for path rendering
 */
export function createPathInstancedGeometry(buffers: PathInstanceBuffers): InstancedBufferGeometry {
  const baseGeometry = createPathQuadGeometry();
  const instancedGeometry = new InstancedBufferGeometry();

  // Copy base geometry attributes
  instancedGeometry.setAttribute("position", baseGeometry.getAttribute("position"));
  instancedGeometry.setAttribute("uv", baseGeometry.getAttribute("uv"));
  instancedGeometry.setIndex(baseGeometry.getIndex());

  // Add instance attributes
  instancedGeometry.setAttribute("instanceStart", buffers.startPositionAttr);
  instancedGeometry.setAttribute("instanceEnd", buffers.endPositionAttr);
  instancedGeometry.setAttribute("instanceLength", buffers.lengthAttr);
  instancedGeometry.setAttribute("instancePathProgress", buffers.pathProgressAttr);
  instancedGeometry.setAttribute("instanceColor", buffers.colorAttr);
  instancedGeometry.setAttribute("instanceOpacity", buffers.opacityAttr);

  return instancedGeometry;
}
