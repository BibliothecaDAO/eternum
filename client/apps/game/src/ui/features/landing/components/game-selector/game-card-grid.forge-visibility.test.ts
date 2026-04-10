import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game card forge visibility", () => {
  it("allows forge button during dev-mode ongoing registration period", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("const canRegisterPeriod = isBlitzMode && (isUpcoming || (isOngoing && devModeOn));");
    expect(source).toContain(
      "const showForgeButton = isBlitzMode && game.config?.numHyperstructuresLeft !== null && playerAddress;",
    );
  });
});
