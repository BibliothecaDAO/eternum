// @vitest-environment jsdom
import { act, useState } from "react";
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
import { configManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import {
  ActionRefusedError,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
  type RealmInfo,
} from "@bibliothecadao/types";
import { ProductionControls } from "./production-controls";
import { ProductionWorkflows } from "./production-workflows";

/** The Production window's manual workflow as a phone shows it: its Resource selector picks the output. */
const Workflow = ({ realm }: { realm: RealmInfo }) => {
  const [selectedResource, onSelectResource] = useState<ResourcesIds | null>(ResourcesIds.Crossbowman);
  return (
    <ProductionWorkflows
      realm={realm}
      realmDisplayName="Egonal"
      producedResources={[ResourcesIds.Crossbowman, ResourcesIds.Donkey]}
      productionBuildings={[]}
      selectedResource={selectedResource}
      onSelectResource={onSelectResource}
      realmEntityId="7"
    />
  );
};

const units = (amount: number) => String(BigInt(Math.round(amount * RESOURCE_PRECISION)));
const balance = (key: string, resource_type: number, amount: number) => ({
  model: "ResourceBalance",
  key,
  value: { game_id: 1, entity_id: 7, resource_type, balance: units(amount) },
});

/**
 * QA's Egonal: Blitz Crossbowman T1 makes ten a cycle from 2 wheat and 0.8 copper. Its labor recipe, where a case turns
 * it on, makes six a cycle from 30 labor and 0.8 copper; a troop bonus, where a case runs one, adds a fifth (2,000 of
 * 10,000) to the total output, rounded down as the chain rounds it.
 */
const egonal = ({ copper, labor = 0, troopBonus = 0 }: { copper: number; labor?: number; troopBonus?: number }) => {
  const { store } = frontierDay();
  store.applyFacts([
    {
      model: "ProductionRecipe",
      key: "0xc29",
      value: {
        game_id: 1,
        resource_type: ResourcesIds.Crossbowman,
        simple_output: units(6),
        simple_inputs: [
          { resource_type: ResourcesIds.Labor, amount: units(30) },
          { resource_type: ResourcesIds.Copper, amount: units(0.8) },
        ],
        complex_output: units(10),
        complex_inputs: [
          { resource_type: ResourcesIds.Wheat, amount: units(2) },
          { resource_type: ResourcesIds.Copper, amount: units(0.8) },
        ],
      },
    },
    balance("0xc", ResourcesIds.Wheat, 40_000),
    balance("0xc04", ResourcesIds.Copper, copper),
    balance("0xc23", ResourcesIds.Labor, labor),
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
        incr_troop_rate_percent_num: troopBonus,
        incr_troop_rate_end_at: troopBonus > 0 ? 1_000_000 : 0,
      },
    },
  ] as never);
  return store;
};

const realm = { entityId: 7, category: StructureType.Realm } as RealmInfo;

const mount = (
  holdings: Parameters<typeof egonal>[0],
  { laborEnabled = false, compact = false, workflow = false } = {},
) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const store = egonal(holdings);
  const isCommandEnabled = configManager.isCommandEnabled.bind(configManager);
  vi.spyOn(configManager, "isCommandEnabled").mockImplementation((command) =>
    command === "BurnLaborForResourceProduction" ? laborEnabled : isCommandEnabled(command),
  );
  const burnResources = vi.fn(async () => {});
  const burnLabor = vi.fn(async () => {});
  const setup = {
    store,
    systemCalls: {
      burn_resource_for_resource_production: burnResources,
      burn_labor_for_resource_production: burnLabor,
    },
  } as unknown as GameClientSetup;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={setup} account={{ address: "0x111" } as never}>
        {workflow ? (
          <Workflow realm={realm} />
        ) : (
          <ProductionControls selectedResource={ResourcesIds.Crossbowman} realm={realm} compact={compact} />
        )}
      </GameProvider>,
    ),
  );
  const button = (name: string) => [...host.querySelectorAll("button")].find((each) => each.textContent === name)!;
  const input = (name: string) =>
    host.querySelector(`[role="group"][aria-label="${name} for this run"] span.tabular-nums`)?.textContent?.trim();
  const start = () => [...host.querySelectorAll("button")].at(-1)!;
  const type = (label: string, amount: string) => {
    const field = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, amount);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const press = async (control: Element) => act(async () => (control as HTMLElement).click());
  const unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { host, store, burnResources, burnLabor, button, input, start, type, press, unmount };
};

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

it("quotes one whole cycle for an output of one, never zero inputs, and starts it while stocked", async () => {
  const view = mount({ copper: 20 });
  try {
    view.type("Amount of Crossbowman T1", "1");
    expect(view.host.textContent).toContain("10 Crossbowman T1");
    expect(view.start().textContent).toBe("Start production");
    expect(view.input("Wheat")).toBe("40K / 2");
    expect(view.input("Copper")).toBe("20 / <1");
    await view.press(view.start());
    expect(view.burnResources).toHaveBeenCalledWith(
      expect.objectContaining({ produced_resource_types: [ResourcesIds.Crossbowman], production_cycles: [1] }),
    );
  } finally {
    view.unmount();
  }
});

it("quotes and sends the whole cycles an output between two takes", async () => {
  const view = mount({ copper: 20 });
  try {
    view.type("Amount of Crossbowman T1", "15");
    expect(view.host.textContent).toContain("20 Crossbowman T1");
    expect(view.input("Wheat")).toBe("40K / 4");
    await view.press(view.start());
    expect(view.burnResources).toHaveBeenCalledWith(expect.objectContaining({ production_cycles: [2] }));
  } finally {
    view.unmount();
  }
});

it("runs Max on exactly the copper three cycles burn, as the chain counts it unit for unit", async () => {
  const view = mount({ copper: 2.4 });
  try {
    await view.press(view.button("Max"));
    expect(view.host.textContent).toContain("30 Crossbowman T1");
    expect(view.start().textContent).toBe("Start production");
    expect(view.start().disabled).toBe(false);
    await view.press(view.start());
    expect(view.burnResources).toHaveBeenCalledWith(expect.objectContaining({ production_cycles: [3] }));
  } finally {
    view.unmount();
  }
});

it("refuses a run its copper falls a unit short of", async () => {
  const view = mount({ copper: 2.399_999_999 });
  try {
    view.type("Amount of Crossbowman T1", "30");
    expect(view.start().textContent).toBe("Not enough resources");
    expect(view.start().disabled).toBe(true);
    await view.press(view.button("Max"));
    expect(view.host.textContent).toContain("20 Crossbowman T1");
    expect(view.start().disabled).toBe(false);
  } finally {
    view.unmount();
  }
});

it("sizes the run from an input's budget, in whole cycles, and shows the burn they take", async () => {
  const view = mount({ copper: 100 });
  try {
    view.type("Wheat to spend", "101");
    expect(view.host.textContent).toContain("500 Crossbowman T1");
    expect(view.input("Wheat")).toBe("40K / 100");
    expect(view.input("Copper")).toBe("100 / 40");
    expect(view.host.querySelector<HTMLInputElement>('input[aria-label="Wheat to spend"]')!.value).toBe("101");
    await view.press(view.start());
    expect(view.burnResources).toHaveBeenCalledWith(expect.objectContaining({ production_cycles: [50] }));
    view.type("Wheat to spend", "1");
    expect(view.start().textContent).toBe("Spend at least 2 Wheat");
    expect(view.start().disabled).toBe(true);
  } finally {
    view.unmount();
  }
});

it("names the least budget of an input a cycle burns under one unit of as it is typed, never <1", () => {
  const view = mount({ copper: 100 });
  try {
    view.type("Copper to spend", "0.5");
    expect(view.start().textContent).toBe("Spend at least 0.8 Copper");
    expect(view.start().disabled).toBe(true);
    expect(view.burnResources).not.toHaveBeenCalled();
  } finally {
    view.unmount();
  }
});

it("runs the labor recipe on its own inputs and output, with the troop bonus on the total", async () => {
  const view = mount({ copper: 2.4, labor: 100, troopBonus: 2_000 }, { laborEnabled: true });
  try {
    const laborTab = [...view.host.querySelectorAll('[role="tab"]')].find(
      (tab) => tab.textContent === "Labor Production",
    );
    await view.press(laborTab!);
    view.type("Amount of Crossbowman T1", "10");
    // One cycle makes 6 + 1.2 = 7.2, short of 10; two make 12 + 2.4 = 14.4.
    expect(view.host.textContent).toContain("14 Crossbowman T1");
    expect(view.host.textContent).toContain("+20% bonus");
    expect(view.input("Labor")).toBe("100 / 60");
    expect(view.input("Copper")).toBe("2 / 2");
    expect(view.input("Wheat")).toBeUndefined();
    // 100 labor covers three cycles, and 2.4 copper exactly three of 0.8.
    await view.press(view.button("Max"));
    expect(view.input("Labor")).toBe("100 / 90");
    expect(view.start().textContent).toBe("Start production");
    await view.press(view.start());
    expect(view.burnLabor).toHaveBeenCalledWith(
      expect.objectContaining({ produced_resource_types: [ResourcesIds.Crossbowman], production_cycles: [3] }),
    );
    expect(view.burnResources).not.toHaveBeenCalled();
  } finally {
    view.unmount();
  }
});

it("refuses Max when the holdings cover no whole cycle, and sends nothing", async () => {
  const view = mount({ copper: 0.7 });
  try {
    await view.press(view.button("Max"));
    expect(view.host.textContent).toContain("0 Crossbowman T1");
    expect(view.start().textContent).toBe("Not enough resources");
    expect(view.start().disabled).toBe(true);
    await view.press(view.start());
    expect(view.burnResources).not.toHaveBeenCalled();
    expect(view.burnLabor).not.toHaveBeenCalled();
  } finally {
    view.unmount();
  }
});

it("refuses labor's Max under one cycle the same way", async () => {
  const view = mount({ copper: 20, labor: 20 }, { laborEnabled: true });
  try {
    const laborTab = [...view.host.querySelectorAll('[role="tab"]')].find(
      (tab) => tab.textContent === "Labor Production",
    );
    await view.press(laborTab!);
    await view.press(view.button("Max"));
    expect(view.start().textContent).toBe("Not enough resources");
    expect(view.start().disabled).toBe(true);
    await view.press(view.start());
    expect(view.burnResources).not.toHaveBeenCalled();
    expect(view.burnLabor).not.toHaveBeenCalled();
  } finally {
    view.unmount();
  }
});

it("refuses an amount of nothing in the compact form, saying why", async () => {
  const view = mount({ copper: 20 }, { compact: true });
  try {
    view.type("Amount of Crossbowman T1", "0");
    expect(view.host.textContent).toContain("Enter an amount to make");
    expect(view.start().disabled).toBe(true);
    await view.press(view.start());
    expect(view.burnResources).not.toHaveBeenCalled();
    expect(view.burnLabor).not.toHaveBeenCalled();
  } finally {
    view.unmount();
  }
});

// whole-review-3-ui's reproduction: on a phone the Resource selector swaps the output under a mounted form.
it("starts a fresh form when the phone's Resource picks another output, never sizing it by the last recipe's input", async () => {
  const view = mount({ copper: 100 }, { workflow: true });
  try {
    // Blitz's Donkey: three a cycle from 3 wheat, no copper.
    act(() =>
      view.store.applyFacts([
        {
          model: "ProductionRecipe",
          key: "0xfeed20",
          value: {
            game_id: 1,
            resource_type: ResourcesIds.Donkey,
            simple_output: units(0),
            simple_inputs: [],
            complex_output: units(3),
            complex_inputs: [{ resource_type: ResourcesIds.Wheat, amount: units(3) }],
          },
        },
      ] as never),
    );
    view.type("Copper to spend", "8");
    expect(view.start().disabled).toBe(false);
    await view.press(view.host.querySelector('button[aria-label="Resource"]')!);
    const donkey = [...document.querySelectorAll("button.ui-menu__item")].find((item) => item.textContent === "Donkey");
    await view.press(donkey!);
    expect(view.host.textContent).not.toContain("Spend at least");
    expect(view.host.textContent).toContain("3 Donkey");
    expect(view.start().textContent).toBe("Start production");
    expect(view.start().disabled).toBe(false);
  } finally {
    view.unmount();
  }
});

it.each([false, true])(
  "tells a start the game refused as news and a failed one as an error, compact %s",
  async (compact) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = mount({ copper: 20 }, { compact });
    const said = (role: "status" | "alert") =>
      [...view.host.querySelectorAll(`[role="${role}"]`)].map((line) => line.textContent);
    try {
      view.type("Amount of Crossbowman T1", "1");
      view.burnResources.mockRejectedValueOnce(new ActionRefusedError("Starts in 2m 33s"));
      await view.press(view.start());
      expect(said("status")).toContain("Starts in 2m 33s");
      expect(said("alert")).toEqual([]);

      view.burnResources.mockRejectedValueOnce(new Error("Insufficient wheat"));
      await view.press(view.start());
      expect(said("alert")).toEqual(["Insufficient wheat"]);
      expect(said("status")).not.toContain("Starts in 2m 33s");

      await view.press(view.start());
      expect(view.burnResources).toHaveBeenCalledTimes(3);
      expect(said("alert")).toEqual([]);
    } finally {
      view.unmount();
    }
  },
);
