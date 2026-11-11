import sharp from "sharp";

/**
 * A study sheet of one built creature, standing as the game stands it: flank, three-quarter, front and the world map's
 * view from above. Drawn here on the CPU so a shape can be judged in seconds; the lab remains the proof of the model
 * the game loads.
 */
export async function writeStudySheet(path, creature, { tile = 560 } = {}) {
  const posed = poseStanding(creature);
  const views = [
    [1, 0.06, 0.02],
    [0.62, 0.3, 0.72],
    [0.05, 0.12, 1],
    [0, 0.77, 0.64],
  ];
  const frame = framing(posed.positions);
  const tiles = views.map((towardCamera) => drawView(creature, posed, towardCamera, frame, tile));
  const sheet = sharp({ create: { width: tile * 2, height: tile * 2, channels: 3, background: "#8f9a78" } });
  await sheet
    .composite(
      tiles.map((pixels, index) => ({
        input: pixels,
        raw: { width: tile, height: tile, channels: 3 },
        left: (index % 2) * tile,
        top: Math.floor(index / 2) * tile,
      })),
    )
    .png()
    .toFile(path);
}

/** The pose the animator gives a stopped animal: each leg bent just enough for its foot to rest on the ground. */
function poseStanding(creature) {
  const angles = new Map();
  for (const hip of creature.joints.filter((joint) => joint.extras.joint === "hip")) {
    const knee = creature.joints.find((joint) => joint.parent === hip.name);
    const { upperLength: upper, lowerLength: lower, bend, footHeight } = hip.extras;
    const reach = Math.min(hip.at[1] - footHeight, upper + lower - 1e-4);
    const atHip = Math.acos((upper * upper + reach * reach - lower * lower) / (2 * upper * reach));
    const atKnee = Math.PI - Math.acos((upper * upper + lower * lower - reach * reach) / (2 * upper * lower));
    angles.set(hip.name, bend * atHip);
    angles.set(knee.name, -bend * atKnee);
  }
  return skinToPose(creature, angles);
}

/** Skins the mesh to joints turned about X, the one axis a standing pose needs. */
function skinToPose(creature, angles) {
  const placed = [];
  creature.joints.forEach((joint, index) => {
    const parent = placed[creature.joints.findIndex((candidate) => candidate.name === joint.parent)];
    const offset = joint.at.map((value, axis) => value - (parent ? parent.joint.at[axis] : 0));
    const parentAngle = parent ? parent.angle : 0;
    const [, y, z] = turnAboutX(offset, parentAngle);
    placed[index] = {
      joint,
      angle: parentAngle + (angles.get(joint.name) ?? 0),
      at: parent ? [parent.at[0] + offset[0], parent.at[1] + y, parent.at[2] + z] : joint.at,
    };
  });
  const { positions, normals } = creature.mesh;
  const posedPositions = new Float32Array(positions.length);
  const posedNormals = new Float32Array(normals.length);
  for (let vertex = 0; vertex < positions.length / 3; vertex++) {
    const point = [0, 0, 0];
    const normal = [0, 0, 0];
    for (let slot = 0; slot < 4; slot++) {
      const weight = creature.skin.weights[vertex * 4 + slot];
      if (weight === 0) continue;
      const { joint, angle, at } = placed[creature.skin.joints[vertex * 4 + slot]];
      const local = [0, 1, 2].map((axis) => positions[vertex * 3 + axis] - joint.at[axis]);
      const turned = turnAboutX(local, angle);
      const turnedNormal = turnAboutX([normals[vertex * 3], normals[vertex * 3 + 1], normals[vertex * 3 + 2]], angle);
      for (let axis = 0; axis < 3; axis++) {
        point[axis] += weight * (at[axis] + turned[axis]);
        normal[axis] += weight * turnedNormal[axis];
      }
    }
    posedPositions.set(point, vertex * 3);
    posedNormals.set(normal, vertex * 3);
  }
  return { positions: posedPositions, normals: posedNormals };
}

function turnAboutX([x, y, z], angle) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  return [x, y * cos - z * sin, y * sin + z * cos];
}

function framing(positions) {
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < positions.length; offset++) {
    low[offset % 3] = Math.min(low[offset % 3], positions[offset]);
    high[offset % 3] = Math.max(high[offset % 3], positions[offset]);
  }
  const centre = low.map((value, axis) => (value + high[axis]) / 2);
  return { centre, span: Math.hypot(...high.map((value, axis) => value - low[axis])) };
}

const LIGHT = normalise([0.45, 0.8, 0.4]);

function drawView(creature, posed, towardCamera, frame, size) {
  const forward = normalise(towardCamera);
  const right = normalise(cross([0, 1, 0], forward));
  const up = cross(forward, right);
  const scale = (size * 1.2) / frame.span;
  const pixels = Buffer.alloc(size * size * 3);
  for (let offset = 0; offset < pixels.length; offset += 3) pixels.set([143, 154, 120], offset);
  const depth = new Float32Array(size * size).fill(-Infinity);
  const project = (vertex) => {
    const point = [0, 1, 2].map((axis) => posed.positions[vertex * 3 + axis] - frame.centre[axis]);
    return [size / 2 + dot(point, right) * scale, size / 2 - dot(point, up) * scale, dot(point, forward)];
  };
  const shade = (vertex) => {
    const normal = normalise([0, 1, 2].map((axis) => posed.normals[vertex * 3 + axis]));
    const light = 0.42 + 0.7 * Math.max(0, dot(normal, LIGHT)) + 0.12 * Math.max(0, normal[1]);
    return [0, 1, 2].map((channel) => creature.mesh.colours[vertex * 3 + channel] * light);
  };
  const { indices } = creature.mesh;
  for (let corner = 0; corner < indices.length; corner += 3) {
    const [a, b, c] = [indices[corner], indices[corner + 1], indices[corner + 2]];
    const [pa, pb, pc] = [project(a), project(b), project(c)];
    const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
    if (Math.abs(area) < 1e-9) continue;
    const [ca, cb, cc] = [shade(a), shade(b), shade(c)];
    const uvs = [a, b, c].map((vertex) => [creature.mesh.uvs[vertex * 2], creature.mesh.uvs[vertex * 2 + 1]]);
    const minX = Math.max(0, Math.floor(Math.min(pa[0], pb[0], pc[0])));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(pa[0], pb[0], pc[0])));
    const minY = Math.max(0, Math.floor(Math.min(pa[1], pb[1], pc[1])));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(pa[1], pb[1], pc[1])));
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const wa = ((pb[0] - x) * (pc[1] - y) - (pb[1] - y) * (pc[0] - x)) / area;
        const wb = ((pc[0] - x) * (pa[1] - y) - (pc[1] - y) * (pa[0] - x)) / area;
        const wc = 1 - wa - wb;
        if (wa < 0 || wb < 0 || wc < 0) continue;
        const z = wa * pa[2] + wb * pb[2] + wc * pc[2];
        if (z <= depth[y * size + x]) continue;
        depth[y * size + x] = z;
        const coat = creature.coat
          ? creature.coat(
              wa * uvs[0][0] + wb * uvs[1][0] + wc * uvs[2][0],
              wa * uvs[0][1] + wb * uvs[1][1] + wc * uvs[2][1],
            )
          : [1, 1, 1];
        for (let channel = 0; channel < 3; channel++) {
          const linear = (wa * ca[channel] + wb * cb[channel] + wc * cc[channel]) * coat[channel];
          pixels[(y * size + x) * 3 + channel] = Math.round(255 * Math.min(1, Math.max(0, linear)) ** (1 / 2.2));
        }
      }
  }
  return pixels;
}

function normalise(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
