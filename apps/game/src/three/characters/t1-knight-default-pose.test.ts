// @vitest-environment node
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadBastionKnightCharacterAssetTemplates } from "./bastion-knight-character-assets";
import { ProceduralCharacterAvatar } from "./procedural-character-avatar";
import { ProceduralCharacterLibrary } from "./procedural-character-assets";
import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveProceduralCharacterPose, type Vector3Tuple } from "./procedural-character-pose";
import { applyCharacterRigLimbLengths, resolveCharacterRig } from "./procedural-character-rig";
import { parseTextureFreeGlb } from "./procedural-unit-test-glb";

const PREFIX = "/models/characters/t1-knight-default/";
/** A centimetre or two at the Knight's 0.6 m height. */
const JOINT_TOLERANCE = 0.02;
const SOLE_TOLERANCE = 0.005;
const SIDES = ["Left", "Right"] as const;

function distance(a: Vector3Tuple, b: Vector3Tuple): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function withKnightLibrary(run: (library: ProceduralCharacterLibrary) => void): Promise<void> {
  vi.stubGlobal("ProgressEvent", class extends Event {});
  const gltfs = new Map<string, GLTF>();
  for (const relativePath of ["near/skin.glb", "mid/skin.glb"]) {
    gltfs.set(PREFIX + relativePath, await parseTextureFreeGlb(PREFIX + relativePath));
  }
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async (url) => {
    const gltf = gltfs.get(String(url));
    if (!gltf) throw new Error(`Unexpected Knight asset: ${String(url)}`);
    return gltf;
  });
  const library = new ProceduralCharacterLibrary(await loadBastionKnightCharacterAssetTemplates());
  try {
    run(library);
  } finally {
    library.dispose();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("T1 Knight under the procedural pose controller", () => {
  for (const renderDetail of ["hero", "crowd"] as const) {
    it(`puts the ${renderDetail} skeleton's hips, knees and ankles where the pose puts them`, async () => {
      await withKnightLibrary((library) => {
        const config = {
          ...createDefaultProceduralCharacterConfig(),
          appearanceId: "t1-knight-bastion-default" as const,
          renderDetail,
          tier: 1 as const,
        };
        const asset = library.instantiate(config.appearanceId, config.tier, renderDetail);
        const avatar = new ProceduralCharacterAvatar(asset, resolveCharacterRig(config), config);
        // The runtime's own calibration on construction (calibrateRigToActiveAvatar).
        const rig = applyCharacterRigLimbLengths(resolveCharacterRig(config), avatar.measureActiveLimbLengths());
        avatar.rebuild(rig, config);
        try {
          for (const animationMode of ["idle", "walk", "run"] as const) {
            for (const elapsedSeconds of [0.1, 0.35, 0.6]) {
              const posed = { ...config, animationMode };
              avatar.updateConfig(posed);
              const pose = resolveProceduralCharacterPose(rig, posed, elapsedSeconds);
              avatar.applyPose(pose);
              const joints = avatar.readWorldDiagnosticJoints();
              for (const side of SIDES) {
                const label = `${animationMode} ${elapsedSeconds}s ${side}`;
                expect(
                  distance(joints[`hip${side}`], pose.parts[`thigh${side}`].jointAnchor),
                  `${label} hip`,
                ).toBeLessThan(JOINT_TOLERANCE);
                expect(
                  distance(joints[`knee${side}`], pose.parts[`shin${side}`].jointAnchor),
                  `${label} knee`,
                ).toBeLessThan(JOINT_TOLERANCE);
                expect(
                  distance(joints[`ankle${side}`], pose.feet[side === "Left" ? "left" : "right"].target),
                  `${label} ankle`,
                ).toBeLessThan(JOINT_TOLERANCE);
              }
            }
          }
          avatar.updateConfig({ ...config, animationMode: "idle" });
          avatar.applyPose(resolveProceduralCharacterPose(rig, { ...config, animationMode: "idle" }, 0.1));
          const joints = avatar.readWorldDiagnosticJoints();
          for (const side of SIDES) {
            expect(
              Math.abs(joints[`ankle${side}`][1] - rig.morphology.foot.ankleHeight),
              `idle ${side} sole`,
            ).toBeLessThan(SOLE_TOLERANCE);
          }
        } finally {
          avatar.dispose();
        }
      });
    });
  }
});
