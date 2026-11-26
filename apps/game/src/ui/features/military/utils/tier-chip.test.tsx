import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { configManager } from "@bibliothecadao/eternum";

import { TierChip } from "./tier-chip";

afterEach(() => vi.restoreAllMocks());

it("shows a troop's tier in Blitz and nothing in Frontier, where every troop is tier 1", () => {
  vi.spyOn(configManager, "isFrontier").mockReturnValue(false);
  expect(renderToStaticMarkup(<TierChip tier="T2" />)).toContain('data-tier="2"');
  vi.spyOn(configManager, "isFrontier").mockReturnValue(true);
  expect(renderToStaticMarkup(<TierChip tier="T2" />)).toBe("");
});
