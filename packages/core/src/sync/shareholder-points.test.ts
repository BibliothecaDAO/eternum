import { describe, expect, it } from "vitest";

import { calculateUnregisteredShareholderPoints } from "./shareholder-points";

describe("calculateUnregisteredShareholderPoints", () => {
  const rows = {
    gameRegistry: [{ end_at: "0xc8", game_id: "0x7", preset_id: "0x1" }],
    hyperstructures: [{ game_id: "0x7", hyperstructure_id: "0x2a", points_multiplier: "0x3" }],
    presets: [
      {
        preset_id: "0x1",
        victory_points_grant_config: { hyp_points_per_second: "0xf4240" },
      },
    ],
    shareholders: [
      {
        game_id: "0x7",
        hyperstructure_id: "0x2a",
        shareholders: [
          ["0xa", "0x1388"],
          ["0xa", 2_500],
          ["0xb", "0x9c4"],
        ],
        start_at: "0x64",
      },
    ],
  };

  it("aggregates duplicate shares and stops earning at the game end", () => {
    expect(calculateUnregisteredShareholderPoints(rows, 7, 300)).toEqual(
      new Map([
        ["0xa", 225],
        ["0xb", 75],
      ]),
    );
  });

  it("fails loudly when a shareholder row has no hyperstructure", () => {
    expect(() => calculateUnregisteredShareholderPoints({ ...rows, hyperstructures: [] }, 7, 150)).toThrow(
      "Hyperstructure row missing",
    );
  });
});
