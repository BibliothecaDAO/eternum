// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";

/** Identity, held until a test answers it: a name, none, or a failure. */
const pending = vi.hoisted(() => ({
  answer: undefined as undefined | ((name: string | null, fail?: boolean) => void),
}));
vi.mock("@realms-world/identity", async (original) => ({
  ...(await original<typeof import("@realms-world/identity")>()),
  fetchIdentityProfiles: (_origin: string, accounts: string[]) =>
    new Promise((resolve, reject) => {
      pending.answer = (name, fail) =>
        fail
          ? reject(new Error("identity 503"))
          : resolve(Object.fromEntries(accounts.map((account) => [account, { name, portrait: null }])));
    }),
}));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1" }) }));
vi.mock("@bibliothecadao/eternum/game-client", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum/game-client")>()),
  requireShard: () => ({ url: "http://herald.test", chainId: "0x1", worldAddress: "0xabc" }),
  fetchHeraldGameHistory: async () => ({ items: [], complete_through_block: 35, limit: 10, offset: 0, total: 0 }),
}));
vi.mock("@bibliothecadao/eternum", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum")>()),
  configManager: { getActiveGameId: () => 1 },
}));

import { acceptGameSyncStoryEvent, resetGameSyncStoryEvents, useStoryEvents } from "./use-story-events-store";
import { getPlayerDisplayName } from "@/services/identity/player-profiles";

// Each account is new to the profile service, so its name is asked once, with nothing else in the batch.
it.each([
  ["0x5eed0abc", "Maelis", false, "Maelis"],
  ["0x5eed0abd", null, true, "—"],
  ["0x5eed0abe", null, false, "Lord 0abe"],
] as const)(
  "writes a story's player again once identity answers, with no game event after (%s → %s)",
  async (account, name, failed, expected) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    notifyManager.setNotifyFunction((notify) => act(notify));
    resetGameSyncStoryEvents();
    const host = document.createElement("div");
    const root = createRoot(host);
    const client = new QueryClient();
    const Log = () => <p>{useStoryEvents(10).data[0]?.presentation.description ?? "no story"}</p>;
    const render = () =>
      act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <Log />
          </QueryClientProvider>,
        ),
      );
    try {
      acceptGameSyncStoryEvent(
        {
          model: "StoryEvent",
          key: "0xabc",
          value: {
            game_id: "0x1",
            order: "0x1",
            index: "0x0",
            owner: account,
            entity_id: "0x0",
            tx_hash: "0xbeef",
            story: { SeasonEnded: account },
            timestamp: "0x64",
            event_position: { block_number: 35, transaction_hash: "0xbeef", transaction_index: 0, event_index: 0 },
          },
        } as never,
        { chainId: "0x1", worldAddress: "0xabc", gameId: 1 },
        { block: 35, preconfirmed: false },
      );
      await render();
      await vi.waitFor(() => expect(host.textContent).toBe("…"));
      await vi.waitFor(() => expect(pending.answer).toBeDefined());
      // The history read settles first: nothing about the game changes after identity answers.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      await act(async () => {
        pending.answer!(name, failed);
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(getPlayerDisplayName(account)).toBe(expected);
      expect(host.textContent).toBe(expected);
    } finally {
      await act(async () => root.unmount());
      client.clear();
      resetGameSyncStoryEvents();
      pending.answer = undefined;
      notifyManager.setNotifyFunction((notify) => notify());
    }
  },
);
