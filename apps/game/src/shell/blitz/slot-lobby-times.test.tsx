import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { formatClockTime } from "@/ui/design-system/kit/time";

/** The one listed slot, closing at `closes` (Unix seconds); its games start 300 seconds later. */
const listed = vi.hoisted(() => ({ closes: 0, closed: false }));
vi.hoisted(() =>
  vi.stubGlobal("fetch", async (input: string | URL) => {
    if (String(input).includes("/api/directory")) return Response.json({ shards: [] });
    if (String(input).includes("/api/slots"))
      return Response.json({
        slots: [
          {
            slotId: 3,
            chainId: "0x52",
            name: "blitz-1630",
            closesAt: new Date(listed.closes * 1000).toISOString(),
            frozenAt: listed.closed ? "x" : null,
            closed: listed.closed,
          },
        ],
      });
    return new Response(null, { status: 401 });
  }),
);
vi.mock("./lobby-chat-panel", () => ({ LobbyChatPanel: () => null }));

import { setViewportWidth } from "../frame/test-viewport";
import { BlitzLobbyPage } from "./blitz-pages";

vi.spyOn(console, "error").mockImplementation(() => undefined);
let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
});

const lobby = async (closesIn: number, closed: boolean) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(listed, { closes: Math.floor(Date.now() / 1000) + closesIn, closed });
  setViewportWidth(1440);
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
  for (let tick = 0; tick < 10 && !container.textContent?.includes("Entry"); tick += 1) await act(async () => {});
  unmount = () => act(async () => root.unmount());
  return container.textContent ?? "";
};

it("shows when a slot's registration closes and when its games start, five minutes later", async () => {
  const open = await lobby(3_600, false);
  expect(open).toContain(`Entry closes ${formatClockTime(listed.closes)}`);
  expect(open).toContain(`Starts ${formatClockTime(listed.closes + 300)}`);
  // The lobby is named by the games' start, not by the close.
  expect(open).toContain(`Blitz ${formatClockTime(listed.closes + 300)}`);
});

it("keeps the start in sight through the five minutes after the close, and drops it once the games have started", async () => {
  const preparing = await lobby(-120, true);
  expect(preparing).toContain("Entry closed");
  expect(preparing).toContain(`Starts ${formatClockTime(listed.closes + 300)}`);
  await unmount?.();

  const started = await lobby(-400, true);
  expect(started).toContain("Entry closed");
  expect(started).not.toContain("Starts");
});
