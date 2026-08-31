// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  gameIdKey,
  gameModel,
  isGameScopedModel,
  namespaceForChain,
  s2GlobalModelNames,
  setGameScope,
} from "./game-scope";

type ManifestEntry = { tag: string; members?: Array<{ name: string; key?: boolean }> };

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../contracts/l3/game/manifest_appchain_blitz.json"), "utf8"),
) as { models?: ManifestEntry[]; events?: ManifestEntry[] };

const deriveGlobalNames = (entries: ManifestEntry[] = []): string[] =>
  entries
    .filter((entry) => {
      const keyNames = (entry.members ?? []).filter((member) => member.key).map((member) => member.name);
      return keyNames[0] !== "game_id";
    })
    .map((entry) => entry.tag.split("-", 2)[1] ?? entry.tag);

describe("game-scope", () => {
  beforeEach(() => {
    setGameScope("s2", 0);
  });

  it("pins S2_GLOBAL_MODELS to the manifest's key flags", () => {
    const expected = [...deriveGlobalNames(manifest.models), ...deriveGlobalNames(manifest.events)].sort();
    expect([...s2GlobalModelNames()].sort()).toEqual(expected);
  });

  it("maps chains to namespaces", () => {
    expect(namespaceForChain("appchain")).toBe("s2");
    expect(namespaceForChain("madara")).toBe("s2");
  });

  it("does not scope models before a game is selected", () => {
    expect(gameModel("TileOpt")).toBe("s2-TileOpt");
    expect(isGameScopedModel("s2-TileOpt")).toBe(false);
    expect(isGameScopedModel("s2-AddressName")).toBe(false);
  });

  it("scopes per-game models but not chain-global models on s2", () => {
    setGameScope("s2", 7);
    expect(gameModel("TileOpt")).toBe("s2-TileOpt");
    // D16-pinned key encoding: unpadded hex.
    expect(gameIdKey()).toBe("0x7");
    expect(isGameScopedModel("s2-TileOpt")).toBe(true);
    expect(isGameScopedModel("s2-GameRegistry")).toBe(true);
    expect(isGameScopedModel("s2-AddressName")).toBe(false);
    expect(isGameScopedModel("s2-PresetConfig")).toBe(false);
  });
});
