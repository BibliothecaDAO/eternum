import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

// The player's holdings as the table reads them: the fixture game's, or none while `holdings.none` holds.
const holdings = vi.hoisted(() => ({ none: true }));
vi.mock("@/hooks/use-fact-view", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-fact-view")>();
  const { playerStructuresView } = await import("@/sync/fact-views");
  return {
    ...actual,
    useFactView: ((view: unknown) => {
      const read = actual.useFactView(view as never);
      return view === playerStructuresView && holdings.none ? [] : read;
    }) as typeof actual.useFactView,
  };
});
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 3 }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useGoToStructure: () => () => {} }));

import { GameProvider } from "@/hooks/context/game-context";
import { installFixtureGame, PLAYER } from "@/ui/features/debug/kit-lab/fixture-game";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { EntityResourceTableNew } from "./entity-resource-table-new";

afterEach(() => {
  holdings.none = true;
  vi.unstubAllGlobals();
});

it("keeps drawing Balances as the player's holdings go from none to one and back", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // The holdings' owner names: no profiles chosen, read by their chain name.
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ profiles: {} })));
  const store = installFixtureGame();
  const host = document.createElement("div");
  const root = createRoot(host);
  const draw = () =>
    act(async () =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
          <EntityResourceTableNew entityId={7} />
        </GameProvider>,
      ),
    );
  const empty = "You own no structure yet.";

  await draw();
  expect(host.textContent).toBe(empty);
  // The first holding arrives (a realm founded, a camp taken): the table draws its column.
  holdings.none = false;
  await draw();
  expect(host.textContent).not.toContain(empty);
  expect(host.textContent).toContain("1 structures • Temtinos");
  // And the last one goes (lost in a raid): the table says so again.
  holdings.none = true;
  await draw();
  expect(host.textContent).toBe(empty);
  await act(async () => root.unmount());
});
