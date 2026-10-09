import type {
  ProceduralMeleeArmPose,
  ProceduralMeleeBodyStates,
  ProceduralMeleeStates,
} from "./procedural-melee-weapon-catalog";

// The states the T1 Knight Default sword and shield hold the body in: the numbers of
// asset-sources/characters/t1-knight-default/poses.json, which t1-knight-default-arms.test.ts compares them with.

export const T1_KNIGHT_DEFAULT_SWORD_ARM_POSES: ProceduralMeleeStates<ProceduralMeleeArmPose> = {
  idle: [
    {
      elbow: [-0.0858, -0.1012, 0.0092],
      handTurn: [0.04124, 0.0123, -0.12123, 0.99169],
      wrist: [-0.0957, -0.1741, 0.0356],
    },
    {
      elbow: [-0.0877, -0.1012, 0.0039],
      handTurn: [0.31568, 0.05102, -0.1824, 0.92977],
      wrist: [-0.111, -0.1734, 0.0229],
    },
    {
      elbow: [-0.0913, -0.0785, 0.0687],
      handTurn: [-0.09497, -0.16802, 0.19433, 0.96176],
      wrist: [-0.1072, -0.0022, 0.0617],
    },
  ],
  guard: {
    elbow: [-0.1362, -0.0796, 0.0085],
    handTurn: [-0.15234, -0.10879, 0.16523, 0.96833],
    wrist: [-0.1209, -0.0896, 0.0845],
  },
  runGuard: {
    elbow: [-0.0721, -0.0829, -0.0602],
    handTurn: [-0.2772, -0.07976, 0.06874, 0.95502],
    wrist: [-0.1186, -0.0786, 0.0025],
  },
  hit: {
    elbow: [-0.1543, -0.0419, -0.0436],
    handTurn: [-0.39943, -0.3693, 0.37629, 0.74998],
    wrist: [-0.2232, -0.0265, -0.0099],
  },
  attacks: {
    cut: {
      windup: {
        elbow: [-0.011, -0.0157, 0.0869],
        handTurn: [-0.26857, -0.18856, 0.11127, 0.93805],
        wrist: [-0.058, 0.0464, 0.094],
      },
      contact: {
        elbow: [-0.11805, -0.05695, 0.0686],
        handTurn: [0.03198, -0.12111, -0.07711, 0.98912],
        wrist: [-0.1457, -0.0835, 0.1322],
      },
      follow: {
        elbow: [-0.1133, -0.0849, 0.0439],
        handTurn: [-0.00987, -0.27503, 0.03012, 0.96091],
        wrist: [-0.1323, -0.1336, 0.102],
      },
    },
  },
};

export const T1_KNIGHT_DEFAULT_SHIELD_ARM_POSES: ProceduralMeleeStates<ProceduralMeleeArmPose> = {
  idle: [
    {
      elbow: [0.1163, -0.0896, 0.0252],
      handTurn: [-0.10947, 0.06664, -0.05428, 0.99027],
      wrist: [0.1025, -0.1199, 0.0959],
    },
    { elbow: [0.0933, -0.1002, -0], handTurn: [0, 0, 0, 1], wrist: [0.0952, -0.1749, 0.0229] },
    { elbow: [0.1068, -0.0962, 0.0059], handTurn: [0, 0, 0, 1], wrist: [0.0988, -0.1603, 0.05] },
  ],
  guard: {
    elbow: [0.1106, -0.0699, 0.0706],
    handTurn: [-0.31985, 0.19478, -0.15874, 0.91354],
    wrist: [0.0522, -0.0387, 0.1122],
  },
  runGuard: {
    elbow: [0.0311, -0.0383, 0.0925],
    handTurn: [-0.36917, 0.22483, -0.18314, 0.88296],
    wrist: [-0.0152, 0.0247, 0.0923],
  },
  hit: {
    elbow: [0.0853, -0.0749, 0.0748],
    handTurn: [-0.26895, 0.1638, -0.1334, 0.9397],
    wrist: [0.0098, -0.0554, 0.0696],
  },
  attacks: {
    cut: {
      windup: {
        elbow: [0.1064, -0.0524, 0.0891],
        handTurn: [-0.10948, 0.0667, -0.05431, 0.99026],
        wrist: [0.0641, -0.0074, 0.1371],
      },
      contact: {
        elbow: [0.1031, -0.0497, 0.08895],
        handTurn: [-0.24301, 0.14802, -0.12056, 0.95105],
        wrist: [0.0412, -0.02175, 0.12495],
      },
      follow: {
        elbow: [0.1008, -0.0309, 0.1028],
        handTurn: [-0.26896, 0.16384, -0.13337, 0.9397],
        wrist: [0.0308, -0.0127, 0.1324],
      },
    },
  },
};

export const T1_KNIGHT_DEFAULT_BODY_POSES: ProceduralMeleeBodyStates = {
  idle: [
    {
      pelvis: { yaw: -5, pitch: -0, roll: 2, height: 1, forward: 0.0035, left: 0.0087 },
      spine: { flex: -0, twist: 0, side: -2 },
      head: { yaw: -0, pitch: -0 },
      stance: {
        left: { forward: 0.0073, left: 0.0449, yaw: 20 },
        right: { forward: -0.0073, left: -0.0449, yaw: -22.9 },
      },
    },
    {
      pelvis: { yaw: 0, pitch: -0, roll: 5, height: 1, forward: 0.0064, left: 0.0025 },
      spine: { flex: -0, twist: 0, side: -4 },
      head: { yaw: 10, pitch: 3 },
      stance: {
        left: { forward: -0.0029, left: 0.0328, yaw: 26.1 },
        right: { forward: 0.0029, left: -0.0328, yaw: -16.5 },
      },
    },
    {
      pelvis: { yaw: 0, pitch: -0, roll: -0, height: 1, forward: 0.0053, left: 0 },
      spine: { flex: -0, twist: 0, side: -0 },
      head: { yaw: 0, pitch: -0 },
      stance: {
        left: { forward: 0.0049, left: 0.0476, yaw: 21.7 },
        right: { forward: -0.0049, left: -0.0476, yaw: -21.9 },
      },
    },
  ],
  guard: {
    pelvis: { yaw: -30, pitch: 8, roll: -0, height: 0.92, forward: 0.015, left: 0.015 },
    spine: { flex: 8, twist: -10, side: 0.5 },
    head: { yaw: 35, pitch: 4.9 },
    stance: {
      left: { forward: 0.1031, left: 0.0105, yaw: 5.8 },
      right: { forward: -0.1031, left: -0.0105, yaw: -66.2 },
    },
  },
  walkGuard: {
    pelvis: { yaw: -20, pitch: 6, roll: -0, height: 0.93, forward: 0.0182, left: 0.0017 },
    spine: { flex: 6, twist: -5, side: 0.2 },
    head: { yaw: 20, pitch: 4 },
    stance: { left: { forward: 0.124, left: -0.0015, yaw: 6.9 }, right: { forward: -0.124, left: 0.0015, yaw: -46.1 } },
  },
  runGuard: {
    pelvis: { yaw: -10, pitch: 12, roll: -0, height: 1.01, forward: 0.027, left: 0.0093 },
    spine: { flex: 8, twist: 10, side: -0.5 },
    head: { yaw: -0, pitch: 8 },
    stance: {
      left: { forward: 0.0954, left: 0.0034, yaw: 4.5 },
      right: { forward: -0.0954, left: -0.0034, yaw: -17.7 },
    },
  },
  hit: {
    pelvis: { yaw: 10, pitch: -8, roll: -0, height: 0.91, forward: -0.0756, left: -0.0207 },
    spine: { flex: -11.6, twist: 19.2, side: -13.5 },
    head: { yaw: -15.1, pitch: -10 },
    stance: {
      left: { forward: 0.048, left: 0.0564, yaw: 17.8 },
      right: { forward: -0.048, left: -0.0564, yaw: -40.1 },
    },
  },
  attacks: {
    cut: {
      windup: {
        pelvis: { yaw: -40, pitch: -0, roll: -0, height: 0.93, forward: -0.0094, left: 0.0334 },
        spine: { flex: -5.3, twist: -19.9, side: 2.4 },
        head: { yaw: 60, pitch: 0 },
        stance: {
          left: { forward: 0.0753, left: 0.0121, yaw: 2.5 },
          right: { forward: -0.0753, left: -0.0121, yaw: -72.7 },
        },
      },
      contact: {
        pelvis: { yaw: -2.5, pitch: 12.5, roll: 0, height: 0.885, forward: 0.0261, left: 0.0026 },
        spine: { flex: 14.05, twist: 8.5, side: 0.7 },
        head: { yaw: -1.05, pitch: 7.5 },
        stance: {
          left: { forward: 0.1134, left: 0.0504, yaw: 16.25 },
          right: { forward: -0.1134, left: -0.0504, yaw: -52.95 },
        },
      },
      follow: {
        pelvis: { yaw: 5, pitch: 15, roll: -0, height: 0.86, forward: 0.0347, left: 0.0022 },
        spine: { flex: 18.1, twist: 12, side: 1.7 },
        head: { yaw: -12.1, pitch: 10 },
        stance: {
          left: { forward: 0.1229, left: 0.0638, yaw: 19.3 },
          right: { forward: -0.1229, left: -0.0638, yaw: -50.7 },
        },
      },
    },
  },
};
