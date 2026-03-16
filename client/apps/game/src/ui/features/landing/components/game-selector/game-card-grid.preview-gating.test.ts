import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game card dev preview gating", () => {
  it("treats local preview entry as sufficient client-side permission to play and exposes a reset action", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("const hasPreviewEntry = previewEntry?.previewEntered === true;");
    expect(source).toContain("const canPlay = isOngoing && (game.isRegistered || hasPreviewEntry);");
    expect(source).toContain("{hasPreviewEntry && (");
    expect(source).toContain("Clear Preview");
  });
});
