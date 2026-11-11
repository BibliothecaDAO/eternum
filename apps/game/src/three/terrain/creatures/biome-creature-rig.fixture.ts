import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";

/** A zebra's rig as its model carries it: a torso on four two-boned legs, with the walk's footfall order. */
export function createZebraRigFixture(): Group {
  const root = new Group();
  root.userData = { animation_schema: "biome-creature-v1", profile: "zebra" };
  const body = new Group();
  body.userData.joint = "body";
  body.add(new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshStandardMaterial()));
  root.add(body);
  const legs = [
    { x: -0.26, z: 0.57, phase: 0, bend: 1 },
    { x: 0.26, z: 0.57, phase: Math.PI, bend: 1 },
    { x: -0.26, z: -0.57, phase: 1.7279, bend: -1 },
    { x: 0.26, z: -0.57, phase: 4.8695, bend: -1 },
  ];
  for (const leg of legs) {
    const hip = new Group();
    hip.position.set(leg.x, 1.08, leg.z);
    hip.userData = {
      joint: "hip",
      phase: leg.phase,
      upperLength: ZEBRA_RIG_UPPER_LEG,
      lowerLength: ZEBRA_RIG_LOWER_LEG,
      bend: leg.bend,
      footHeight: ZEBRA_RIG_FOOT_HEIGHT,
    };
    const knee = new Group();
    knee.position.set(0, -ZEBRA_RIG_UPPER_LEG, 0);
    knee.userData = { joint: "knee" };
    hip.add(knee);
    body.add(hip);
  }
  return root;
}

const ZEBRA_RIG_UPPER_LEG = 0.61;
export const ZEBRA_RIG_LOWER_LEG = 0.59;
export const ZEBRA_RIG_FOOT_HEIGHT = 0.02;
