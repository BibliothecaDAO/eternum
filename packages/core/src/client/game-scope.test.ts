// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
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

// Deployment manifests describe previously deployed classes, including retired models.
// Read current declarations so this check follows model additions and removals.
function readContractModelKeys(): Array<{ name: string; firstKey: string | undefined }> {
  const sourceRoot = resolve(process.cwd(), "../../contracts/l3/game/src");
  return readdirSync(sourceRoot, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".cairo"))
    .flatMap((path) => {
      const source = readFileSync(resolve(sourceRoot, path), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
      const declarations = [
        ...source.matchAll(
          /#\[dojo::(?:model|event)[^\]]*\]\s*(?:#\[[^\]]*\]\s*)*(?:pub\s+)?struct\s+(\w+)\s*\{([^}]+)\}/g,
        ),
      ];
      expect(declarations.length, `Unparsed model declaration in ${path}`).toBe(
        [...source.matchAll(/#\[dojo::(?:model|event)\b/g)].length,
      );
      return declarations.map(([, name, body]) => ({
        name,
        firstKey: body.match(/#\[key\]\s*(?:pub\s+)?(\w+)\s*:/)?.[1],
      }));
    });
}

describe("game-scope", () => {
  beforeEach(() => {
    setGameScope("s2", 0);
  });

  it("pins S2_GLOBAL_MODELS to current contract key declarations", () => {
    const models = readContractModelKeys();
    const expected = models
      .filter(({ firstKey }) => firstKey !== "game_id")
      .map(({ name }) => name)
      .sort();
    expect([...s2GlobalModelNames()].sort()).toEqual(expected);
    setGameScope("s2", 7);
    for (const { name, firstKey } of models) {
      expect(isGameScopedModel(gameModel(name)), name).toBe(firstKey === "game_id");
    }
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
