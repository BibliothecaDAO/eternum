import type { HumanoidRigAdapter } from "./humanoid-rig-adapter";

const LEFT_DIGITS = {
  index: ["index_01_l", "index_02_l", "index_03_l"],
  middle: ["middle_01_l", "middle_02_l", "middle_03_l"],
  pinky: ["pinky_01_l", "pinky_02_l", "pinky_03_l"],
  ring: ["ring_01_l", "ring_02_l", "ring_03_l"],
  thumb: ["thumb_01_l", "thumb_02_l", "thumb_03_l"],
} as const;
const RIGHT_DIGITS = {
  index: ["index_01_r", "index_02_r", "index_03_r"],
  middle: ["middle_01_r", "middle_02_r", "middle_03_r"],
  pinky: ["pinky_01_r", "pinky_02_r", "pinky_03_r"],
  ring: ["ring_01_r", "ring_02_r", "ring_03_r"],
  thumb: ["thumb_01_r", "thumb_02_r", "thumb_03_r"],
} as const;

export const QUATERNIUS_HUMANOID_RIG_ADAPTER = {
  auxiliaryBones: ["root", "spine_02"],
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
  feet: {
    left: { ankle: "foot_l", toe: "ball_l" },
    right: { ankle: "foot_r", toe: "ball_r" },
  },
  hands: {
    left: {
      digits: LEFT_DIGITS,
      fingerCurlAxis: [1, 0, 0],
      hand: "hand_l",
      palm: { index: "index_01_l", middle: "middle_01_l", normalSign: -1, pinky: "pinky_01_l" },
      rollCorrection: [0, 1, 0, 0],
    },
    right: {
      digits: RIGHT_DIGITS,
      fingerCurlAxis: [1, 0, 0],
      hand: "hand_r",
      palm: { index: "index_01_r", middle: "middle_01_r", normalSign: -1, pinky: "pinky_01_r" },
      rollCorrection: [0, 1, 0, 0],
    },
  },
  id: "quaternius-universal",
  label: "Quaternius Universal humanoid",
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
    drawRight: { bone: "middle_01_r", offset: { kind: "fixed", value: [0, 0.015, 0] } },
    gripLeft: {
      bone: "hand_l",
      offset: {
        bones: ["index_01_l", "middle_01_l", "ring_01_l", "pinky_01_l"],
        kind: "knuckle-center",
        scale: 0.82,
      },
    },
    gripRight: {
      bone: "hand_r",
      offset: {
        bones: ["index_01_r", "middle_01_r", "ring_01_r", "pinky_01_r"],
        kind: "knuckle-center",
        scale: 0.82,
      },
    },
    handLeft: { bone: "hand_l", offset: { kind: "fixed", value: [0, 0, 0] } },
    handRight: { bone: "hand_r", offset: { kind: "fixed", value: [0, 0, 0] } },
    jawAnchor: { bone: "Head", offset: { kind: "fixed", value: [-0.025, -0.015, 0.035] } },
    projectileOrigin: { bone: "hand_l", offset: { kind: "fixed", value: [0, 0, 0.035] } },
    quiver: { bone: "spine_03", offset: { kind: "fixed", value: [0.22, 0.08, -0.16] } },
  },
  stableSegmentAxes: {
    fallbackForward: [1, 0, 0],
    referenceForward: [0, 0, 1],
  },
} as const satisfies HumanoidRigAdapter;
