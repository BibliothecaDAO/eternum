// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 3,
  useCurrentBlockTimestamp: () => 350,
  useNowSeconds: () => 350,
}));
// The game clock's gate is not what these cases read: play is open.
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true, useActNowRefusal: () => null }));

import { GameProvider } from "@/hooks/context/game-context";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds, StructureType, type RealmInfo } from "@bibliothecadao/types";
import { ProductionControls } from "./production-controls";

const units = (amount: number) => String(BigInt(Math.round(amount * RESOURCE_PRECISION)));

/** QA's Egonal: Blitz Crossbowman T1 makes ten a cycle from 2 wheat and 0.8 copper; the realm holds 40K wheat. */
const egonal = (copper: number) => {
  const { store } = frontierDay();
  store.applyFacts([
    {
      model: "ProductionRecipe",
      key: "0xc29",
      value: {
        game_id: 1,
        resource_type: ResourcesIds.Crossbowman,
        simple_output: "0",
        simple_inputs: [],
        complex_output: units(10),
        complex_inputs: [
          { resource_type: ResourcesIds.Wheat, amount: units(2) },
          { resource_type: ResourcesIds.Copper, amount: units(0.8) },
        ],
      },
    },
    {
      model: "ResourceBalance",
      key: "0xc",
      value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Wheat, balance: units(40_000) },
    },
    {
      model: "ResourceBalance",
      key: "0xc04",
      value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Copper, balance: units(copper) },
    },
    {
      model: "ProductionBonus",
      key: "0xb07",
      value: {
        game_id: 1,
        entity_id: 7,
        incr_resource_rate_percent_num: 0,
        incr_resource_rate_end_at: 0,
        incr_labor_rate_percent_num: 0,
        incr_labor_rate_end_at: 0,
        incr_troop_rate_percent_num: 0,
        incr_troop_rate_end_at: 0,
      },
    },
  ] as never);
  return store;
};

const realm = { entityId: 7, category: StructureType.Realm } as RealmInfo;

const mount = (copper: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const store = egonal(copper);
  const burn = vi.fn(async () => {});
  const setup = {
    store,
    systemCalls: { burn_resource_for_resource_production: burn, burn_labor_for_resource_production: vi.fn() },
  } as unknown as GameClientSetup;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={setup} account={{ address: "0x111" } as never}>
        <ProductionControls selectedResource={ResourcesIds.Crossbowman} realm={realm} />
      </GameProvider>,
    ),
  );
  const input = (name: string) =>
    host.querySelector(`[role="group"][aria-label="${name} for this run"]`)?.textContent?.trim();
  const start = () => [...host.querySelectorAll("button")].at(-1)!;
  const type = (amount: string) => {
    const field = host.querySelector<HTMLInputElement>('input[aria-label="Amount of Crossbowman T1"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, amount);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { host, burn, input, start, type, unmount };
};

afterEach(() => setBlockTimestampSource(null));

it("quotes one whole cycle for an output of one, never zero inputs, and starts it while stocked", async () => {
  const view = mount(20);
  try {
    view.type("1");
    expect(view.host.textContent).toContain("10 Crossbowman T1");
    expect(view.start().textContent).toBe("Start production");
    expect(view.start().disabled).toBe(false);
    expect(view.input("Wheat")).toBe("40K / 2");
    expect(view.input("Copper")).toBe("20 / 0.8");
    await act(async () => view.start().click());
    expect(view.burn).toHaveBeenCalledWith(
      expect.objectContaining({ produced_resource_types: [ResourcesIds.Crossbowman], production_cycles: [1] }),
    );
  } finally {
    view.unmount();
  }
});

it("quotes and sends the whole cycles an output between two takes", async () => {
  const view = mount(20);
  try {
    view.type("15");
    expect(view.host.textContent).toContain("20 Crossbowman T1");
    expect(view.input("Wheat")).toBe("40K / 4");
    expect(view.input("Copper")).toBe("20 / 2");
    await act(async () => view.start().click());
    expect(view.burn).toHaveBeenCalledWith(expect.objectContaining({ production_cycles: [2] }));
  } finally {
    view.unmount();
  }
});

it("refuses for missing resources only when the run's inputs are short", async () => {
  const view = mount(0.5);
  try {
    view.type("1");
    expect(view.start().textContent).toBe("Not enough resources");
    expect(view.start().disabled).toBe(true);
    expect(view.input("Copper")).toBe("0.5 / 0.8");
  } finally {
    view.unmount();
  }
});

it("sizes Max to the whole cycles the holdings cover", () => {
  const view = mount(2);
  try {
    const max = [...view.host.querySelectorAll("button")].find((button) => button.textContent === "Max")!;
    act(() => max.click());
    expect(view.host.textContent).toContain("20 Crossbowman T1");
    expect(view.input("Copper")).toBe("2 / 2");
  } finally {
    view.unmount();
  }
});
