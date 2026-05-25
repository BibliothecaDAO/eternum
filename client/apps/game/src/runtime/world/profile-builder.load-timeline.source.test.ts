// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("buildWorldProfile load timeline instrumentation", () => {
  it("records durations for each remote world-profile resolution step", () => {
    const source = readSource("src/runtime/world/profile-builder.ts");

    expect(source).toContain('measureAsyncDuration("world-profile-contract-resolution"');
    expect(source).toContain('measureAsyncDuration("world-profile-deployment-resolution"');
    expect(source).toContain('measureAsyncDuration("world-profile-world-address-fetch"');
    expect(source).toContain('measureAsyncDuration("world-profile-config-fetch"');
  });
});
