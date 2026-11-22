const COAT = "coat";

export function taperedLimb(joint, from, to, fromRadius, toRadius, blend = 0.04, tag = COAT) {
  return { kind: "limb", joint, from, to, fromRadius, toRadius, blend, tag };
}

export function mass(joint, centre, radii, { pitch = 0, yaw = 0, roll = 0, blend = 0.05, tag = COAT } = {}) {
  return { kind: "mass", joint, centre, radii, pitch, yaw, roll, blend, tag };
}

export function mirrored(solid, joint) {
  const flip = ([x, y, z]) => [-x, y, z];
  return solid.kind === "limb"
    ? { ...solid, joint, from: flip(solid.from), to: flip(solid.to) }
    : { ...solid, joint, centre: flip(solid.centre), yaw: -solid.yaw, roll: -solid.roll };
}

export function bothSides(solid) {
  return [solid, mirrored(solid, solid.joint)];
}

export function chain(joint, sections, blend = 0.05, tag = COAT) {
  return sections.slice(0, -1).map((section, index) => {
    const next = sections[index + 1];
    return taperedLimb(joint, section.slice(0, 3), next.slice(0, 3), section[3], next[3], blend, tag);
  });
}

export function compileVolume(solids) {
  const compiled = solids.map(compileSolid);
  const joints = [...new Set(solids.map((solid) => solid.joint))];
  const byJoint = joints.map((joint) => compiled.filter((solid) => solid.joint === joint));
  return {
    joints,
    bounds: unionBounds(compiled),
    distance(x, y, z) {
      let distance = Infinity;
      for (const solid of compiled) {
        if (!solid.reaches(x, y, z)) continue;
        distance = smoothMinimum(distance, solid.distance(x, y, z), solid.blend);
      }
      return distance;
    },
    tagAt(x, y, z) {
      let nearest = compiled[0];
      let least = Infinity;
      for (const solid of compiled) {
        const distance = solid.distance(x, y, z);
        if (distance < least) [nearest, least] = [solid, distance];
      }
      return nearest.tag;
    },
    jointDistances(x, y, z, out) {
      for (let index = 0; index < byJoint.length; index++) {
        let distance = Infinity;
        for (const solid of byJoint[index]) distance = Math.min(distance, solid.distance(x, y, z));
        out[index] = distance;
      }
      return out;
    },
  };
}

function compileSolid(solid) {
  const distance = solid.kind === "limb" ? limbDistance(solid) : massDistance(solid);
  const reach = solid.blend * 2 + 0.02;
  const [lowX, lowY, lowZ, highX, highY, highZ] = solidBounds(solid);
  return {
    joint: solid.joint,
    tag: solid.tag,
    blend: solid.blend,
    distance,
    bounds: [lowX, lowY, lowZ, highX, highY, highZ],
    reaches: (x, y, z) =>
      x > lowX - reach &&
      x < highX + reach &&
      y > lowY - reach &&
      y < highY + reach &&
      z > lowZ - reach &&
      z < highZ + reach,
  };
}

function limbDistance({ from, to, fromRadius, toRadius }) {
  const [ax, ay, az] = from;
  const bx = to[0] - ax,
    by = to[1] - ay,
    bz = to[2] - az;
  const lengthSquared = bx * bx + by * by + bz * bz;
  const taper = fromRadius - toRadius;
  const slantSquared = lengthSquared - taper * taper;
  const inverse = 1 / lengthSquared;
  return (x, y, z) => {
    const px = x - ax,
      py = y - ay,
      pz = z - az;
    const along = px * bx + py * by + pz * bz;
    const cx = px * lengthSquared - bx * along,
      cy = py * lengthSquared - by * along,
      cz = pz * lengthSquared - bz * along;
    const acrossSquared = cx * cx + cy * cy + cz * cz;
    const beyond = along - lengthSquared;
    const beyondSquared = beyond * beyond * lengthSquared;
    const alongSquared = along * along * lengthSquared;
    const side = Math.sign(taper) * taper * taper * acrossSquared;
    if (Math.sign(beyond) * slantSquared * beyondSquared > side)
      return Math.sqrt(acrossSquared + beyondSquared) * inverse - toRadius;
    if (Math.sign(along) * slantSquared * alongSquared < side)
      return Math.sqrt(acrossSquared + alongSquared) * inverse - fromRadius;
    return (Math.sqrt(acrossSquared * slantSquared * inverse) + along * taper) * inverse - fromRadius;
  };
}

function massDistance({ centre, radii, pitch, yaw, roll }) {
  const [cx, cy, cz] = centre;
  const [rx, ry, rz] = radii;
  const cosPitch = Math.cos(pitch),
    sinPitch = Math.sin(pitch);
  const cosYaw = Math.cos(yaw),
    sinYaw = Math.sin(yaw);
  const cosRoll = Math.cos(roll),
    sinRoll = Math.sin(roll);
  return (x, y, z) => {
    const wx = x - cx,
      wy = y - cy,
      wz = z - cz;
    const yx = wx * cosYaw - wz * sinYaw;
    const tz = wx * sinYaw + wz * cosYaw;
    const py = wy * cosPitch + tz * sinPitch;
    const lz = -wy * sinPitch + tz * cosPitch;
    const tx = yx * cosRoll + py * sinRoll;
    const ly = -yx * sinRoll + py * cosRoll;
    const k0 = Math.hypot(tx / rx, ly / ry, lz / rz);
    if (k0 < 1e-6) return -Math.min(rx, ry, rz);
    const k1 = Math.hypot(tx / (rx * rx), ly / (ry * ry), lz / (rz * rz));
    return (k0 * (k0 - 1)) / k1;
  };
}

function solidBounds(solid) {
  if (solid.kind === "mass") {
    const reach = Math.max(...solid.radii);
    return [...solid.centre.map((value) => value - reach), ...solid.centre.map((value) => value + reach)];
  }
  const reach = Math.max(solid.fromRadius, solid.toRadius);
  return [
    ...solid.from.map((value, axis) => Math.min(value, solid.to[axis]) - reach),
    ...solid.from.map((value, axis) => Math.max(value, solid.to[axis]) + reach),
  ];
}

function unionBounds(compiled) {
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const solid of compiled)
    for (let axis = 0; axis < 3; axis++) {
      bounds[axis] = Math.min(bounds[axis], solid.bounds[axis]);
      bounds[axis + 3] = Math.max(bounds[axis + 3], solid.bounds[axis + 3]);
    }
  return bounds;
}

function smoothMinimum(a, b, blend) {
  if (blend <= 0) return Math.min(a, b);
  const overlap = Math.max(blend - Math.abs(a - b), 0) / blend;
  return Math.min(a, b) - overlap * overlap * blend * 0.25;
}
