import { mirrored } from "./creature-volume.mjs";

const SIDES = [1, -1];

export function sculptSwimmer(anatomy) {
  const joints = [{ name: "body", parent: null, at: [0, 0, 0], extras: { joint: "body" } }];
  const solids = [...anatomy.body];
  anatomy.flippers.forEach((flipper, index) => {
    for (const side of SIDES) {
      const [x, y, z] = flipper.at;
      const extras = { joint: "flipper", side, ...(flipper.phase === undefined ? {} : { phase: flipper.phase }) };
      joints.push({ name: `flipper_${index}_${side}`, parent: "body", at: [x * side, y, z], extras });
      solids.push(...onSide(flipper.solids, side));
    }
  });
  for (const part of ["neck", "lure"].filter((name) => anatomy[name])) {
    joints.push({ name: part, parent: "body", at: anatomy[part].at, extras: { joint: part } });
    solids.push(...anatomy[part].solids);
  }
  joints.push(...tailJoints(anatomy.tail.at));
  solids.push(...anatomy.tail.solids);
  return { joints, solids };
}

function tailJoints(sections) {
  return sections.map((at, index) => ({
    name: `tail_${index}`,
    parent: index === 0 ? "body" : `tail_${index - 1}`,
    at,
    extras: { joint: "tail", segment: index },
  }));
}

function onSide(solids, side) {
  return side === 1 ? solids : solids.map((solid) => mirrored(solid, solid.joint.replace(/_1$/, "_-1")));
}
