import { expect, it } from "vitest";
import { computeSeasonTop } from "./season-top";

it("uses seasonal ratings and numeric wallet order for ties", () => {
  expect(
    computeSeasonTop(
      [
        { wallet: "0x10", mmr: "200" },
        { wallet: "0x2", mmr: "200" },
        { wallet: "0x1", mmr: "100" },
      ],
      5000,
    ),
  ).toEqual(["0x2", "0x10"]);
});
it("rejects a duplicate population instead of silently changing the winner count", () => {
  expect(() =>
    computeSeasonTop(
      [
        { wallet: "0x1", mmr: "100" },
        { wallet: "0x01", mmr: "100" },
      ],
      1000,
    ),
  ).toThrow("duplicate_season_participant");
});
