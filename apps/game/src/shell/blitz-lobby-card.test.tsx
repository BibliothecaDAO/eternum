import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
vi.mock("@/ui/features/factory-v2/api/factory-worker", () => ({
  fetchPlaytestSlots: async () => {
    throw new Error("not_found");
  },
  registerPlaytestSlot: async () => undefined,
}));

import { BlitzLobbyCard } from "./mode-cards";

const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
afterEach(() => consoleError.mockClear());

it("draws a failed slots read on the lobby's Blitz card as Blitz's one line with Try again, never the service's code", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <BlitzLobbyCard games={[]} now={0} />
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  const failure = () => container.querySelector("[role='status']")?.parentElement;
  for (let tick = 0; tick < 5 && !failure(); tick += 1) await act(async () => {});
  try {
    expect(failure()?.textContent).toContain("Blitz did not answer.");
    expect(failure()?.querySelector("button")?.textContent).toBe("Try again");
    expect(container.textContent).not.toContain("not_found");
    expect(consoleError).toHaveBeenCalledWith("shell_read_failed", expect.objectContaining({ service: "slots" }));
  } finally {
    await act(async () => root.unmount());
  }
});
