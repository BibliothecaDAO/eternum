import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("keeps Settings to an identity header and the three requested sections", () => {
  const source = readFileSync("src/ui/modules/settings/settings.tsx", "utf8");
  for (const removed of [
    "Zoom",
    "atmosphere",
    "Dojo",
    "LatestFeatures",
    "Return Home",
    "Whitelist",
    "success",
    "text-green",
  ])
    expect(source).not.toContain(removed);
  for (const title of ["Video & Graphics", "Audio", "Game"]) expect(source).toContain(`title="${title}"`);
  expect(source).toContain("bg-gold text-dark-brown");
  expect(source).toContain("Copy address");
  expect(source).toContain("Leave game");
});
