export const CANOPY_SILHOUETTE_MIN_RETENTION = 0.65;

const DEFAULT_RESOLUTION = 96;
const PROJECTIONS = Object.freeze({
  front: [0, 1],
  side: [2, 1],
  top: [0, 2],
});

export function extractCanopyGeometry(mesh) {
  const positions = [];
  const indices = [];

  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute("POSITION");
    const windWeight = primitive.getAttribute("_WIND_WEIGHT");
    if (!position) throw new Error(`${mesh.getName()} primitive is missing POSITION`);
    if (!windWeight) throw new Error(`${mesh.getName()} primitive is missing _WIND_WEIGHT`);

    const primitiveIndices = primitive.getIndices();
    const indexCount = primitiveIndices?.getCount() ?? position.getCount();
    for (let index = 0; index < indexCount; index += 3) {
      const triangle = [0, 1, 2].map((offset) => primitiveIndices?.getScalar(index + offset) ?? index + offset);
      const averageWindWeight = triangle.reduce((total, vertex) => total + windWeight.getScalar(vertex), 0) / 3;
      if (averageWindWeight < 0.5) continue;

      for (const vertex of triangle) {
        const point = position.getElement(vertex, [0, 0, 0]);
        positions.push(point[0], point[1], point[2]);
        indices.push(indices.length);
      }
    }
  }

  return { indices: Uint32Array.from(indices), positions: Float32Array.from(positions) };
}

export function measureLodSilhouetteRetention(near, far, resolution = DEFAULT_RESOLUTION) {
  requireTriangleGeometry(near, "near");
  requireTriangleGeometry(far, "far");
  if (!Number.isInteger(resolution) || resolution < 16 || resolution > 512) {
    throw new Error(`Silhouette resolution must be an integer from 16 to 512, received ${String(resolution)}`);
  }

  const retention = Object.fromEntries(
    Object.entries(PROJECTIONS).map(([name, axes]) => {
      const bounds = resolveProjectionBounds(near.positions, far.positions, axes);
      const nearPixels = rasterizeSilhouette(near, axes, bounds, resolution);
      const farPixels = rasterizeSilhouette(far, axes, bounds, resolution);
      return [name, farPixels / Math.max(1, nearPixels)];
    }),
  );
  return { ...retention, minimum: Math.min(retention.front, retention.side, retention.top) };
}

export function assertCanopySilhouetteRetention(id, near, far) {
  const retention = measureLodSilhouetteRetention(near, far);
  if (retention.minimum < CANOPY_SILHOUETTE_MIN_RETENTION) {
    throw new Error(
      `${id} far LOD retains ${(retention.minimum * 100).toFixed(1)}% canopy silhouette coverage, ` +
        `minimum is ${(CANOPY_SILHOUETTE_MIN_RETENTION * 100).toFixed(0)}%`,
    );
  }
  return retention;
}

function rasterizeSilhouette(geometry, axes, bounds, resolution) {
  const pixels = new Uint8Array(resolution * resolution);
  const projected = new Float64Array((geometry.positions.length / 3) * 2);
  for (let vertex = 0; vertex < geometry.positions.length / 3; vertex += 1) {
    projected[vertex * 2] = projectCoordinate(
      geometry.positions[vertex * 3 + axes[0]],
      bounds.minU,
      bounds.maxU,
      resolution,
    );
    projected[vertex * 2 + 1] = projectCoordinate(
      geometry.positions[vertex * 3 + axes[1]],
      bounds.minV,
      bounds.maxV,
      resolution,
    );
  }

  for (let index = 0; index < geometry.indices.length; index += 3) {
    const a = readProjectedVertex(projected, geometry.indices[index]);
    const b = readProjectedVertex(projected, geometry.indices[index + 1]);
    const c = readProjectedVertex(projected, geometry.indices[index + 2]);
    rasterizeTriangle(pixels, resolution, a, b, c);
  }
  return pixels.reduce((total, pixel) => total + pixel, 0);
}

function rasterizeTriangle(pixels, resolution, a, b, c) {
  const minimumX = clampPixel(Math.floor(Math.min(a[0], b[0], c[0])), resolution);
  const maximumX = clampPixel(Math.ceil(Math.max(a[0], b[0], c[0])), resolution);
  const minimumY = clampPixel(Math.floor(Math.min(a[1], b[1], c[1])), resolution);
  const maximumY = clampPixel(Math.ceil(Math.max(a[1], b[1], c[1])), resolution);

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      if (pointInTriangle(x + 0.5, y + 0.5, a, b, c)) pixels[y * resolution + x] = 1;
    }
  }
}

function pointInTriangle(x, y, a, b, c) {
  const first = edgeSign(x, y, a, b);
  const second = edgeSign(x, y, b, c);
  const third = edgeSign(x, y, c, a);
  const hasNegative = first < 0 || second < 0 || third < 0;
  const hasPositive = first > 0 || second > 0 || third > 0;
  return !(hasNegative && hasPositive);
}

function edgeSign(x, y, start, end) {
  return (x - end[0]) * (start[1] - end[1]) - (start[0] - end[0]) * (y - end[1]);
}

function resolveProjectionBounds(nearPositions, farPositions, axes) {
  let minU = Number.POSITIVE_INFINITY;
  let minV = Number.POSITIVE_INFINITY;
  let maxU = Number.NEGATIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;
  for (const positions of [nearPositions, farPositions]) {
    for (let offset = 0; offset < positions.length; offset += 3) {
      minU = Math.min(minU, positions[offset + axes[0]]);
      minV = Math.min(minV, positions[offset + axes[1]]);
      maxU = Math.max(maxU, positions[offset + axes[0]]);
      maxV = Math.max(maxV, positions[offset + axes[1]]);
    }
  }
  const paddingU = Math.max((maxU - minU) * 0.03, 1e-4);
  const paddingV = Math.max((maxV - minV) * 0.03, 1e-4);
  return { maxU: maxU + paddingU, maxV: maxV + paddingV, minU: minU - paddingU, minV: minV - paddingV };
}

function projectCoordinate(value, minimum, maximum, resolution) {
  return ((value - minimum) / Math.max(maximum - minimum, Number.EPSILON)) * (resolution - 1);
}

function readProjectedVertex(projected, vertex) {
  return [projected[vertex * 2], projected[vertex * 2 + 1]];
}

function clampPixel(value, resolution) {
  return Math.min(resolution - 1, Math.max(0, value));
}

function requireTriangleGeometry(geometry, label) {
  if (geometry.positions.length === 0 || geometry.positions.length % 3 !== 0) {
    throw new Error(`${label} silhouette geometry has invalid positions`);
  }
  if (geometry.indices.length === 0 || geometry.indices.length % 3 !== 0) {
    throw new Error(`${label} silhouette geometry has invalid triangle indices`);
  }
}
