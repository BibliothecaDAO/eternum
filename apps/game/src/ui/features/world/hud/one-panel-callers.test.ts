import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("review: picked-tile panels also delegate their outer frame to the shared panel", () => {
  const callers = [
    "../components/actions/selected-worldmap-entity.tsx",
    "../components/actions/chest-tile-details.tsx",
    "../components/entities/banner/structure-banner-entity-detail.tsx",
  ];
  const own = callers.flatMap((path) =>
    readFileSync(join(__dirname, path), "utf8")
      .split("\n")
      .flatMap((line, index) =>
        line.includes("<div") && line.includes("OVERLAY_SURFACE_BASE") ? [`${path}:${index + 1}: ${line.trim()}`] : [],
      ),
  );
  expect(own).toEqual([]);
});
