import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("World availability registration capacity metadata", () => {
  it("includes registration_count_max in blitz metadata query parsing", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/use-world-availability.ts"), "utf8");

    expect(source).toContain('"blitz_registration_config.registration_count_max" AS registration_count_max');
    expect(source).toContain("registrationCountMax");
  });

  it("includes eternum settled players, realms, and villages counts", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/use-world-availability.ts"), "utf8");

    expect(source).toContain("AS settled_players_count");
    expect(source).toContain("AS settled_realms_count");
    expect(source).toContain("AS settled_villages_count");
    expect(source).toContain("settledPlayersCount");
    expect(source).toContain("settledRealmsCount");
    expect(source).toContain("settledVillagesCount");
  });
});
