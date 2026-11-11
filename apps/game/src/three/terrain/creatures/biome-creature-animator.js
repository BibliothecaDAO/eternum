import * as THREE from "three";

const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const fract = (x) => x - Math.floor(x);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (x) => x * x * (3 - 2 * x);

/**
 * How each four-legged rig carries itself. `stride` is the ground a planted foot covers, as a share of the leg's
 * length, and `duty` the share of a step it stays planted: together they fix how far one step carries the body, so a
 * foot on the ground never slides. `extension` is how straight the standing leg is at least (a rig authored crouched is
 * lifted to it),
 * `nod` the head's swing in step. The rest are radians: `forage` drops the neck to the ground, `sit` drops the
 * haunches, `upright` lifts the forequarters to look out, `undulation` bends the body with the step; `hop` is the
 * height of a bound, `tuck` how far the body sinks into its shell and `lie` how far it sinks to lie down, as shares of
 * the leg. One that `gallops` changes gait to run, with its own `gallop` if the common one does not suit it; one with
 * a `runStride` lengthens its stride that many times instead.
 */
const QUADRUPEDS = {
  goat: { stride: 0.46, duty: 0.64, extension: 0.94, nod: 0.05, forage: 1.0, lie: 0.6, gallops: true },
  fox: {
    stride: 0.5,
    duty: 0.58,
    extension: 0.92,
    nod: 0.03,
    forage: 0.75,
    sit: 0.5,
    gallops: true,
    // Small and quick: it covers ground in long bounds, not a blur of steps, and hunts mice by leaping on them.
    gallop: { stride: 0.7, duty: 0.22 },
    pounces: true,
  },
  rabbit: { stride: 0.8, duty: 0.45, nod: 0, forage: 0.45, hop: 0.3, upright: 0.5, lie: 0.45, runStride: 1.8 },
  moose: { stride: 0.44, duty: 0.64, extension: 0.95, nod: 0.06, forage: 0.95, lie: 0.62, gallops: true },
  zebra: { stride: 0.46, duty: 0.64, extension: 0.95, nod: 0.06, forage: 1.15, lie: 0.62, gallops: true },
  deer: { stride: 0.46, duty: 0.64, extension: 0.95, nod: 0.05, forage: 1.1, lie: 0.62, gallops: true },
  tiger: { stride: 0.5, duty: 0.62, extension: 0.92, nod: 0.03, forage: 0.5, sit: 0.42, gallops: true },
  tortoise: { stride: 0.5, duty: 0.75, nod: 0, forage: 0.3, tuck: 0.55 },
  salamander: { stride: 0.9, duty: 0.6, nod: 0, forage: 0, undulation: 0.16 },
};
/**
 * The gallop: a longer stride on a foot that is planted for less of it, the body carried lower, and the feet falling
 * hind pair then fore pair, each a moment apart, with all four off the ground between.
 */
const GALLOP = { stride: 0.55, duty: 0.3, crouch: 0.06, bound: 0.045 };
const GALLOP_PHASES = { hindLeft: 0.5 * TAU, hindRight: 0.42 * TAU, foreLeft: 0.08 * TAU, foreRight: 0 };
/** The pace, as a multiple of the walk, at which a run begins and by which it is in full stride. */
const RUN_FROM = 1.25;
const RUN_BY = 2.1;
/** A stalking hunter carries itself this much of a leg lower, head down and level with its back. */
const PROWL_CROUCH = 0.14;
/** A pounce, as shares of its seconds: the crouch before the leap, and the leap itself. */
const POUNCE = { every: 6, seconds: 1.5, crouch: 0.3, height: 1.15 };
/** How far the head turns to follow what the animal watches, in radians. */
const GAZE_REACH = 1.3;
/** The ground one gait cycle covers for every other rig, in the model's own units. */
const CYCLE_LENGTHS = { angler: 0.8, turtle: 2.2, crab: 0.5, beetle: 0.45, scorpion: 0.5, penguin: 0.36, toucan: 1 };
/** How far a splayed leg reaches from its hip, in the model's units: with the cycle it sets the leg's swing. */
const SPLAY_REACH = 0.5;
const SPLAY_DUTY = 0.5;
/** A flier's wingbeats per second, and how far its body sits below its flying height when perched. */
const WINGBEATS = 3.2;
const PERCH_DROP = 0.44;
const IDLE_ACTIONS = ["forage", "watch", "rest"];

/**
 * Poses one biome creature from how it is moving; navigation and asset ownership live in terrain-wildlife.ts. Steps
 * follow the ground covered, never the clock, so every gait keeps pace with its animal.
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
  const quadruped = QUADRUPEDS[profile];
  const legs = quadruped ? createLegs(hips, profile) : [];
  for (const leg of legs) leg.toGallop = turnToGallop(leg);
  const stance = legs.length > 0 ? createStance(legs, quadruped) : null;
  const cycleLength = stance ? stance.cycleLength : CYCLE_LENGTHS[profile];
  if (!(cycleLength > 0)) throw new Error(`Creature profile has no gait: ${profile}`);
  const phaseOffset = seed * 2.399963229728653;
  const baseBody = body.position.clone();
  const groundFeet = profile === "penguin" ? createFootGrounding(body, joints) : null;
  const torsoScales = body.children.filter((o) => o.isMesh).map((node) => ({ node, scale: node.scale.clone() }));
  const axis = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  const delta = new THREE.Quaternion();
  const turn = (node, key, angle) => node.quaternion.multiply(delta.setFromAxisAngle(axis[key], angle));
  /** How far into each behaviour the animal is, eased so no pose is ever cut to. */
  const weights = { move: 0, run: 0, gazing: 0, prowl: 0, forage: 0, watch: 0, rest: 0 };
  let lastTime;
  /** Where the gait is in its cycle, advanced by the ground covered at the gait's own length of step. */
  let phase = phaseOffset;
  let lastDistance = 0;
  let look = 0;

  function reset() {
    for (const j of joints) {
      j.node.position.copy(j.position);
      j.node.quaternion.copy(j.quaternion);
      j.node.scale.copy(j.scale);
    }
    for (const t of torsoScales) t.node.scale.copy(t.scale);
  }

  function easeWeights(time, pace, action, gaze, stealth) {
    const dt = lastTime === undefined ? Infinity : clamp(time - lastTime, 0, 0.1);
    lastTime = time;
    weights.move += (clamp(pace * 2, 0, 1) - weights.move) * (1 - Math.exp(-8 * dt));
    weights.run += (clamp((pace - RUN_FROM) / (RUN_BY - RUN_FROM), 0, 1) - weights.run) * (1 - Math.exp(-5 * dt));
    weights.gazing += ((gaze === null ? 0 : 1) - weights.gazing) * (1 - Math.exp(-4 * dt));
    weights.prowl += ((stealth ? 1 : 0) - weights.prowl) * (1 - Math.exp(-3 * dt));
    if (gaze !== null) look += (clamp(gaze, -GAZE_REACH, GAZE_REACH) - look) * (1 - Math.exp(-5 * dt));
    const settle = 1 - Math.exp(-2.5 * dt);
    for (const key of IDLE_ACTIONS) weights[key] += ((pace < 0.05 && action === key ? 1 : 0) - weights[key]) * settle;
  }

  /**
   * @param {number} time seconds, for breathing and idle motion only
   * @param {{distance?: number, pace?: number, turn?: number, action?: string, lift?: number, gaze?: number | null,
   * stealth?: boolean}}
   * motion `distance` is the ground the legs have covered in the model's units, `pace` its speed as a multiple of its
   * walk, `turn` radians per second, `action` what it does when stopped, `lift` how far a flier is off its perch,
   * `gaze` the way to what it watches, in radians from straight ahead, `stealth` whether it is stalking
   */
  function update(
    time,
    { distance = 0, pace = 0, turn: turnRate = 0, action = "stand", lift = 0, gaze = null, stealth = false } = {},
  ) {
    if (![time, distance, pace, turnRate, lift, gaze ?? 0].every(Number.isFinite))
      throw new Error("Animation inputs must be finite.");
    reset();
    easeWeights(time, pace, action, gaze, stealth);
    const { move, run, gazing, prowl, forage, watch, rest } = weights;
    const galloping = quadruped && quadruped.gallops ? run : 0;
    const gallop = (quadruped && quadruped.gallop) || GALLOP;
    const walkStride = stance ? stance.stride * (1 + ((quadruped.runStride || 1) - 1) * run) : 0;
    const strideNow = stance ? mix(walkStride, gallop.stride * stance.legLength, galloping) : 0;
    const dutyNow = quadruped ? mix(quadruped.duty, gallop.duty, galloping) : 0;
    const pounce = quadruped && quadruped.pounces ? pounceAt(time + phaseOffset) * forage : 0;
    phase += (TAU * (distance - lastDistance)) / (stance ? strideNow / dutyNow : cycleLength);
    lastDistance = distance;
    const breath = Math.sin(time * 2.3 + phaseOffset);
    const idle = Math.sin(time * 0.7 + phaseOffset);
    // A slow look to one side, a hold, then the other.
    const scanWave = Math.sin(time * 0.55 + phaseOffset);
    const scan = Math.sign(scanWave) * Math.sqrt(Math.abs(scanWave));
    const bank = clamp(-turnRate * 0.22, -0.4, 0.4);
    const air = smooth(clamp(lift, 0, 1));
    const swims = profile === "angler" || profile === "turtle";
    // Swimmers scull gently when they hold station: their stroke never quite stops.
    const stroke = swims ? phase + time * (profile === "turtle" ? 0.9 : 1.6) : phase;
    const effort = swims ? mix(0.35, 1, move) : move;

    let rise = 0;
    let pitch = 0;
    let roll = 0;
    let wag = 0;
    let pivotZ = 0;
    if (stance) {
      const bound = quadruped.hop ? Math.max(0, Math.sin(phase + 0.5)) : 0;
      rise = stance.raise - 0.012 * stance.legLength * move * (1 - galloping) * Math.cos(phase * 2);
      rise += (quadruped.hop || 0) * stance.legLength * move * bound;
      // At a gallop the body rides low and rises once a stride, as the hind feet drive it.
      rise += stance.legLength * galloping * (GALLOP.bound * Math.sin(phase + 2.2) - GALLOP.crouch);
      rise -= ((quadruped.tuck || 0) + (quadruped.lie || 0)) * stance.hipHeight * rest;
      // Sitting up, it settles onto its haunches.
      rise -= quadruped.upright ? 0.3 * stance.hipHeight * watch : 0;
      rise -= PROWL_CROUCH * stance.legLength * prowl;
      // The pounce: it gathers itself, springs high and comes down nose first.
      rise += stance.legLength * (pounce < 0 ? 0.12 * pounce : POUNCE.height * Math.sin(Math.PI * pounce));
      // Reaching for the ground, the shoulders dip with the neck.
      pitch = 0.012 * move * (1 - galloping) * Math.sin(phase * 2) + 0.07 * forage * Math.sign(quadruped.forage);
      pitch += 0.085 * galloping * Math.sin(phase + 0.6);
      pitch += pounce > 0 ? 1.1 * (pounce - 0.4) * Math.sin(Math.PI * pounce) : 0;
      pitch -= quadruped.hop ? 0.2 * move * Math.cos(phase + 0.5) : 0;
      pitch -= (quadruped.sit || 0) * rest + (quadruped.upright || 0) * watch;
      // Haunches drop about the shoulders; forequarters lift, or dip to feed, about the hips. Each leaves the other
      // pair of feet standing where they were.
      pivotZ = stance.rearZ * forage + (quadruped.sit ? stance.frontZ * rest : 0);
      pivotZ += quadruped.upright ? stance.rearZ * watch : 0;
      roll = 0.022 * move * Math.sin(phase);
      wag = (quadruped.undulation || 0) * move * Math.sin(phase);
    }
    if (swims) {
      rise = 0.04 * Math.sin(stroke * 0.5) + 0.07 * watch;
      pitch = 0.05 * effort * Math.sin(stroke - 1) - 0.2 * watch;
      roll = bank;
      if (profile === "angler") wag = 0.07 * effort * Math.sin(stroke);
    }
    if (profile === "penguin") {
      rise = 0.025 * move * (1 + Math.sin(phase * 2));
      roll = 0.09 * move * Math.sin(phase);
    }
    if (profile === "toucan") {
      const hop = 0.06 * move * (1 - air) * Math.abs(Math.sin(time * 9));
      rise = mix(-PERCH_DROP + 0.008 * breath + hop, 0.05 * Math.sin(time * TAU * WINGBEATS), air);
      pitch = -0.12 * air * (1 - move);
      roll = bank * air;
    }
    if (profile === "crab" || profile === "beetle" || profile === "scorpion") {
      rise = 0.012 * move * Math.sin(phase * 2) + 0.01 * breath;
      pitch = profile === "crab" ? -0.1 * watch : 0;
    }
    // The body tips about a point at hip height, so it rocks in place rather than swinging round its feet.
    const pivotY = stance ? stance.hipHeight : 0;
    const cos = Math.cos(pitch),
      sin = Math.sin(pitch);
    const offsetY = rise + pivotY - (pivotY * cos - pivotZ * sin);
    const offsetZ = pivotZ - (pivotY * sin + pivotZ * cos);
    body.position.y = baseBody.y + offsetY;
    body.position.z = baseBody.z + offsetZ;
    turn(body, "x", pitch);
    turn(body, "z", roll);
    turn(body, "y", wag);
    // Torso meshes breathe without scaling hip locations or limb lengths.
    for (const child of body.children)
      if (child.isMesh) {
        child.scale.y *= 1 + 0.004 * breath;
        child.scale.x *= 1 + 0.003 * breath;
      }

    for (const leg of legs) {
      const length = leg.upper + leg.lower;
      const cycle = fract((phase + leg.phase + leg.toGallop * galloping) / TAU);
      const stride = strideNow;
      let footZ, footLift;
      if (cycle < dutyNow) {
        footZ = stride * (0.5 - cycle / dutyNow);
        footLift = 0;
      } else {
        const swing = (cycle - dutyNow) / (1 - dutyNow);
        const tangent = -(1 - dutyNow) / dutyNow;
        const travel = (tangent * 2 - 2) * swing ** 3 + (3 - 3 * tangent) * swing ** 2 + tangent * swing;
        footZ = stride * (-0.5 + travel);
        // A stopped animal sets its foot down where it is: the step is held, never snapped back under the hip.
        footLift = Math.sin(swing * Math.PI) ** 2 * length * 0.17 * move * (1 + 0.8 * galloping);
      }
      // The foot stays on the ground under the hip's resting place while the body above it bobs, tips and sits.
      const hipY = offsetY + leg.rest.y * cos - leg.rest.z * sin;
      const hipZ = offsetZ + leg.rest.y * sin + leg.rest.z * cos;
      // In the air of a pounce the legs are gathered up under the body.
      const gathered = pounce > 0 ? 0.6 * length * Math.sin(Math.PI * pounce) : 0;
      const reachY = leg.footHeight + footLift + gathered - hipY;
      const reachZ = leg.rest.z + footZ - hipZ;
      const localY = reachY * cos + reachZ * sin;
      const localZ = -reachY * sin + reachZ * cos;
      const d = clamp(Math.hypot(localY, localZ), Math.abs(leg.upper - leg.lower) + 0.0001, length - 0.0001);
      const aim = Math.atan2(-localZ, -localY);
      const a = Math.acos(clamp((leg.upper ** 2 + d * d - leg.lower ** 2) / (2 * leg.upper * d), -1, 1));
      const b =
        Math.PI - Math.acos(clamp((leg.upper ** 2 + leg.lower ** 2 - d * d) / (2 * leg.upper * leg.lower), -1, 1));
      // Sitting up, the forelegs leave the ground and fold against the chest.
      const tucked = leg.front && quadruped.upright ? watch : 0;
      leg.hip.quaternion.setFromAxisAngle(axis.x, mix(aim + leg.bend * a, -pitch - 0.5, tucked));
      leg.knee.quaternion.setFromAxisAngle(axis.x, mix(-leg.bend * b, 1.7, tucked));
    }

    for (const { node: node } of joints) {
      const u = node.userData,
        side = u.side || 1;
      switch (u.joint) {
        case "neck": {
          const reach = quadruped ? quadruped.forage : profile === "penguin" ? 0.6 : profile === "toucan" ? 0.55 : 0;
          const nibble = 1 + 0.05 * Math.sin(time * 5.5 + phaseOffset);
          const nod = quadruped ? quadruped.nod * move * Math.sin(phase * 2 + 0.6) : 0.018 * move * Math.sin(phase);
          // Watching, it scans from side to side; with something to watch, its head follows that instead.
          const watching = mix(0.55 * watch * scan, look, gazing);
          turn(node, "y", 0.03 * idle + watching + clamp(turnRate * 0.12, -0.3, 0.3) * move);
          // The head stays level while the body under it tips, and reaches forward at a gallop.
          const carriage = 0.3 * Math.max(galloping, prowl) - 0.1 * watch * (1 - galloping) - pitch * 0.85;
          turn(node, "x", 0.014 * breath + nod + reach * forage * nibble + carriage);
          if (quadruped && quadruped.tuck) node.position.z -= 0.22 * rest;
          break;
        }
        case "tail": {
          const segment = u.segment || 0;
          if (swims || profile === "salamander") {
            const amp = swims ? 0.2 : 0.17;
            turn(node, "y", amp * Math.sin(stroke - 0.8 - segment * 0.75) * Math.max(effort, 0.2));
          } else {
            // Walking, the tail swings with the hips; standing, it hangs and flicks now and then.
            const flick = Math.max(0, Math.sin(time * 0.9 + phaseOffset)) ** 6;
            const standing = Math.sin(time * 6 + phaseOffset - segment * 0.75) * (0.2 + 0.8 * flick);
            turn(node, "y", 0.07 * mix(standing, Math.sin(phase - segment * 0.75), move));
            // The tail streams out behind a running animal.
            turn(node, "x", segment === 0 ? 0.9 * run - 0.5 * pitch : 0);
          }
          break;
        }
        case "flipper": {
          const power = (u.phase || 0) === 0 ? 1 : 0.4;
          const beat = profile === "turtle" ? 0.45 * power : 0.28;
          turn(node, "z", side * beat * Math.sin(stroke + (u.phase || 0)) * Math.max(effort, 0.3));
          turn(node, "x", 0.5 * beat * Math.cos(stroke + (u.phase || 0)) * Math.max(effort, 0.3));
          break;
        }
        case "lure":
          turn(node, "x", 0.09 * Math.sin(time * 1.6) + 0.12 * watch * Math.sin(time * 5));
          turn(node, "z", 0.06 * idle);
          break;
        case "splay_leg":
        case "splay_knee": {
          const cycle = fract((phase + u.phase) / TAU);
          const swing = (cycle - SPLAY_DUTY) / (1 - SPLAY_DUTY);
          // +0.5 where the foot lands, -0.5 where it lifts off.
          const sweep = cycle < SPLAY_DUTY ? 0.5 - cycle / SPLAY_DUTY : smooth(swing) - 0.5;
          const footLift = cycle < SPLAY_DUTY ? 0 : Math.sin(swing * Math.PI) * move;
          const reach = (cycleLength * SPLAY_DUTY) / SPLAY_REACH;
          if (u.joint === "splay_knee") {
            // A crab's legs reach out to the side it travels and fold in behind.
            if (profile === "crab") turn(node, "z", 0.7 * reach * sweep);
            turn(node, "z", -side * 0.25 * footLift);
          } else {
            if (profile === "crab") turn(node, "z", -0.35 * reach * sweep);
            else turn(node, "y", -side * reach * sweep);
            turn(node, "z", side * 0.28 * footLift);
          }
          break;
        }
        case "claw":
          turn(node, "x", 0.1 * Math.sin(time * 1.4 + side) - 0.45 * watch);
          turn(node, "x", 0.4 * forage * Math.max(0, Math.sin(time * 3 + side * 1.6)));
          break;
        case "pincer":
          turn(node, "y", side * (0.13 + 0.11 * Math.sin(time * 1.7 + side) + 0.2 * watch));
          break;
        case "stinger":
          turn(node, "x", 0.05 * Math.sin(time * 1.4 - u.segment * 0.5) + 0.07 * watch);
          turn(node, "y", 0.045 * Math.sin(time * 0.8 - u.segment * 0.5));
          break;
        case "wing":
          if (profile === "toucan") {
            // Folded along the body on the perch, spread and beating in the air.
            turn(node, "y", side * 1.3 * (1 - air));
            turn(node, "z", side * mix(-0.12, 0.65 * Math.sin(time * TAU * WINGBEATS), air));
          } else {
            const stretch = rest * (0.45 + 0.25 * Math.sin(time * 9));
            turn(node, "z", side * (0.08 + 0.09 * move * Math.sin(phase) + stretch));
            turn(node, "x", 0.08 * move * Math.cos(phase));
          }
          break;
        case "bird_foot":
          if (profile === "penguin") {
            turn(node, "x", 0.27 * move * Math.sin(phase + u.phase));
            node.position.y += 0.07 * move * Math.max(0, Math.cos(phase + u.phase));
          } else {
            turn(node, "x", 0.08 * Math.sin(time * 1.6 + side) * (1 - air) + 0.5 * air);
          }
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

/** Each leg's two bones and where its hip rests; a bounding animal moves its hind pair, then its fore pair. */
function createLegs(hips, profile) {
  return hips.flatMap((hip) => {
    const knee = hip.children.find((child) => child.userData.joint === "knee");
    if (!knee) return [];
    const front = hip.position.z > 0;
    return {
      hip,
      knee,
      front,
      rest: hip.position.clone(),
      upper: hip.userData.upperLength,
      lower: hip.userData.lowerLength,
      bend: hip.userData.bend || 1,
      footHeight: hip.userData.footHeight ?? 0.02,
      phase: profile === "rabbit" ? (front ? Math.PI : 0) : hip.userData.phase,
      toGallop: 0,
    };
  });
}

/**
 * Where a hunter of small things is in its pounce: negative while it crouches to spring (to -1), then 0 to 1 through
 * the leap, and 0 between pounces.
 */
function pounceAt(seconds) {
  const into = (seconds % POUNCE.every) - (POUNCE.every - POUNCE.seconds);
  if (into < 0) return 0;
  const share = into / POUNCE.seconds;
  return share < POUNCE.crouch
    ? -Math.sin((Math.PI * share) / POUNCE.crouch)
    : (share - POUNCE.crouch) / (1 - POUNCE.crouch);
}

/** How far a leg's place in the cycle moves, the short way round, as the walk becomes a gallop. */
function turnToGallop(leg) {
  const end = leg.front ? "fore" : "hind";
  const gallop = GALLOP_PHASES[`${end}${leg.rest.x < 0 ? "Left" : "Right"}`];
  return Math.atan2(Math.sin(gallop - leg.phase), Math.cos(gallop - leg.phase));
}

/** What the legs share: how long a step is, and how high the body rides for the legs to stand as straight as asked. */
function createStance(legs, quadruped) {
  const legLength = Math.min(...legs.map((leg) => leg.upper + leg.lower));
  const hipHeight = legs.reduce((sum, leg) => sum + leg.rest.y, 0) / legs.length;
  const stride = quadruped.stride * legLength;
  // Every leg stands at least as straight as asked; none is pulled past its length.
  const raise = quadruped.extension
    ? Math.max(
        0,
        Math.min(...legs.map((leg) => quadruped.extension * (leg.upper + leg.lower) - (leg.rest.y - leg.footHeight))),
      )
    : 0;
  return {
    legLength,
    hipHeight,
    stride,
    raise,
    cycleLength: stride / quadruped.duty,
    frontZ: Math.max(...legs.map((leg) => leg.rest.z)),
    rearZ: Math.min(...legs.map((leg) => leg.rest.z)),
  };
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
