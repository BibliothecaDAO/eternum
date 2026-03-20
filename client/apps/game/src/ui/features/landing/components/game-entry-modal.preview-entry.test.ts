import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game entry modal dev preview disclosure", () => {
  it("shows explicit local-only preview copy and keeps the selected loadout summary visible", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-entry-modal.tsx"),
      "utf8",
    );

    expect(source).toContain("isPreviewMode");
    expect(source).toContain("Local Dev Preview");
    expect(source).toContain("This enters the world without a registration transaction.");
    expect(source).toContain("Other players will not see this preview.");
    expect(source).toContain("previewLoadoutSummary");
  });
});
