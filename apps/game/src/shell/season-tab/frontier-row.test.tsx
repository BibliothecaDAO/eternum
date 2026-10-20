import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", () => new Promise<Response>(() => {})));

import { FrontierRow } from "./frontier-row";

it("says what each of a board row's counts is, on hover and to a screen reader, never a bare number (qa-app-1 P3-7)", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const entry = {
    address: "0x5eed",
    rank: 1,
    order: 1,
    sites_cleared: { total: 12 },
    rewards: { lords: "340" },
  } as unknown as HeraldFrontierLeaderboardEntry;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FrontierRow entry={entry} own={false} />
      </MemoryRouter>,
    ),
  );
  try {
    const chips = [...container.querySelectorAll<HTMLElement>(".app-chip")];
    expect(chips.map((chip) => [chip.textContent, chip.title])).toEqual([
      ["12 sites cleared", "sites cleared"],
      ["340 LORDS", "LORDS"],
    ]);
  } finally {
    await act(async () => root.unmount());
  }
});
