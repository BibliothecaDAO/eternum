// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

/** Identity, held until a test answers it: a name, none, or a failure; the Faith facts, unchanged throughout. */
const held = vi.hoisted(() => ({
  answer: undefined as undefined | ((name: string | null, fail?: boolean) => void),
  rows: { faithfulStructures: [], wonderFaith: [], structures: [] as unknown[] },
}));
vi.mock("@realms-world/identity", async (original) => ({
  ...(await original<typeof import("@realms-world/identity")>()),
  fetchIdentityProfiles: (_origin: string, accounts: string[]) =>
    new Promise((resolve, reject) => {
      held.answer = (name, fail) =>
        fail
          ? reject(new Error("identity 503"))
          : resolve(Object.fromEntries(accounts.map((account) => [account, { name, portrait: null }])));
    }),
}));
vi.mock("@/services/leaderboard/use-faith-read-models", () => ({ useFaithReadModels: () => held.rows }));
// The detail's claim buttons ask the order gate, which reads the game's config: no orders here.
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => false }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { systemCalls: {} }, account: { account: { address: "0x1" } } }),
}));

import { FaithLeaderboardPanel } from "./faith-leaderboard-panel";
import { WonderFaithDetailPanel } from "./wonder-faith-detail-panel";
import { getPlayerDisplayName } from "@/services/identity/player-profiles";

// Each owner is new to the profile service, so their name is asked once, with nothing else in the batch.
it.each([
  [7, "0x5eed0f00", "Maelis", false, "Maelis"],
  [8, "0x5eed0f01", null, true, "—"],
  [9, "0x5eed0f02", null, false, "Lord 0f02"],
] as const)(
  "names wonder %s's owner on the board and in its detail once identity answers, its facts unchanged",
  async (wonder, owner, name, failed, expected) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    held.rows = {
      faithfulStructures: [],
      wonderFaith: [],
      structures: [{ display_name: "Wonder", entity_id: wonder, owner, metadata: { has_wonder: true, realm_id: 0 } }],
    };
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <>
            <section data-board>
              <FaithLeaderboardPanel />
            </section>
            <section data-detail>
              <WonderFaithDetailPanel wonderId={wonder} />
            </section>
          </>,
        ),
      );
      const board = host.querySelector("[data-board]")!;
      const detail = host.querySelector("[data-detail]")!;
      expect(board.textContent).toContain("…");
      expect(detail.textContent).toContain("…");
      await vi.waitFor(() => expect(held.answer).toBeDefined());

      await act(async () => {
        held.answer!(name, failed);
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(getPlayerDisplayName(owner)).toBe(expected);
      expect(board.textContent).toContain(expected);
      expect(board.textContent).not.toContain("…");
      expect(detail.textContent).toContain(expected);
      expect(detail.textContent).not.toContain("…");
    } finally {
      await act(async () => root.unmount());
      held.answer = undefined;
    }
  },
);
