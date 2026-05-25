import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("PlayView live games dev visibility", () => {
  it("aliases active-game spectate to the play flow", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");
    const activeGamesStart = source.indexOf("const RegisteredActiveGamesBar = ({");
    const playTabStart = source.indexOf("/**\n * Play tab content layered as:");
    const activeGamesBlock = source.slice(activeGamesStart, playTabStart);

    expect(activeGamesStart).toBeGreaterThan(-1);
    expect(playTabStart).toBeGreaterThan(activeGamesStart);
    expect(activeGamesBlock).toContain("onSpectate={onPlayGame}");
  });

  it("does not hard-filter the open games grid to production only", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");
    const openStart = source.indexOf("{/* Open Games Column */}");
    const playedStart = source.indexOf("{/* Played Column (ended games) */}");
    const openBlock = source.slice(openStart, playedStart);

    expect(openStart).toBeGreaterThan(-1);
    expect(playedStart).toBeGreaterThan(openStart);
    expect(openBlock).not.toContain("devModeFilter={false}");
  });

  it("refreshes the landing summary query for open games", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");

    expect(source).toContain("await invalidateWorldListQueries(queryClient)");
    expect(source).not.toContain('invalidateQueries({ queryKey: ["worldAvailability"] })');
  });
});
