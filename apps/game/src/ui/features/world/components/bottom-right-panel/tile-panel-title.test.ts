import { FELT_CENTER } from "@bibliothecadao/eternum";
import { expect, it } from "vitest";
import { formatTilePanelTitle } from "./tile-panel-title";

it.each(["Structure Tile", "Army Tile", "Biome"])("normalizes %s coordinates exactly once", (label) => {
  const normalized = { col: 5, row: -3 };
  const contract = { col: FELT_CENTER() + 5, row: FELT_CENTER() - 3 };
  expect(formatTilePanelTitle(label, normalized)).toBe(`${label} · (5, -3)`);
  expect(formatTilePanelTitle(label, contract)).toBe(`${label} · (5, -3)`);
});
