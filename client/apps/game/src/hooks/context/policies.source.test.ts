import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = resolve(__dirname, "../../../../../..");

const readPolicySource = (relativePath: string): string => readFileSync(resolve(repositoryRoot, relativePath), "utf8");

describe("session policy sources", () => {
  test.each([
    ["game", "client/apps/game/src/hooks/context/policies.ts"],
    ["mobile", "client/apps/eternum-mobile/src/app/dojo/context/policies.ts"],
  ])("%s config policies include biome climate updates", (_, policyPath) => {
    const source = readPolicySource(policyPath);

    expect(source).toContain('name: "set_biome_climate_config"');
    expect(source).toContain('entrypoint: "set_biome_climate_config"');
  });
});
