import { describe, it, expect } from "vitest";
import { formatStatus } from "../../../src/automation/status.js";

describe("formatStatus", () => {
  it("formats a tick with build + production", () => {
    const text = formatStatus({
      timestamp: new Date("2026-03-08T12:00:00Z"),
      realms: [
        {
          realmEntityId: 100,
          realmName: "Ironforge",
          biome: 11,
          level: 1,
          buildOrderProgress: "6/13",
          tickResult: {
            realmEntityId: 100,
            built: "CoalMine",
            upgraded: null,
            produced: true,
            idle: false,
            errors: [],
          },
          essencePulse: { balance: 200, sufficient: true },
          wheatPulse: { balance: 5000, low: false, movesRemaining: 250 },
        },
      ],
    });

    expect(text).toContain("Ironforge");
    expect(text).toContain("CoalMine");
    expect(text).toContain("6/13");
    expect(text).toContain("Production: executed");
  });

  it("formats idle realm", () => {
    const text = formatStatus({
      timestamp: new Date("2026-03-08T12:00:00Z"),
      realms: [{
        realmEntityId: 100,
        realmName: "Quiet",
        biome: 11,
        level: 4,
        buildOrderProgress: "13/13",
        tickResult: {
          realmEntityId: 100,
          built: null,
          upgraded: null,
          produced: false,
          idle: true,
          errors: [],
        },
        essencePulse: { balance: 0, sufficient: true },
        wheatPulse: { balance: 100, low: true, movesRemaining: 5 },
      }],
    });

    expect(text).toContain("Idle");
    expect(text).toContain("LOW");
  });
});
