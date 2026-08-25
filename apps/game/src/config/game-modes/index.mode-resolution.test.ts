import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game mode runtime resolution", () => {
  it("does not rely on forced env mode overrides in runtime resolution", () => {
    const source = readFileSync(resolve(process.cwd(), "src/config/game-modes/index.ts"), "utf8");

    expect(source).not.toContain("VITE_PUBLIC_FORCE_GAME_MODE_ID");
    expect(source).toContain("resolveGameModeFromBlitzFlag");
    expect(source).toContain(
      "const worldBlitzModeOnFlag = options.blitzModeOn ?? configManager.getBlitzConfig()?.blitz_mode_on;",
    );
  });
});
