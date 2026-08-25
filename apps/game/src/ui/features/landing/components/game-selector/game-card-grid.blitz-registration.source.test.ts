// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game card reservation visibility", () => {
  it("keeps the blitz registration window logic but no longer renders a separate reserve action", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("const canRegisterPeriod = isBlitzMode && (isUpcoming || (isOngoing && devModeOn));");
    expect(source).not.toContain("showReserveButton");
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

  it("removes the separate landing hyperstructure setup button", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).not.toContain("showReserveButton");
    expect(source).not.toContain("onReserveHyperstructures");
    expect(source).not.toContain("animate-ping");
  });

  it("allows spectating blitz games during the registration window", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("const canSpectatePreMainBlitz = isBlitzMode && canRegisterPeriod;");
    expect(source).toContain("const canSpectate = isOngoing || isEnded || canSpectatePreMainBlitz;");
  });

  it("shows an enter action for registered blitz games without removing spectate", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "const canEnterRegisteredBlitz = isBlitzMode && showRegistered && (isUpcoming || isOngoing);",
    );
    expect(source).toContain('canEnterRegisteredBlitz ? "Enter"');
    expect(source).toContain("{canSpectate && (");
  });
});
