import { mirrored } from "./creature-volume.mjs";

const SIDES = [1, -1];

export function sculptBird(anatomy) {
  const joints = [
    { name: "body", parent: null, at: [0, 0, 0], extras: { joint: "body" } },
    { name: "neck", parent: "body", at: anatomy.neck.at, extras: { joint: "neck" } },
    { name: "tail_0", parent: "body", at: anatomy.tail.at, extras: { joint: "tail", segment: 0 } },
  ];
  const solids = [...anatomy.body, ...anatomy.neck.solids, ...anatomy.tail.solids];
  for (const side of SIDES) {
    const [x, y, z] = anatomy.wing.shoulder;
    joints.push({ name: `wing_${side}`, parent: "body", at: [x * side, y, z], extras: { joint: "wing", side } });
    const [fx, fy, fz] = anatomy.foot.at;
    joints.push({
      name: `foot_${side}`,
      parent: "body",
      at: [fx * side, fy, fz],
      extras: { joint: "bird_foot", side, phase: side === 1 ? Math.PI : 0 },
    });
    solids.push(...onSide(anatomy.wing.solids, side), ...onSide(anatomy.foot.solids, side));
  }
  return { joints, solids };
}

function onSide(solids, side) {
  return side === 1 ? solids : solids.map((solid) => mirrored(solid, solid.joint.replace(/_1$/, "_-1")));
}
