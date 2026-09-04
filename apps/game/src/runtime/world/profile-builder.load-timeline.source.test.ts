// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("buildWorldProfile load timeline instrumentation", () => {
  it("records the one remote directory resolution step", () => {
    const source = readSource("src/runtime/world/profile-builder.ts");

    expect(source).toContain('measureAsyncDuration("game-profile-directory-fetch"');
    expect(source).not.toContain("/sql");
    expect(source).not.toContain("SqlApi");
  });
});
