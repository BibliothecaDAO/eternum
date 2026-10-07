import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
vi.mock("@/ui/features/factory-v2/api/factory-worker", () => ({
  fetchPlaytestSlots: async () => {
    throw new Error("not_found");
  },
  registerPlaytestSlot: async () => undefined,
}));

import { setViewportWidth } from "../frame/test-viewport";
import { BlitzListPage } from "./blitz-pages";

const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
afterEach(() => consoleError.mockClear());

it("names Blitz when its slots do not answer, with Try again, never the service's code", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(390);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <BlitzListPage />
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  const body = () => container.querySelector('[data-band="body"]');
  for (let tick = 0; tick < 10 && !body()?.textContent?.includes("did not answer"); tick += 1)
    await act(async () => {});
  try {
    expect(body()?.textContent).toContain("Blitz did not answer.");
    expect([...body()!.querySelectorAll("button")].map((button) => button.textContent)).toContain("Try again");
    expect(container.textContent).not.toContain("not_found");
    expect(consoleError).toHaveBeenCalledWith("shell_read_failed", expect.objectContaining({ service: "slots" }));
  } finally {
    await act(async () => root.unmount());
  }
});
