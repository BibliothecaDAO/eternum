import type { HumanoidMinimalHandRigDefinition, HumanoidRigAdapter } from "./humanoid-rig-adapter";

const LEFT_HAND: HumanoidMinimalHandRigDefinition = {
  kind: "minimal",
  hand: "hand_l",
  rollCorrection: [0, 0, 0, 1],
  palm: {
    index: [0.032367, -0.039763, 0.015626],
    middle: [0.03439, -0.039131, 0.00961],
    pinky: [0.029913, -0.03855, -0.010571],
    normalSign: -1,
  },
};

const RIGHT_HAND: HumanoidMinimalHandRigDefinition = {
  kind: "minimal",
  hand: "hand_r",
  rollCorrection: [0, 0, 0, 1],
  palm: {
    index: [-0.032574, -0.038091, 0.016716],
    middle: [-0.034444, -0.039099, 0.010311],
    pinky: [-0.030621, -0.037719, -0.009045],
    normalSign: -1,
  },
};

function fixedSocket(bone: string, value: readonly [number, number, number]) {
  return { bone, offset: { kind: "fixed" as const, value } };
}

/**
 * T1 Knight Default rig: 31 joints with world-aligned rest frames. The hands, feet, the two gear sockets and the six
 * driven joints are copied from asset-sources/characters/t1-knight-default/runtime-fit.json, and the adapter test
 * compares them with it. The other sockets sit on their joint with no offset.
 */
export const T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER = {
  id: "t1-knight-default",
  label: "T1 Knight Default rig",
  authoredUniformScale: 1,
  // spine_03 is the base of the sternum; the body calibration wants the top of the torso between the shoulders.
  sourceBody: { chestBetween: ["upperarm_l", "upperarm_r"] },
  auxiliaryBones: ["root", "spine_02", "clavicle_l", "clavicle_r"],
  diagnosticBones: {
    ankleLeft: "foot_l",
    ankleRight: "foot_r",
    chest: "spine_03",
    elbowLeft: "lowerarm_l",
    elbowRight: "lowerarm_r",
    head: "Head",
    hipLeft: "thigh_l",
    hipRight: "thigh_r",
    kneeLeft: "calf_l",
    kneeRight: "calf_r",
    pelvis: "pelvis",
    shoulderLeft: "upperarm_l",
    shoulderRight: "upperarm_r",
    wristLeft: "hand_l",
    wristRight: "hand_r",
  },
  drivenJoints: [
    { rule: "half", bone: "elbow_half_l", follows: "lowerarm_l", share: 0.5 },
    { rule: "half", bone: "elbow_half_r", follows: "lowerarm_r", share: 0.5 },
    { rule: "half", bone: "knee_half_l", follows: "calf_l", share: 0.5 },
    { rule: "half", bone: "knee_half_r", follows: "calf_r", share: 0.5 },
    {
      rule: "twist",
      bone: "upperarm_twist_l",
      follows: "upperarm_l",
      share: 0.4,
      axis: [0.839174, -0.543353, -0.023558],
    },
    {
      rule: "twist",
      bone: "upperarm_twist_r",
      follows: "upperarm_r",
      share: 0.4,
      axis: [-0.839174, -0.543353, -0.023558],
    },
  ],
  feet: {
    left: { ankle: "foot_l", toe: "ball_l", toeTip: "ball_leaf_l", soleHeight: 0, heelLengthRatio: 0.637244 },
    right: { ankle: "foot_r", toe: "ball_r", toeTip: "ball_leaf_r", soleHeight: 5e-5, heelLengthRatio: 0.635472 },
  },
  hands: { left: LEFT_HAND, right: RIGHT_HAND },
  partBindings: {
    pelvis: { bone: "pelvis" },
    chest: { bone: "spine_01" },
    head: { bone: "neck_01" },
    upperArmLeft: { bone: "upperarm_l", childBone: "lowerarm_l" },
    forearmLeft: { bone: "lowerarm_l", childBone: "hand_l" },
    upperArmRight: { bone: "upperarm_r", childBone: "lowerarm_r" },
    forearmRight: { bone: "lowerarm_r", childBone: "hand_r" },
    thighLeft: { bone: "thigh_l", childBone: "calf_l", stable: true },
    shinLeft: { bone: "calf_l", childBone: "foot_l", stable: true },
    thighRight: { bone: "thigh_r", childBone: "calf_r", stable: true },
    shinRight: { bone: "calf_r", childBone: "foot_r", stable: true },
  },
  sceneRotation: [0, 0, 0, 1],
  sockets: {
    drawRight: fixedSocket("hand_r", [0, 0, 0]),
    gripLeft: fixedSocket("hand_l", [0, 0, 0]),
    gripRight: {
      ...fixedSocket("hand_r", [-0.018939, -0.029541, -0.000171]),
      rotationOffset: [0.685183, -0.17744, -0.17577, 0.684211],
    },
    handLeft: fixedSocket("hand_l", [0, 0, 0]),
    handRight: fixedSocket("hand_r", [0, 0, 0]),
    jawAnchor: fixedSocket("Head", [0, 0, 0]),
    projectileOrigin: fixedSocket("hand_l", [0, 0, 0]),
    quiver: fixedSocket("spine_03", [0, 0, 0]),
    forearmLeft: {
      ...fixedSocket("lowerarm_l", [0.056601, -0.016108, 0.012975]),
      rotationOffset: [-0.523001, 0.705645, 0.04544, 0.475889],
    },
  },
  stableSegmentAxes: { fallbackForward: [1, 0, 0], referenceForward: [0, 0, 1] },
} as const satisfies HumanoidRigAdapter;
