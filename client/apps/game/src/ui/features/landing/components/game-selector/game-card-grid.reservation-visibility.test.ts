// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game card reservation visibility", () => {
  it("shows the reservation action during the active blitz registration window", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("const canRegisterPeriod = isBlitzMode && (isUpcoming || (isOngoing && devModeOn));");
    expect(source).toContain("const showReserveButton = isBlitzMode && canRegisterPeriod;");
  });

  it("routes empty upcoming game grids to the create game page", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("const shouldShowCreateGameCta = isUpcomingOnlyStatusFilter(statusFilter);");
    expect(source).toContain('to="/factory"');
    expect(source).toContain("Forge New Game");
  });

  it("uses reservation labels instead of the legacy forge copy", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain('aria-label="Reserve Golden Tiles"');
    expect(source).toContain("animate-ping");
    expect(source).not.toContain("All Forged");
  });

  it("allows spectating registered blitz games during the registration window", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "const canSpectateRegisteredBlitz = isBlitzMode && canRegisterPeriod && game.isRegistered === true;",
    );
    expect(source).toContain("const canSpectate = isOngoing || isEnded || canSpectateRegisteredBlitz;");
  });
});
