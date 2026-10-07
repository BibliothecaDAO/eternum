import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

const launcher = vi.hoisted(() => ({ current: false }));
vi.mock("@/ui/features/factory-v2/api/factory-worker", () => ({
  fetchLauncherStatus: async () => ({ launcher: launcher.current }),
}));
vi.mock("@/ui/features/factory-v2/components/factory-v2-content", () => ({
  FactoryV2Content: () => <p>schedule</p>,
}));
vi.mock("./herald", () => ({ useDirectory: () => ({ data: { failures: [] } }), DIRECTORY_QUERY_KEY: ["d"] }));

import { FactoryPage } from "./factory";

const render = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <FactoryPage />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  for (let tick = 0; tick < 10; tick += 1) await act(async () => {});
  return {
    body: () => container.querySelector('[data-band="body"]')!.textContent,
    unmount: () => act(async () => root.unmount()),
  };
};

it("gives a player Nothing here, and a launcher the factory", async () => {
  launcher.current = false;
  const player = await render();
  expect(player.body()).toContain("Nothing here");
  expect(player.body()).not.toContain("schedule");
  await player.unmount();

  launcher.current = true;
  const operator = await render();
  expect(operator.body()).toContain("schedule");
  await operator.unmount();
});
