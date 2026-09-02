// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("procedural horse runtime source", () => {
  it("retains the runtime Group import required by the persistent actor root", () => {
    const source = readFileSync(new URL("./procedural-horse-runtime.ts", import.meta.url), "utf8");

    expect(source).toContain('import { Group, Quaternion, Vector3 } from "three";');
    expect(source).not.toContain("type Group");
  });
});
