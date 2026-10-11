import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ status: "signed-in" }) }));

import { FactoryV2Content } from "./factory-v2-content";

const failedRun = (environment: string, gameName: string) => ({
  runId: `${environment}:${gameName}`,
  kind: "game",
  environment,
  gameName,
  status: "attention",
  steps: [{ id: "create", title: "Create game", status: "failed", latestEvent: "failed", errorMessage: "reverted" }],
  artifacts: {},
  recovery: { canContinue: true },
});

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  vi.unstubAllGlobals();
});

it("holds a launcher's own runs only: no season calendar, no Blitz slot, and no Blitz or Frontier run to continue", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const asked: { url: string; method: string }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: { method: string }) => {
    asked.push({ url, method: init.method });
    // The schedule's Frontier season fails too; were the page to ask for it, its Retry would stand beside the game's.
    const environment = new URL(url, "https://realms.test").searchParams.get("environment") as string;
    const name = environment === "madara.eternum" ? "long-game" : "frontier-1791700000";
    return Response.json({ runs: [failedRun(environment, name)] });
  });
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <FactoryV2Content />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  const retry = () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Retry");
  for (let tick = 0; tick < 10 && !retry(); tick += 1) await act(async () => {});

  // The page reads its own runs: never the calendar, the slots, or the Blitz and Frontier runs the operator alone
  // continues.
  expect(asked.map((ask) => ask.url)).toEqual(["/api/factory/runs?environment=madara.eternum"]);
  expect(container.textContent).not.toContain("frontier-");
  expect([...container.querySelectorAll("h3")].map((heading) => heading.textContent)).toEqual([
    "Needs attention",
    "Progress",
  ]);
  // The one date field is the new game's start; no phase of the season is set here.
  expect(container.querySelectorAll('input[type="datetime-local"]').length).toBe(1);
  expect([...container.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
    "Create Eternum game",
    "Retry",
  ]);

  await act(async () => retry()!.click());
  expect(asked.find((ask) => ask.method === "POST")?.url).toBe(
    "/api/factory/runs/madara.eternum/long-game/actions/continue",
  );
});
