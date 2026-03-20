import { describe, expect, it } from "vitest";

import { normalizeVitestTargetArgs } from "../../scripts/vitest-target-args.mjs";

describe("normalizeVitestTargetArgs", () => {
  it("drops the pnpm-injected separator before forwarding file targets", () => {
    expect(normalizeVitestTargetArgs(["--", "src/three/webgpu-renderer-backend.test.ts"])).toEqual([
      "src/three/webgpu-renderer-backend.test.ts",
    ]);
  });

  it("preserves already-normalized vitest arguments", () => {
    expect(normalizeVitestTargetArgs(["src/three/renderer-diagnostics.test.ts", "--reporter=dot"])).toEqual([
      "src/three/renderer-diagnostics.test.ts",
      "--reporter=dot",
    ]);
  });
});
