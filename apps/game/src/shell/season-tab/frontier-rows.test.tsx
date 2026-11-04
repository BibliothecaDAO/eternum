import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", () => new Promise<Response>(() => {})));

import { FrontierRows } from "./frontier-rows";

it("says what each of a board row's counts is, on hover and to a screen reader, never a bare number (qa-app-1 P3-7)", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const entry = {
    address: "0x5eed",
    rank: 1,
    order: 1,
    level: 0,
    deepest_depth: 0,
    campaign: null,
    has_wonder: true,
    sites_cleared: { total: 12 },
    rewards: { lords: "340" },
  } as unknown as HeraldFrontierLeaderboardEntry;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FrontierRows rows={[{ entry, own: false }]} />
      </MemoryRouter>,
    ),
  );
  try {
    expect(container.querySelector('[data-icon="wonder-realm-0"]')).not.toBeNull();
    expect(container.querySelector('[role="img"][aria-label="Wonder · Settlement"]')).not.toBeNull();
    const figures = [...container.querySelectorAll<HTMLElement>(".app-board__figure")];
    expect(figures.map((figure) => [figure.textContent, figure.title])).toEqual([
      ["12 sites cleared", "sites cleared"],
      ["340 LORDS", "LORDS"],
    ]);
  } finally {
    await act(async () => root.unmount());
  }
});
