import * as THREE from "three";

const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const fract = (x) => x - Math.floor(x);
const QUADS = new Set(["goat", "fox", "rabbit", "moose", "zebra", "deer", "tiger", "tortoise", "salamander"]);

/** Supplied CREATURES / 16 v4 animator; navigation and asset ownership live in terrain-wildlife.ts.
 * @param {THREE.Object3D} root
 * @param {{seed?: number}} options
 */
export function createCreatureAnimator(root, { seed = 0 } = {}) {
  const joints = [],
    hips = [];
  let rig;
  root.traverse((o) => {
    if (o.userData.animation_schema === "biome-creature-v1") rig = o;
    if (o.userData.joint)
      joints.push({ node: o, position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone() });
    if (o.userData.joint === "hip") hips.push(o);
  });
  if (!rig) throw new Error("This object does not contain a biome-creature-v1 hierarchy.");
  const profile = rig.userData.profile;
  const body = joints.find((j) => j.node.userData.joint === "body")?.node;
  if (!body) throw new Error("Creature body joint is missing.");
  const phaseOffset = seed * 2.399963229728653;
  const frequencies = {
    angler: 1.15,
    turtle: 0.55,
    crab: 2.7,
    beetle: 3.4,
    goat: 1.5,
    fox: 2.0,
    penguin: 1.5,
    rabbit: 2,
    tortoise: 0.65,
    moose: 1.15,
    zebra: 1.8,
    deer: 1.75,
    salamander: 1.5,
    scorpion: 1.8,
    tiger: 1.4,
    toucan: 3.2,
  };
  const baseBody = body.position.clone();
  const groundFeet = profile === "penguin" ? createFootGrounding(body, joints) : null;
  const torsoScales = body.children.filter((o) => o.isMesh).map((node) => ({ node, scale: node.scale.clone() }));
  const axis = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  const delta = new THREE.Quaternion();
  const turn = (node, key, angle) => node.quaternion.multiply(delta.setFromAxisAngle(axis[key], angle));
  function reset() {
    for (const j of joints) {
      j.node.position.copy(j.position);
      j.node.quaternion.copy(j.quaternion);
      j.node.scale.copy(j.scale);
    }
    for (const t of torsoScales) t.node.scale.copy(t.scale);
  }
  function update(time, { speed = 1, activity = "move", intensity = 1 } = {}) {
    if (!Number.isFinite(time) || !Number.isFinite(speed) || !Number.isFinite(intensity))
      throw new Error("Animation inputs must be finite.");
    reset();
    const moving = activity === "move";
    const amount = moving ? clamp(Math.abs(speed), 0, 1.5) * clamp(intensity, 0, 1) : 0;
    const phase = time * TAU * frequencies[profile] * Math.max(0.25, Math.abs(speed)) + phaseOffset;
    const breath = Math.sin(time * 2.3 + phaseOffset);
    const idle = Math.sin(time * 0.7 + phaseOffset);
    const swim = profile === "angler" || profile === "turtle";
    let bob = 0;
    if (QUADS.has(profile)) bob = 0.016 * amount * Math.cos(phase * 2);
    if (profile === "rabbit") bob = 0.12 * amount * Math.max(0, Math.sin(phase));
    if (swim) bob = 0.055 * Math.sin(phase * 0.5);
    if (profile === "penguin") {
      bob = 0.025 * amount * (1 + Math.sin(phase * 2));
      turn(body, "z", 0.055 * amount * Math.sin(phase));
    }
    if (profile === "toucan") {
      bob = moving ? 0.065 * Math.sin(phase * 0.5) : -0.44 + 0.008 * breath;
    }
    body.position.y = baseBody.y + bob;
    // Torso meshes breathe without scaling hip locations or limb lengths.
    for (const child of body.children)
      if (child.isMesh) {
        child.scale.y *= 1 + 0.004 * breath;
        child.scale.x *= 1 + 0.003 * breath;
      }
    if (QUADS.has(profile)) {
      for (const hip of hips) {
        const knee = hip.children.find((c) => c.userData.joint === "knee");
        if (!knee) continue;
        const l1 = hip.userData.upperLength,
          l2 = hip.userData.lowerLength;
        const legPhase = profile === "rabbit" ? (hip.position.z > 0 ? Math.PI : 0) : hip.userData.phase;
        const cycle = fract((phase + legPhase) / TAU);
        const stance = 0.64;
        const stride = (l1 + l2) * (profile === "tortoise" ? 0.26 : 0.43) * amount;
        let footZ, lift;
        if (cycle < stance) {
          footZ = stride * (0.5 - cycle / stance);
          lift = 0;
        } else {
          const swing = (cycle - stance) / (1 - stance);
          const tangent = -(1 - stance) / stance;
          const travel = (tangent * 2 - 2) * swing ** 3 + (3 - 3 * tangent) * swing ** 2 + tangent * swing;
          footZ = stride * (-0.5 + travel);
          lift = Math.sin(swing * Math.PI) ** 2 * (l1 + l2) * 0.17 * amount;
        }
        if (!moving || speed === 0) {
          footZ = 0;
          lift = 0;
        }
        // Feet stay in root-local ground coordinates while the body bobs.
        const footY = -hip.position.y - bob + 0.02 + lift;
        const d = clamp(Math.hypot(footY, footZ), Math.abs(l1 - l2) + 0.0001, l1 + l2 - 0.0001);
        const bend = hip.userData.bend || 1;
        const aim = Math.atan2(-footZ, -footY);
        const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
        const b = Math.PI - Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
        hip.quaternion.setFromAxisAngle(axis.x, aim + bend * a);
        knee.quaternion.setFromAxisAngle(axis.x, -bend * b);
      }
    }
    for (const { node: node } of joints) {
      const u = node.userData,
        side = u.side || 1;
      switch (u.joint) {
        case "neck":
          turn(node, "y", 0.03 * idle);
          turn(node, "x", 0.014 * breath + 0.018 * amount * Math.sin(phase));
          break;
        case "tail": {
          const amp = swim ? 0.18 : profile === "salamander" ? 0.15 : 0.055;
          turn(node, "y", amp * Math.sin(phase - (u.segment || 0) * 0.75) * (moving ? Math.max(amount, 0.25) : 0.25));
          break;
        }
        case "flipper":
          turn(node, "z", side * (0.28 * Math.sin(phase + (u.phase || 0)) * (moving ? Math.max(amount, 0.2) : 0.15)));
          turn(node, "x", 0.08 * Math.cos(phase));
          break;
        case "lure":
          turn(node, "x", 0.09 * Math.sin(time * 1.6));
          turn(node, "z", 0.06 * idle);
          break;
        case "splay_leg":
          turn(node, "y", 0.18 * amount * Math.sin(phase + u.phase));
          turn(node, "z", side * 0.16 * amount * Math.max(0, Math.cos(phase + u.phase)));
          break;
        case "splay_knee":
          turn(node, "z", -side * 0.22 * amount * Math.max(0, Math.cos(phase + u.phase)));
          break;
        case "claw":
          turn(node, "x", 0.1 * Math.sin(time * 1.4 + side));
          break;
        case "pincer":
          turn(node, "y", side * (0.13 + 0.11 * Math.sin(time * 1.7 + side)));
          break;
        case "stinger":
          turn(node, "x", 0.05 * Math.sin(time * 1.4 - u.segment * 0.5));
          turn(node, "y", 0.045 * Math.sin(time * 0.8 - u.segment * 0.5));
          break;
        case "wing":
          if (profile === "toucan") {
            if (moving) turn(node, "z", side * 0.65 * Math.sin(phase));
            else {
              turn(node, "y", side * 1.3);
              turn(node, "z", -side * 0.12);
            }
          } else {
            turn(node, "z", side * (0.08 + 0.09 * amount * Math.sin(phase)));
            turn(node, "x", 0.08 * amount * Math.cos(phase));
          }
          break;
        case "bird_foot":
          turn(
            node,
            "x",
            profile === "penguin" ? 0.27 * amount * Math.sin(phase + u.phase) : 0.08 * Math.sin(time * 1.6 + side),
          );
          if (profile === "penguin") node.position.y += 0.07 * amount * Math.max(0, Math.cos(phase + u.phase));
          break;
      }
    }
    root.updateMatrixWorld(true);
    if (groundFeet) {
      groundFeet();
      root.updateMatrixWorld(true);
    }
    return root;
  }
  return { root, rig, profile, joints: joints.map((j) => j.node), update, reset };
}

/** Keep one sole planted as the body rocks and the other foot swings. */
function createFootGrounding(body, joints) {
  const soles = [];
  for (const { node } of joints) {
    if (node.userData.joint !== "bird_foot") continue;
    node.traverse((part) => {
      if (part.isMesh) soles.push(part);
    });
  }
  if (soles.length === 0) throw new Error("Walking bird has no foot geometry.");
  const parentInverse = new THREE.Matrix4();
  const transform = new THREE.Matrix4();
  const vertex = new THREE.Vector3();
  return () => {
    parentInverse.copy(body.parent.matrixWorld).invert();
    let lowest = Infinity;
    for (const sole of soles) {
      transform.multiplyMatrices(parentInverse, sole.matrixWorld);
      const positions = sole.geometry.getAttribute("position");
      for (let index = 0; index < positions.count; index++) {
        vertex.fromBufferAttribute(positions, index).applyMatrix4(transform);
        lowest = Math.min(lowest, vertex.y);
      }
    }
    body.position.y -= lowest;
  };
}
