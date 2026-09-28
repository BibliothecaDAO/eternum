import type { HumanoidMinimalHandRigDefinition, HumanoidRigAdapter } from "./humanoid-rig-adapter";

const LEFT_HAND: HumanoidMinimalHandRigDefinition = {
  kind: "minimal",
  hand: "hand_l",
  rollCorrection: [0, 0, 0, 1],
  palm: {
    index: [-0.0052037774585187435, 0.015382833778858185, -0.009454270824790001],
    middle: [-0.008961494080722332, 0.012480380944907665, 2.6202924274798534e-8],
    pinky: [0.00111009634565562, 0.024176469072699547, 0.01610109582543373],
    normalSign: -1,
  },
};

const RIGHT_HAND: HumanoidMinimalHandRigDefinition = {
  kind: "minimal",
  hand: "hand_r",
  rollCorrection: [0, 0, 0, 1],
  palm: {
    index: [0.0014218363212421536, 0.04836757853627205, -0.009925372898578644],
    middle: [0.004432076122611761, 0.05167100578546524, 2.6202924274798534e-8],
    pinky: [-0.0038326370995491743, 0.03896307200193405, 0.01610109582543373],
    normalSign: -1,
  },
};

function fixedSocket(bone: string, value: readonly [number, number, number]) {
  return { bone, offset: { kind: "fixed" as const, value } };
}

/** T1 Knight rig normalized to standing-equivalent H=.6 before export. */
export const BASTION_KNIGHT_HUMANOID_RIG_ADAPTER = {
  id: "t1-knight-bastion-v1",
  label: "T1 Knight default rig",
  authoredLegLength: "chain",
  authoredUniformScale: 1,
  sourceBodyMorphology: true,
  measureSourceHeadRadius: true,
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
  feet: {
    left: { ankle: "foot_l", toe: "ball_l", toeTip: "ball_leaf_l", soleHeight: 0, heelLengthRatio: 0.489705869 },
    right: { ankle: "foot_r", toe: "ball_r", toeTip: "ball_leaf_r", soleHeight: 0, heelLengthRatio: 0.502342786 },
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
      ...fixedSocket("hand_r", [0.0031390244683379143, 0.03343521375726105, -0.0010565665117091977]),
      rotationOffset: [-0.6437316433467175, 0.13298952638043074, 4.025655969681697e-9, 0.7536068983410669],
    },
    handLeft: fixedSocket("hand_l", [0, 0, 0]),
    handRight: fixedSocket("hand_r", [0, 0, 0]),
    jawAnchor: fixedSocket("Head", [0, 0, 0]),
    projectileOrigin: fixedSocket("hand_l", [0, 0, 0]),
    quiver: fixedSocket("spine_03", [0, 0, 0]),
    forearmLeft: {
      ...fixedSocket("lowerarm_l", [0.02429374013366986, 0.0540103893277306, 0.00590031303859076]),
      rotationOffset: [0.6180565220984333, -7.046888157150992e-8, 0.7861336626118826, -1.0437983517939608e-7],
    },
  },
  stableSegmentAxes: { fallbackForward: [1, 0, 0], referenceForward: [0, 0, 1] },
} as const satisfies HumanoidRigAdapter;
