import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/ui/design-system/icon", () => ({ Icon: () => null }));

import { PointsByActivity } from "./player-id";

const stat = (count: number, points: number) => ({ count, points });
const lines = (html: string) =>
  [...html.matchAll(/<dt[^>]*>(.*?)<\/dt><dd[^>]*>(.*?)<\/dd>/g)].map(([, label, value]) =>
    `${label.replace(/<[^>]+>/g, "")} = ${value}`.replace(/\s+/g, " "),
  );

describe("a player's points, beside the leaderboard", () => {
  it("lists only the activities that earned points, each with its count and points", () => {
    const html = renderToStaticMarkup(
      <PointsByActivity
        breakdown={{
          exploration: stat(123, 615),
          openRelicChest: stat(0, 0),
          otherStructureBanditsDefeat: stat(3, 750),
          hyperStructureBanditsDefeat: stat(2, 2_000),
          hyperstructureShare: stat(0, 2_000),
        }}
      />,
    );
    expect(lines(html)).toEqual([
      "Tiles explored · 123 = 615 points",
      "Rifts and camps taken · 3 = 750 points",
      "Hyperstructures taken · 2 = 2K points",
      "Hyperstructures held = 2K points",
    ]);
  });

  it("says when a player has no points yet, and when their points are still being read", () => {
    const none = { count: 0, points: 0 };
    expect(
      renderToStaticMarkup(
        <PointsByActivity
          breakdown={{
            exploration: none,
            openRelicChest: none,
            otherStructureBanditsDefeat: none,
            hyperStructureBanditsDefeat: none,
            hyperstructureShare: none,
          }}
        />,
      ),
    ).toContain("No points yet.");
    expect(renderToStaticMarkup(<PointsByActivity breakdown={null} />)).toContain("Reading the points");
  });
});
