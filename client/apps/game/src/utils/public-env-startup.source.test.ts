// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("public env startup", () => {
  it("parses public env without consulting browser runtime chain state", () => {
    const source = readFileSync(resolve(process.cwd(), "env.ts"), "utf8");

    expect(source).toContain("const parsedEnv = parsePublicEnv();");
    expect(source).toContain("return parsedEnv;");
    expect(source).not.toContain("getSelectedChain");
    expect(source).not.toContain("resolveRuntimePublicEnvConsistencyInput");
    expect(source).not.toContain("assertPublicEnvConsistency");
  });
});
