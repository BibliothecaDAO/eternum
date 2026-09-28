// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadBastionKnightCharacterAssetTemplates } from "./bastion-knight-character-assets";
import { ProceduralCharacterAvatar } from "./procedural-character-avatar";
import { ProceduralCharacterLibrary } from "./procedural-character-assets";
import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveProceduralCharacterPose } from "./procedural-character-pose";
import { applyCharacterRigLimbLengths, resolveCharacterRig } from "./procedural-character-rig";
import { validateKnightGear } from "./melee/procedural-melee-weapon-library";
import { parseTextureFreeGlb } from "./procedural-unit-test-glb";

const PREFIX = "/models/characters/t1-knight-default/";
const R3_V19E_HASHES = {
  "near/skin.glb": "0d8023826f21db81462b8e995f1eb3d79c61d9150d2ec61cc01f75e50df5fb58",
  "mid/skin.glb": "3d10d724589122729cb686f7d7a6dbd95ee872b0d4e9e855e3d1b65b196bf5ba",
  "near/sword.glb": "d89fd42c8fccfd42cac8fa5b4a02773b4d8ab8233685c3ab864b5c6719c48676",
  "near/shield.glb": "5c19d48a1cbe2a1aa4fe707c47e88253cfababd72d8ed09064201524b6db9f1a",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("T1 Knight R3 v19e exports", () => {
  it("pins the four public GLBs", () => {
    for (const [relativePath, expected] of Object.entries(R3_V19E_HASHES)) {
      const bytes = readFileSync(resolve(process.cwd(), `public${PREFIX}${relativePath}`));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);
    }
  });

  it("round-trips the actual near and mid skins through GLTFLoader and the runtime library", async () => {
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
      for (const renderDetail of ["hero", "crowd"] as const) {
        const config = {
          ...createDefaultProceduralCharacterConfig(),
          appearanceId: "t1-knight-bastion-default" as const,
          renderDetail,
          tier: 1 as const,
        };
        const asset = library.instantiate(config.appearanceId, config.tier, renderDetail);
        expect(asset.id).toBe(renderDetail === "hero" ? "t1-knight-bastion-near" : "t1-knight-bastion-mid");
        let rig = resolveCharacterRig(config);
        const avatar = new ProceduralCharacterAvatar(asset, rig, config);
        try {
          rig = applyCharacterRigLimbLengths(rig, avatar.measureActiveLimbLengths());
          avatar.rebuild(rig, config);
          expect(avatar.getStats().leftPalmInwardDot).toBeGreaterThan(0.8);
          expect(avatar.getStats().rightPalmInwardDot).toBeGreaterThan(0.9);
          for (const mode of ["idle", "walk", "run"] as const) {
            const posed = { ...config, animationMode: mode };
            avatar.updateConfig(posed);
            avatar.applyPose(resolveProceduralCharacterPose(rig, posed, 0.25));
            expect(avatar.hasFiniteTransforms()).toBe(true);
          }
        } finally {
          avatar.dispose();
        }
      }
    } finally {
      library.dispose();
    }
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
