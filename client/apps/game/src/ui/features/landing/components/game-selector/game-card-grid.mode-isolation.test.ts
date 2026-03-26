import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game card mode isolation", () => {
  it("uses explicit blitz equality and neutral unknown mode handling", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain('const isBlitzMode = game.config?.mode === "blitz";');
    expect(source).toContain('const isUnknownMode = game.config?.mode === "unknown" || !game.config?.mode;');
    expect(source).toContain("const canPlay = !isUnknownMode && (canPlayBlitz || canOpenEternumEntry);");
    expect(source).toContain("Detecting mode...");
  });
});
