import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

// The directory answers no game and the session none: the lobby under test is a slot's, read from the launch list.
vi.hoisted(() =>
  vi.stubGlobal("fetch", async (input: string | URL) =>
    String(input).includes("/api/directory") ? Response.json({ shards: [] }) : new Response(null, { status: 401 }),
  ),
);
vi.mock("@/ui/features/factory-v2/api/factory-worker", () => ({
  fetchPlaytestSlots: async () => ({
    slots: [
      {
        slotId: 3,
        chainId: "0x52",
        name: "blitz-1630",
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
        frozenAt: null,
        closed: false,
      },
    ],
  }),
}));
// The chat itself has its own tests; here only where the lobby puts it.
vi.mock("./lobby-chat-panel", () => ({
  LobbyChatPanel: ({ slotName }: { slotName: string }) => <section aria-label="Chat">{slotName}</section>,
}));

import { setViewportWidth } from "../frame/test-viewport";
import { BlitzLobbyPage } from "./blitz-pages";

vi.spyOn(console, "error").mockImplementation(() => undefined);
let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
});

const lobbyAt = async (width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/blitz/slot-blitz-1630"]}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <Routes>
            <Route path="/blitz/:id" element={<BlitzLobbyPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  const chat = () => container.querySelector('[aria-label="Chat"]');
  for (let tick = 0; tick < 10 && !chat(); tick += 1) await act(async () => {});
  unmount = () => act(async () => root.unmount());
  return chat()?.textContent;
};

it("puts the slot's chat in its lobby on a phone as on a desktop", async () => {
  expect(await lobbyAt(390)).toBe("blitz-1630");
  await unmount?.();
  expect(await lobbyAt(1440)).toBe("blitz-1630");
});
