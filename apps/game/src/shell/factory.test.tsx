import type { Session } from "@realms-world/identity";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

/** The caller the cookie names: the launch service answers for their linked wallet. */
const caller = vi.hoisted(() => ({ session: null as Session | null, launchers: new Set<string>() }));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ status: caller.session ? "signed-in" : "anonymous", session: caller.session }),
}));
vi.mock("@/ui/features/factory-v2/api/factory-worker", () => ({
  fetchLauncherStatus: async () => ({ launcher: caller.launchers.has(caller.session?.user.address ?? "") }),
}));
vi.mock("@/ui/features/factory-v2/components/factory-v2-content", () => ({
  FactoryV2Content: () => <p>schedule</p>,
}));

import { FactoryPage } from "./factory";

const sessionOf = (id: string, address: string | null) => ({ user: { id, address } }) as unknown as Session;

/** One page on one QueryClient, as the app holds it: each call re-renders it for whoever is signed in now. */
const mountFactory = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  const client = new QueryClient();
  const show = async () => {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <FactoryPage />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
    // The launcher answer arrives asynchronously: read the page once nothing is loading.
    for (let tick = 0; tick < 100 && container.querySelector('[role="status"]'); tick += 1)
      await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
    return container.querySelector('[data-band="body"]')!.textContent;
  };
  return { show, unmount: () => act(async () => root.unmount()) };
};

it("drops an operator's factory when they sign out or another player signs in", async () => {
  caller.launchers = new Set(["0xop"]);
  caller.session = sessionOf("operator", "0xop");
  const page = await mountFactory();
  expect(await page.show()).toContain("schedule");

  caller.session = null;
  expect(await page.show()).toContain("Nothing here");

  caller.session = sessionOf("player", null);
  const body = await page.show();
  expect(body).toContain("Nothing here");
  expect(body).not.toContain("schedule");
  await page.unmount();
});

it("shows a player the factory once they link a launcher's wallet", async () => {
  caller.launchers = new Set(["0xop"]);
  caller.session = sessionOf("player", null);
  const page = await mountFactory();
  expect(await page.show()).toContain("Nothing here");

  caller.session = sessionOf("player", "0xop");
  expect(await page.show()).toContain("schedule");
  await page.unmount();
});
