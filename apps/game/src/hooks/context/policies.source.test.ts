import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = resolve(__dirname, "../../../../../..");

const readPolicySource = (relativePath: string): string => readFileSync(resolve(repositoryRoot, relativePath), "utf8");

describe("session policy sources", () => {
  test("game config policies include biome climate updates", () => {
    const source = readPolicySource("apps/game/src/hooks/context/policies.ts");

    expect(source).toContain('name: "set_biome_climate_config"');
    expect(source).toContain('entrypoint: "set_biome_climate_config"');
  });
});
