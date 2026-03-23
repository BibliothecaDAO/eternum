import { describe, expect, it } from "vitest";
import { buildFactoryRotationPreviewGames } from "./rotation-drafts";

describe("buildFactoryRotationPreviewGames", () => {
  it("keeps the requested interval between the first and second preview game", () => {
    const previewGames = buildFactoryRotationPreviewGames({
      rotationName: "bltz-rotationx",
      firstStartAt: "2026-03-23T12:00",
      gameIntervalMinutes: 30,
      advanceWindowGames: 5,
    });

    expect(previewGames.map((game) => game.startAt)).toEqual([
      "2026-03-23T12:00",
      "2026-03-23T12:30",
      "2026-03-23T13:00",
      "2026-03-23T13:30",
      "2026-03-23T14:00",
    ]);
  });
});
