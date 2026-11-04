// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

import { COMPACT_HUD_MEDIA_QUERY, COMPACT_LANDSCAPE_MEDIA_QUERY } from "@/hooks/helpers/use-compact-hud";

const SHEET = readFileSync(join(__dirname, "hud-sheet.css"), "utf8");
const mediaQueries = [...SHEET.matchAll(/@media ([^{]+)\{/g)].map(([, query]) => query.trim());

it("lays the sideways HUD out by the one query the HUD's code reads, every time the sheet does", () => {
  const sideways = mediaQueries.filter((query) => query.includes("orientation: landscape"));
  expect(sideways.length).toBeGreaterThan(0);
  expect(new Set(sideways)).toEqual(new Set([COMPACT_LANDSCAPE_MEDIA_QUERY]));
});

it("writes the phone's width as the compact query does, never as a number of its own", () => {
  const widths = mediaQueries.flatMap((query) => [...query.matchAll(/\(max-width: \d+px\)/g)].map(([width]) => width));
  expect(new Set(widths)).toEqual(new Set([COMPACT_HUD_MEDIA_QUERY]));
});
