import { Group, Vector3 } from "three";
import { ProceduralPlantController } from "./procedural-plant-controller";
import {
  advanceProceduralCharacterGaitPhase,
  resolveInitialProceduralCharacterPhase,
  resolveProceduralCharacterStrideLength,
  resolveProceduralCharacterCadence,
} from "./procedural-character-gait";
import { applyCharacterRigLimbLengths } from "./procedural-character-rig";
// @vitest-environment node
import { readFileSync } from "node:fs";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";
import { ProceduralCharacterAvatar } from "./procedural-character-avatar";
import { ProceduralCharacterLibrary } from "./procedural-character-assets";
import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveCharacterRig } from "./procedural-character-rig";
import { resolveProceduralCharacterPose } from "./procedural-character-pose";

describe("procedural avatar replay", () => {
  it("keeps the rendered supporting landmark on the floor across multiple walking strides", async () => {
    vi.stubGlobal("ProgressEvent", class extends Event {});
    const library = await loadTextureFreeBaseModel();
    const config = {
      ...createDefaultProceduralCharacterConfig(),
      appearanceId: "universal-base" as const,
      tier: 1 as const,
    };
    let rig = resolveCharacterRig(config);
    const avatar = new ProceduralCharacterAvatar(library.instantiate("universal-base", 1), rig, config);
    rig = applyCharacterRigLimbLengths(rig, avatar.measureActiveLimbLengths());
    avatar.rebuild(rig, config);
    const root = new Group();
    root.add(avatar.group);
    const plants = new ProceduralPlantController<"left" | "right">();
    const stride = resolveProceduralCharacterStrideLength(config, rig.morphology.scale);
    const speed = stride * resolveProceduralCharacterCadence(config);
    let phase = resolveInitialProceduralCharacterPhase(config.seed);
    const previous = new Map<string, { kind: string | undefined; point: readonly [number, number, number] }>();
    try {
      for (let frame = 0; frame < 180; frame++) {
        root.position.z = (speed * frame) / 60;
        plants.beginFrame(root, 1 / 60);
        if (frame)
          phase = advanceProceduralCharacterGaitPhase(phase, config, 1 / 60, plants.getFrameTravelDistance(), stride);
        const pose = resolveProceduralCharacterPose(rig, config, frame / 60, plants.resolveTarget, phase);
        avatar.applyPose(pose);
        const facing = avatar.readWorldDiagnosticFootFacing();
        for (const side of ["left", "right"] as const) {
          const foot = facing[side];
          for (const point of [foot.heelPosition, foot.ballPosition, foot.toeTipPosition])
            expect(point![1]).toBeGreaterThan(-0.01);
          if (foot.contactPosition) {
            expect(Math.abs(foot.contactPosition[1])).toBeLessThan(0.01);
            const last = previous.get(side);
            if (last && last.kind === foot.contactKind)
              expect(new Vector3(...foot.contactPosition).distanceTo(new Vector3(...last.point))).toBeLessThan(0.01);
            previous.set(side, { kind: foot.contactKind, point: foot.contactPosition });
          } else previous.delete(side);
        }
      }
    } finally {
      avatar.dispose();
      library.dispose();
      vi.unstubAllGlobals();
    }
  });
  it("poses both feet from the current pose independently of previously rendered poses", async () => {
    vi.stubGlobal("ProgressEvent", class extends Event {});
    const library = await loadTextureFreeBaseModel();
    const config = {
      ...createDefaultProceduralCharacterConfig(),
      appearanceId: "universal-base" as const,
      tier: 1 as const,
    };
    const rig = resolveCharacterRig(config);
    const avatar = new ProceduralCharacterAvatar(library.instantiate("universal-base", 1), rig, config);
    try {
      const firstPose = resolveProceduralCharacterPose(rig, config, 0);
      avatar.applyPose(firstPose);
      const first = avatar.readWorldDiagnosticFootRotations();
      const firstJoints = avatar.readWorldDiagnosticJoints();
      for (let frame = 1; frame <= 60; frame++)
        avatar.applyPose(resolveProceduralCharacterPose(rig, config, frame / 60));
      avatar.applyPose(firstPose);
      const replay = avatar.readWorldDiagnosticFootRotations();
      avatar.resetPoseHistory();
      avatar.applyPose(firstPose);
      const resetJoints = avatar.readWorldDiagnosticJoints();
      for (const joint of Object.keys(firstJoints) as Array<keyof typeof firstJoints>) {
        firstJoints[joint].forEach((value, index) => expect(resetJoints[joint][index]).toBeCloseTo(value, 6));
      }
      for (const side of ["left", "right"] as const) {
        first[side].forEach((value, index) => expect(replay[side][index]).toBeCloseTo(value, 6));
      }
    } finally {
      avatar.dispose();
      library.dispose();
      vi.unstubAllGlobals();
    }
  });
});

async function loadTextureFreeBaseModel() {
  // Use the shipped skeleton/skin; textures are irrelevant to a pose-history regression.
  const glb = readFileSync(new URL("../../../public/models/characters/quaternius/base-male.glb", import.meta.url));
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  const binary = glb.subarray(28 + jsonLength);
  document.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString("base64")}`;
  for (const mesh of document.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  document.materials = [];
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(document), "");
  return new ProceduralCharacterLibrary([
    {
      id: "base",
      adapterId: "quaternius-universal",
      label: "Base",
      url: "/models/characters/quaternius/base-male.glb",
      gltf,
    },
  ]);
}
