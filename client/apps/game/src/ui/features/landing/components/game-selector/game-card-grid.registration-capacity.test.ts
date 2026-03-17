import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game card registration capacity", () => {
  it("renders a full-capacity state when registration is full", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("isRegistrationFull");
    expect(source).toContain("Registration full");
  });

  it("shows current and max players when max capacity is known", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("const registrationCountMax = game.config?.registrationCountMax ?? null;");
    expect(source).toContain("`${registrationCount}/${registrationCountMax} players`");
  });
});
