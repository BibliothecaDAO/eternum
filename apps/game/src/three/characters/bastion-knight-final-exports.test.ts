// @vitest-environment node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Quaternion, type Object3D } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BASTION_KNIGHT_HUMANOID_RIG_ADAPTER } from "./bastion-knight-humanoid-rig-adapter";
import { resolveDrivenJointRotation } from "./procedural-character-driven-joints";
import { loadBastionKnightCharacterAssetTemplates } from "./bastion-knight-character-assets";
import { ProceduralCharacterAvatar } from "./procedural-character-avatar";
import { ProceduralCharacterLibrary } from "./procedural-character-assets";
import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveProceduralCharacterPose } from "./procedural-character-pose";
import { applyCharacterRigLimbLengths, resolveCharacterRig } from "./procedural-character-rig";
import { validateKnightGear } from "./melee/procedural-melee-weapon-library";
import { parseTextureFreeGlb } from "./procedural-unit-test-glb";

const PREFIX = "/models/characters/t1-knight-default/";
const EXPORT_HASHES = {
  "near/skin.glb": "64cb970966a22198c8e6c3d23e7083d03cbbf725cc8804a189c0c948b89980df",
  "mid/skin.glb": "77c063eacac7b9f01d82584f78e1367470750e8b51db204d5e2ea4ef2b362832",
  "near/sword.glb": "936ec58de22c9ac6b8a4523f7bb939051c32e05b8f6246ef2976e4ad13b46fa3",
  "near/shield.glb": "684c39a49bb524c0a85b05eb5b50df00f28a1b117a4d411e1b29313a0b198424",
} as const;
const SKIN_JOINT_COUNT = 31;

const KNIGHT_ASSET_ROOT = `public${PREFIX}`;
const VALIDATOR = resolve(process.cwd(), "scripts/validate-bastion-final-exports.mjs");

/** Runs the validator in a scratch copy of the Knight files whose near skin has had its skin joints rewritten. */
function runValidatorWithNearSkinJoints(rewriteJoints: (joints: number[]) => number[]) {
  const workDirectory = mkdtempSync(join(tmpdir(), "knight-validator-"));
  try {
    cpSync(resolve(process.cwd(), KNIGHT_ASSET_ROOT), join(workDirectory, KNIGHT_ASSET_ROOT), { recursive: true });
    const skinPath = join(workDirectory, KNIGHT_ASSET_ROOT, "near/skin.glb");
    const bytes = readFileSync(skinPath);
    const jsonLength = bytes.readUInt32LE(12);
    const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
    document.skins[0].joints = rewriteJoints(document.skins[0].joints);
    const json = Buffer.from(JSON.stringify(document));
    const paddedJson = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
    const binary = bytes.subarray(20 + jsonLength);
    const header = Buffer.from(bytes.subarray(0, 20));
    header.writeUInt32LE(20 + paddedJson.length + binary.length, 8);
    header.writeUInt32LE(paddedJson.length, 12);
    writeFileSync(skinPath, Buffer.concat([header, paddedJson, binary]));
    return spawnSync(process.execPath, [VALIDATOR], { cwd: workDirectory, encoding: "utf8" });
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

function expectDrivenJointsFollowCoreJoints(scene: Object3D): void {
  let largestFollowedTurn = 0;
  for (const definition of BASTION_KNIGHT_HUMANOID_RIG_ADAPTER.drivenJoints) {
    const driven = scene.getObjectByName(definition.bone)?.quaternion;
    const follows = scene.getObjectByName(definition.follows)?.quaternion;
    if (!driven || !follows) throw new Error(`Knight scene is missing ${definition.bone} or ${definition.follows}`);
    const expected = resolveDrivenJointRotation(definition, follows, new Quaternion());
    expect(Math.abs(driven.dot(expected))).toBeGreaterThan(1 - 1e-9);
    largestFollowedTurn = Math.max(largestFollowedTurn, follows.angleTo(new Quaternion()));
  }
  expect(largestFollowedTurn).toBeGreaterThan(0.05);
}

async function withKnightLibrary(run: (library: ProceduralCharacterLibrary) => Promise<void>): Promise<void> {
  vi.stubGlobal("ProgressEvent", class extends Event {});
  const gltfs = new Map<string, GLTF>();
  for (const relativePath of ["near/skin.glb", "mid/skin.glb"] as const) {
    const url = PREFIX + relativePath;
    gltfs.set(url, await parseTextureFreeGlb(url));
  }
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async (url) => {
    const gltf = gltfs.get(String(url));
    if (!gltf) throw new Error(`Unexpected Knight asset: ${String(url)}`);
    return gltf;
  });
  const library = new ProceduralCharacterLibrary(await loadBastionKnightCharacterAssetTemplates());
  try {
    await run(library);
  } finally {
    library.dispose();
  }
}

function createKnightAvatar(library: ProceduralCharacterLibrary, renderDetail: "hero" | "crowd") {
  const config = {
    ...createDefaultProceduralCharacterConfig(),
    appearanceId: "t1-knight-bastion-default" as const,
    renderDetail,
    tier: 1 as const,
  };
  const asset = library.instantiate(config.appearanceId, config.tier, renderDetail);
  expect(asset.id).toBe(renderDetail === "hero" ? "t1-knight-bastion-near" : "t1-knight-bastion-mid");
  const rig = resolveCharacterRig(config);
  return { asset, avatar: new ProceduralCharacterAvatar(asset, rig, config), config, rig };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("T1 Knight exports", () => {
  it("pins the four public GLBs", () => {
    for (const [relativePath, expected] of Object.entries(EXPORT_HASHES)) {
      const bytes = readFileSync(resolve(process.cwd(), `public${PREFIX}${relativePath}`));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);
    }
  });

  it("accepts the 31-joint skeleton in the contract order", () => {
    const result = runValidatorWithNearSkinJoints((joints) => joints);
    expect(result.status).toBe(0);
  }, 60_000);

  it("rejects a 25-joint skin", () => {
    const result = runValidatorWithNearSkinJoints((joints) => joints.slice(0, 25));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("near/skin.glb: expected 31-joint skin");
  }, 60_000);

  it("rejects a skin whose joints are out of order", () => {
    const result = runValidatorWithNearSkinJoints((joints) => [joints[1], joints[0], ...joints.slice(2)]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("skin joint names or order differ from the Knight skeleton");
  }, 60_000);

  it("round-trips the actual near and mid skins through GLTFLoader and the runtime library", async () => {
    await withKnightLibrary(async (library) => {
      for (const renderDetail of ["hero", "crowd"] as const) {
        const { asset, avatar, config, rig } = createKnightAvatar(library, renderDetail);
        try {
          // The same calibration the runtime runs on construction and asset swap (calibrateRigToActiveAvatar).
          avatar.rebuild(applyCharacterRigLimbLengths(rig, avatar.measureActiveLimbLengths()), config);
          expect(avatar.getStats().boneCount).toBe(SKIN_JOINT_COUNT);
          // Above 0.7, not higher: the three points are the measured knuckles, and the plane through knuckles and
          // wrist is 8 degrees off the palm's facing. The value is 0.751 on both hands.
          expect(avatar.getStats().leftPalmInwardDot).toBeGreaterThan(0.7);
          expect(avatar.getStats().rightPalmInwardDot).toBeGreaterThan(0.7);
          for (const mode of ["idle", "walk", "run"] as const) {
            const posed = { ...config, animationMode: mode };
            avatar.updateConfig(posed);
            avatar.applyPose(resolveProceduralCharacterPose(rig, posed, 0.25));
            expect(avatar.hasFiniteTransforms()).toBe(true);
            expectDrivenJointsFollowCoreJoints(asset.gltf.scene);
          }
        } finally {
          avatar.dispose();
        }
      }
    });
  });

  it("measures the source body with the chest between the upper arms", async () => {
    await withKnightLibrary(async (library) => {
      const { avatar, rig } = createKnightAvatar(library, "hero");
      try {
        const { body } = avatar.measureActiveLimbLengths();
        if (!body) throw new Error("Knight adapter must measure the source body");
        expect(body.pelvisToChest).toBeCloseTo(0.1611, 3);
        expect(body.chestToNeck).toBeCloseTo(0.0304, 3);
        const calibrated = applyCharacterRigLimbLengths(rig, avatar.measureActiveLimbLengths());
        expect(calibrated.parts.pelvis.halfExtents?.[1]).toBeCloseTo(0.1338, 3);
        expect(calibrated.parts.chest.halfExtents?.[1]).toBeCloseTo(0.0304, 3);
      } finally {
        avatar.dispose();
      }
    });
  });

  it("measures the chest at the diagnostic bone when the adapter names no pair of joints", async () => {
    await withKnightLibrary(async (library) => {
      const { asset, config, rig } = createKnightAvatar(library, "hero");
      const plainAdapter = { ...asset.adapter, sourceBodyChestBetween: undefined };
      const avatar = new ProceduralCharacterAvatar({ ...asset, adapter: plainAdapter }, rig, config);
      try {
        const { body } = avatar.measureActiveLimbLengths();
        expect(body?.pelvisToChest).toBeCloseTo(0.0763, 3);
        expect(body?.chestToNeck).toBeCloseTo(0.1149, 3);
      } finally {
        avatar.dispose();
      }
    });
  });

  it("round-trips the actual rigid sword and shield through GLTFLoader", async () => {
    vi.stubGlobal("ProgressEvent", class extends Event {});
    for (const [relativePath, id] of [
      ["near/sword.glb", "t1-knight-bastion-sword"],
      ["near/shield.glb", "t1-knight-bastion-shield"],
    ] as const) {
      const gltf = await parseTextureFreeGlb(PREFIX + relativePath);
      expect(() => validateKnightGear(gltf, id)).not.toThrow();
    }
  }, 30_000);
});
