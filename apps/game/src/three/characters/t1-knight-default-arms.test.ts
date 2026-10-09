// @vitest-environment node
import { readFileSync } from "node:fs";

import { Group, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createKnightGuardSubject,
  KNIGHT_DECLARED_IDLES,
  measureKnightState,
  runKnightSequence,
  summariseWorstGuardClearance,
  type GuardClearance,
  type KnightBodyStateMeasure,
  type KnightGuardSample,
  type KnightSequenceStep,
  type KnightStateName,
} from "../../../test-support/knight-guard-clearance";
import { withKnightLibrary } from "../../../test-support/with-knight-library";
import { applyProceduralMeleeConfigPatch, createDefaultProceduralMeleeConfig } from "./melee/procedural-melee-config";
import { ProceduralMeleeController } from "./melee/procedural-melee-controller";
import type { ProceduralMeleeUpperBodyPose } from "./melee/procedural-melee-pose";
import type { CharacterFootId } from "./procedural-character-gait";
import { resolveProceduralCharacterPose } from "./procedural-character-pose";
import { ProceduralPlantController } from "./procedural-plant-controller";
import {
  resolveProceduralMeleeOffhand,
  resolveProceduralMeleeWeapon,
  type ProceduralMeleeArmPose,
  type ProceduralMeleeAttackVariantId,
  type ProceduralMeleeBodyPose,
  type ProceduralMeleeStates,
} from "./melee/procedural-melee-weapon-catalog";

/** The Knight's stature, from runtime-fit.json (body.stature). */
const STATURE = 0.61526;
const MIN_BLADE_TIP_HEIGHT = 0.01;
const MAX_HINGE_AXIS_DEGREES = 2;
const MAX_STATE_POSITION_ERROR = 0.008;
const MAX_STATE_DIRECTION_ERROR_DEGREES = 5;
const MAX_PELVIS_TURN_ERROR_DEGREES = 2;
/** How far the blade tip may be from the contact state's when the contact fires, or go past it before the follow-through. */
const MAX_CONTACT_TIP_ERROR = 0.015;
/**
 * How far the blade tip may be from the contact pose when the contact fires: the declared states lead by the pose
 * filter's lag, which brings it to 119 mm; nearer would take a contact the strike holds rather than passes through.
 */
const MAX_CONTACT_TIP_MISS_WITH_LEAD = 0.125;
const MAX_TRUNK_TURN_ERROR_DEGREES = 3;
const MAX_PELVIS_HEIGHT_ERROR = 0.005;
/** A foot this close to the floor stands on it, as in t1-knight-default-pose.test.ts. */
const MAX_SOLE_LIFT = 0.005;
/** The controller's cap on a declared pelvis height (procedural-character-pose.ts). */
const MAX_DECLARED_PELVIS_HEIGHT = 0.975;

interface PoseFileArm {
  elbow: number[];
  hand_turn_xyzw: number[];
  wrist: number[];
}

interface PoseFileState {
  body: Omit<ProceduralMeleeBodyPose, "stance">;
  expect: Record<string, readonly number[]>;
  left: PoseFileArm;
  right: PoseFileArm;
  stance: ProceduralMeleeBodyPose["stance"] & { support: string[] };
}

interface PoseFile {
  groups: {
    attacks: Record<ProceduralMeleeAttackVariantId, [KnightStateName, KnightStateName, KnightStateName]>;
    guard: KnightStateName;
    hit: KnightStateName;
    idle: KnightStateName[];
    run_guard: KnightStateName;
    walk_guard: KnightStateName;
  };
  states: Record<KnightStateName, PoseFileState>;
}

const POSES = JSON.parse(readFileSync("asset-sources/characters/t1-knight-default/poses.json", "utf8")) as PoseFile;

/** The states the Knight's gear declares, by the name poses.json gives them. */
function listDeclaredStates(): KnightStateName[] {
  const { groups } = POSES;
  const attacks = resolveProceduralMeleeAttackVariantsDeclared().flatMap((variant) => groups.attacks[variant]);
  return [...KNIGHT_DECLARED_IDLES, groups.guard, groups.walk_guard, groups.run_guard, groups.hit, ...attacks];
}

function resolveProceduralMeleeAttackVariantsDeclared(): ProceduralMeleeAttackVariantId[] {
  const body = resolveProceduralMeleeWeapon("t1-knight-default-sword").bodyPoses;
  if (!body) throw new Error("The T1 Knight Default sword declares no body states");
  return Object.keys(body.attacks) as ProceduralMeleeAttackVariantId[];
}

/** The state of a catalog record that poses.json names, as the groups map them. */
function pickCatalogState<T>(
  states: ProceduralMeleeStates<T> & { walkGuard?: T },
  name: KnightStateName,
): T | undefined {
  const { groups } = POSES;
  const idle = KNIGHT_DECLARED_IDLES.indexOf(name);
  if (idle >= 0) return states.idle[idle];
  if (name === groups.guard) return states.guard;
  if (name === groups.walk_guard) return states.walkGuard;
  if (name === groups.run_guard) return states.runGuard;
  if (name === groups.hit) return states.hit;
  for (const [variant, moments] of Object.entries(groups.attacks)) {
    const moment = moments.indexOf(name);
    const attack = states.attacks[variant as ProceduralMeleeAttackVariantId];
    if (moment >= 0 && attack) return [attack.windup, attack.contact, attack.follow][moment];
  }
  return undefined;
}

/** The arms of the walking guard are the standing guard's; every other state's arms are its own. */
function resolveArmSource(name: KnightStateName): KnightStateName {
  return name === POSES.groups.walk_guard ? POSES.groups.guard : name;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function degrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * The limits a sequence's transitions are held to. The stand-ins are at least as big as the parts (the shield a 1 cm
 * slab, arms 2 cm, legs 3 cm and the trunk 5 cm capsules), so a positive clearance against them is a real gap; the
 * declared states themselves passed the mesh-level clash check when the gear was fitted, and are recorded, not judged.
 */
interface SequenceLimits {
  /**
   * The shield as close to the head as the declared states passed through, less 5 mm or a tenth of that (the filter cuts
   * corners): the approved poses raise it to the face, where the head stand-in already reads negative.
   */
  shieldToHead: number;
}

/** A blade passing the head, as a raise does, keeps 2 cm from it. */
const MIN_BLADE_TO_HEAD = 0.02;
/** A thin blade 5 mm off the shield's slab. */
const MIN_BLADE_TO_SHIELD = 0.005;
const MIN_ARM_TO_SHIELD = 0.002;
const MIN_SHIELD_TO_LEGS = 0.002;
/** A reaction's weight never reaches 1 in play and the brush lasts a fraction of a second: the shield may only touch. */
const MIN_SHIELD_TO_LEGS_IN_A_REACTION = 0;
const MIN_HEAD_FLOOR_MARGIN = 0.005;
const HEAD_FLOOR_MARGIN_SHARE = 0.1;
/** Idle and run feet stand flat (`standsFlat`); the walk keeps the game's foot roll, whose toe-off dips this figure's
 * ball 1.7 mm and toe tip 3.6 mm under the floor. */
const MAX_SOLE_DEPTH = { idle: 0.001, run: 0.001, walk: 0.005 } as const;

function resolveSequenceLimits(
  sequence: KnightSequence,
  measure: (name: KnightStateName) => GuardClearance,
): SequenceLimits {
  const clearances = sequence.states.map(measure);
  const floor = (pick: (clearance: GuardClearance) => number) => {
    const least = Math.min(...clearances.map(pick));
    return least - Math.max(MIN_HEAD_FLOOR_MARGIN, Math.abs(least) * HEAD_FLOOR_MARGIN_SHARE);
  };
  return {
    shieldToHead: floor((clearance) => clearance.shieldToHead),
  };
}

/** The clearance criteria every sample of every sequence is held to. */
const CLEARANCE_CRITERIA: Readonly<
  Record<string, { holds: (sample: KnightGuardSample, limits: SequenceLimits) => boolean; label: string }>
> = {
  armToShield: {
    holds: ({ clearance }) => clearance.armToShield >= MIN_ARM_TO_SHIELD,
    label: "sword arm 2 mm from the shield",
  },
  bladeClear: {
    holds: ({ clearance }) =>
      clearance.bladeToTrunk > 0 &&
      clearance.bladeToLegs > 0 &&
      clearance.bladeToShieldArm > 0 &&
      clearance.bladeTipHeight >= MIN_BLADE_TIP_HEIGHT,
    label: "blade clear of the trunk, thighs, shins and the shield arm, and 1 cm above the floor",
  },
  bladeToHead: {
    holds: ({ clearance }) => clearance.bladeToHead >= MIN_BLADE_TO_HEAD,
    label: "blade 2 cm from the head",
  },
  bladeToShield: {
    holds: ({ clearance }) => clearance.bladeToShield >= MIN_BLADE_TO_SHIELD,
    label: "blade 5 mm from the shield",
  },
  feetAboveFloor: {
    holds: ({ clearance, motion }) =>
      Math.min(clearance.soleHeights.left, clearance.soleHeights.right) >= -MAX_SOLE_DEPTH[motion],
    label: "feet not below the floor (5 mm for the walk's foot roll)",
  },
  hinge: {
    holds: ({ clearance }) => clearance.hingeAxisDegrees < MAX_HINGE_AXIS_DEGREES,
    label: "hinge axes of both arms agree",
  },
  shieldToHead: {
    holds: ({ clearance }, limits) => clearance.shieldToHead >= limits.shieldToHead,
    label: "shield no closer to the head than the floor from the declared states passed through",
  },
  shieldToLegs: {
    holds: ({ clearance, reactionWeight }) =>
      clearance.shieldToLegs >= (reactionWeight > 0 ? MIN_SHIELD_TO_LEGS_IN_A_REACTION : MIN_SHIELD_TO_LEGS),
    label: "shield 2 mm from the thighs and shins (touching while a reaction runs)",
  },
  shieldToTrunk: {
    holds: ({ clearance }) => clearance.shieldToTrunk > 0,
    label: "shield clear of the trunk",
  },
};

/** Expects every sample to satisfy every criterion, and says the worst of each when one does not. */
function expectEveryCriterion(sequence: string, samples: readonly KnightGuardSample[], limits: SequenceLimits) {
  const limitsInMm = `shield head floor ${(limits.shieldToHead * 1000).toFixed(1)}mm`;
  for (const { holds, label } of Object.values(CLEARANCE_CRITERIA)) {
    const failing = samples.filter((sample) => !holds(sample, limits)).map((sample) => sample.label);
    expect
      .soft(failing, `${sequence}: ${label}. ${limitsInMm}. Worst: ${summariseWorstGuardClearance(samples)}`)
      .toEqual([]);
  }
}

/**
 * The trunk and head turn as declared; standing, the pelvis stands at the declared height (below the cap) and the
 * ankles where the stance puts them, both feet on the floor. Moving, the gait owns height and legs.
 */
function expectDeclaredBody(name: KnightStateName, body: KnightBodyStateMeasure, restPelvisHeight = Number.NaN) {
  const declared = POSES.states[name];
  const report = JSON.stringify(body);
  const within = (actual: number, expected: number, tolerance: number, what: string) =>
    expect(Math.abs(actual - expected), `${name} ${what}: ${report}`).toBeLessThan(tolerance);
  within(body.pelvis.yaw, declared.body.pelvis.yaw, MAX_PELVIS_TURN_ERROR_DEGREES, "pelvis yaw");
  within(body.pelvis.pitch, declared.body.pelvis.pitch, MAX_PELVIS_TURN_ERROR_DEGREES, "pelvis pitch");
  within(body.pelvis.roll, declared.body.pelvis.roll, MAX_PELVIS_TURN_ERROR_DEGREES, "pelvis roll");
  within(body.spine.flex, declared.body.spine.flex, MAX_TRUNK_TURN_ERROR_DEGREES, "spine flex");
  within(body.spine.twist, declared.body.spine.twist, MAX_TRUNK_TURN_ERROR_DEGREES, "spine twist");
  within(body.spine.side, declared.body.spine.side, MAX_TRUNK_TURN_ERROR_DEGREES, "spine side");
  within(body.head.yaw, declared.body.head.yaw, MAX_TRUNK_TURN_ERROR_DEGREES, "head yaw");
  within(body.head.pitch, declared.body.head.pitch, MAX_TRUNK_TURN_ERROR_DEGREES, "head pitch");
  if (name === POSES.groups.walk_guard || name === POSES.groups.run_guard) return;
  const height = Math.min(declared.body.pelvis.height, MAX_DECLARED_PELVIS_HEIGHT);
  within(body.pelvis.height * restPelvisHeight, height * restPelvisHeight, MAX_PELVIS_HEIGHT_ERROR, "pelvis height");
  for (const side of ["left", "right"] as const) {
    const ankle = body.ankles[side];
    const stance = declared.stance[side];
    within(Math.hypot(ankle.forward - stance.forward, ankle.left - stance.left), 0, MAX_STATE_POSITION_ERROR, side);
    within(body.soleHeights[side], 0, MAX_SOLE_LIFT, `${side} sole`);
  }
}

const ATTACK_VARIANTS = resolveProceduralMeleeAttackVariantsDeclared();
const IDLE_SEEDS = KNIGHT_DECLARED_IDLES.map((_, seed) => seed);

interface KnightSequence {
  name: string;
  /** The bearer's seed, which picks its idle state. */
  seed: number;
  /** The declared states the sequence passes through: its head clearances may come little closer than theirs. */
  states: readonly KnightStateName[];
  steps: readonly KnightSequenceStep[];
}

const attackStates = (variant: ProceduralMeleeAttackVariantId) => POSES.groups.attacks[variant];

/** Every motion and transition the Knight goes through in play, for one figure in turn. */
const KNIGHT_SEQUENCES: readonly KnightSequence[] = [
  ...IDLE_SEEDS.flatMap((seed) =>
    ATTACK_VARIANTS.map((variant) => ({
      name: `${KNIGHT_DECLARED_IDLES[seed]} to guard to ${variant} and back`,
      seed,
      states: [KNIGHT_DECLARED_IDLES[seed], POSES.groups.guard, ...attackStates(variant)],
      steps: [
        { label: "idle", motion: "idle", seconds: 0.5 },
        { attack: variant, label: variant, motion: "idle", seconds: 1.4 },
        { label: "guard held", motion: "idle", seconds: 3 },
        { label: "relaxing", motion: "idle", seconds: 1 },
      ] as const,
    })),
  ),
  {
    name: "idle to walk to run to walk to idle",
    seed: 0,
    states: [KNIGHT_DECLARED_IDLES[0], POSES.groups.walk_guard, POSES.groups.run_guard],
    steps: [
      { label: "idle", motion: "idle", seconds: 0.4 },
      { label: "walk", motion: "walk", seconds: 1.2 },
      { label: "run", motion: "run", seconds: 1.2 },
      { label: "walk again", motion: "walk", seconds: 1.2 },
      { label: "idle again", motion: "idle", seconds: 0.8 },
    ],
  },
  ...ATTACK_VARIANTS.map((variant) => ({
    name: `${variant} while walking`,
    seed: 0,
    states: [POSES.groups.walk_guard, ...attackStates(variant)],
    steps: [
      { label: "walk", motion: "walk", seconds: 0.6 },
      { attack: variant, label: variant, motion: "walk", seconds: 1.4 },
    ] as const,
  })),
  {
    name: "hit from guard",
    seed: 0,
    states: [KNIGHT_DECLARED_IDLES[0], POSES.groups.guard, ...attackStates(ATTACK_VARIANTS[0]), POSES.groups.hit],
    steps: [
      { attack: ATTACK_VARIANTS[0], label: "attack", motion: "idle", seconds: 1.4 },
      { hit: true, label: "hit", motion: "idle", seconds: 0.8 },
    ],
  },
  {
    name: "hit from idle",
    seed: 0,
    states: [KNIGHT_DECLARED_IDLES[0], POSES.groups.hit],
    steps: [
      { label: "idle", motion: "idle", seconds: 0.4 },
      { hit: true, label: "hit", motion: "idle", seconds: 0.8 },
    ],
  },
];

describe("T1 Knight states", () => {
  it("are the numbers of poses.json, written in the catalog", () => {
    const sword = resolveProceduralMeleeWeapon("t1-knight-default-sword");
    const shield = resolveProceduralMeleeOffhand("t1-knight-default-shield").armPoses;
    if (!sword.armPoses || !sword.bodyPoses || !shield) throw new Error("The Knight's gear declares no states");
    const arm = (pose: ProceduralMeleeArmPose | undefined) => ({
      elbow: pose?.elbow,
      hand_turn_xyzw: pose?.handTurn,
      wrist: pose?.wrist,
    });
    for (const name of listDeclaredStates()) {
      const file = POSES.states[name];
      const { support: _support, ...stance } = file.stance;
      expect(pickCatalogState(sword.bodyPoses, name), name).toEqual({ ...file.body, stance });
      if (name === POSES.groups.walk_guard) continue;
      expect(arm(pickCatalogState(sword.armPoses, name)), name).toEqual(file.right);
      expect(arm(pickCatalogState(shield, name)), name).toEqual(file.left);
    }
    expect(sword.armPoses).not.toHaveProperty("walkGuard");
    for (const states of [sword.armPoses, shield]) expect(Object.keys(states.attacks)).toEqual(ATTACK_VARIANTS);
  });

  it("pins a declared stance's feet in the world when the root moves, as it pins the game's own idle feet", async () => {
    await withKnightLibrary((library) => {
      const subject = createKnightGuardSubject(library, "hero", STATURE);
      try {
        const posed = { ...subject.config, animationMode: "idle" as const };
        const melee = new ProceduralMeleeController(
          applyProceduralMeleeConfigPatch(createDefaultProceduralMeleeConfig("knight"), {
            offhandId: "t1-knight-default-shield",
            weaponId: "t1-knight-default-sword",
          }),
          false,
          0,
        );
        const worldFeetAfterRootMove = (action?: ProceduralMeleeUpperBodyPose) => {
          const root = new Group();
          const plant = new ProceduralPlantController<CharacterFootId>();
          plant.beginFrame(root, 1 / 60);
          const before = resolveProceduralCharacterPose(subject.rig, posed, 0, plant.resolveTarget, 0, action).feet;
          root.position.set(0.03, 0, 0.02);
          plant.beginFrame(root, 1 / 60);
          const after = resolveProceduralCharacterPose(subject.rig, posed, 0, plant.resolveTarget, 0, action).feet;
          return (["left", "right"] as const).map((side) =>
            root.localToWorld(new Vector3(...after[side].target)).distanceTo(new Vector3(...before[side].target)),
          );
        };
        const declared = melee.update(1 / 60, new Group(), "standing");
        expect(declared.body).toBeDefined();
        // The plant controller holds a foot that stands in its contact phase and lets one in the air go, either way.
        const own = worldFeetAfterRootMove();
        expect(Math.min(...own)).toBeLessThan(1e-6);
        worldFeetAfterRootMove(declared).forEach((moved, foot) => expect(moved).toBeCloseTo(own[foot], 9));
      } finally {
        subject.avatar.dispose();
      }
    });
  });

  it("shows each attack's blade within 125 mm of its contact pose when the contact fires, and never past it", async () => {
    await withKnightLibrary((library) => {
      const subject = createKnightGuardSubject(library, "hero", STATURE);
      try {
        for (const variant of ATTACK_VARIANTS) {
          const [windup, contact] = attackStates(variant).map(
            (name) => new Vector3(...measureKnightState(subject, name).clearance.bladeTip),
          );
          const strike = contact.clone().sub(windup).normalize();
          const samples = runKnightSequence(
            subject,
            [
              { label: "idle", motion: "idle", seconds: 0.5 },
              { attack: variant, label: variant, motion: "idle", seconds: 0.8 },
            ],
            0,
            1,
          );
          const atContact = samples.find((sample) => sample.attackPhase === "contact");
          if (!atContact) throw new Error(`The ${variant} never reached its contact`);
          const missed = new Vector3(...atContact.clearance.bladeTip).distanceTo(contact);
          const overshoot = Math.max(
            ...samples
              .filter(({ attackPhase }) => attackPhase === "strike" || attackPhase === "contact")
              .map(({ clearance }) => new Vector3(...clearance.bladeTip).sub(contact).dot(strike)),
          );
          const report = `${variant}: tip ${(missed * 1000).toFixed(1)}mm from the contact state at contact, ${(overshoot * 1000).toFixed(1)}mm past it`;
          // The contact is a moment the strike passes through, and the filtered chest the arms are placed in cuts its
          // corner: leading by the filter's lag brings the cut's tip from 285 to 119 mm of the contact pose, no closer.
          expect(missed, report).toBeLessThan(MAX_CONTACT_TIP_MISS_WITH_LEAD);
          expect(overshoot, report).toBeLessThan(MAX_CONTACT_TIP_ERROR);
        }
      } finally {
        subject.avatar.dispose();
      }
    });
  });

  for (const renderDetail of ["hero", "crowd"] as const) {
    it(`puts the body, arms, shield and sword where the approved poses put them on the ${renderDetail} skeleton`, async () => {
      await withKnightLibrary((library) => {
        const subject = createKnightGuardSubject(library, renderDetail, STATURE);
        try {
          for (const name of listDeclaredStates()) {
            const { arms: measured, body } = measureKnightState(subject, name);
            expectDeclaredBody(name, body, subject.rig.morphology.restPelvisHeight);
            const expected = POSES.states[resolveArmSource(name)].expect;
            const point = (key: string) => new Vector3(...expected[key]);
            const positions: [string, Vector3][] = [
              ["left_elbow", measured.leftElbow],
              ["left_wrist", measured.leftWrist],
              ["right_elbow", measured.rightElbow],
              ["right_wrist", measured.rightWrist],
              ["shield_centre", measured.shieldCentre],
              ["sword_grip", measured.swordGrip],
            ];
            const directions: [string, Vector3][] = [
              ["shield_front", measured.shieldFront],
              ["blade", measured.blade],
            ];
            const report = [
              ...positions.map(([key, value]) => `${key} ${(value.distanceTo(point(key)) * 1000).toFixed(1)}mm`),
              ...directions.map(([key, value]) => `${key} ${degrees(value.angleTo(point(key))).toFixed(1)}deg`),
            ].join(", ");
            for (const [key, value] of positions) {
              expect(value.distanceTo(point(key)), `${name}: ${report}`).toBeLessThan(MAX_STATE_POSITION_ERROR);
            }
            for (const [key, value] of directions) {
              expect(degrees(value.angleTo(point(key))), `${name}: ${report}`).toBeLessThan(
                MAX_STATE_DIRECTION_ERROR_DEGREES,
              );
            }
          }
        } finally {
          subject.avatar.dispose();
        }
      });
    }, 120_000);

    it(`keeps sword and shield clear of each other and of the body through every motion on the ${renderDetail} skeleton`, async () => {
      await withKnightLibrary((library) => {
        const subject = createKnightGuardSubject(library, renderDetail, STATURE);
        try {
          // One figure goes through the motions in turn, as in play: an elbow left on the far side of its pole by one
          // motion would put the blade through the shield in the next.
          const stateClearances = new Map<KnightStateName, GuardClearance>();
          const measure = (name: KnightStateName) => {
            if (!stateClearances.has(name)) stateClearances.set(name, measureKnightState(subject, name).clearance);
            return stateClearances.get(name) as GuardClearance;
          };
          for (const sequence of KNIGHT_SEQUENCES) {
            const samples = runKnightSequence(subject, sequence.steps, sequence.seed);
            expectEveryCriterion(sequence.name, samples, resolveSequenceLimits(sequence, measure));
          }
        } finally {
          subject.avatar.dispose();
        }
      });
    }, 300_000);
  }
});
