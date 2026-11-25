import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The game applies what is sent: the send's outcome stands in for the shard's answer.
vi.mock("@/sync/action-outcome", async (original) => ({
  ...(await original<typeof import("@/sync/action-outcome")>()),
  untilApplied: async (sent: Promise<unknown>) => {
    await sent;
    return "0x1";
  },
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  configManager,
  entityHomeNamespace,
  expeditionRealmSite,
  readExpeditionRules,
  setBlockTimestampSource,
} from "@bibliothecadao/eternum";
import {
  formatExact,
  getNeighborHexes,
  RESOURCE_PRECISION,
  ResourcesIds,
  siteName,
  TroopTier,
} from "@bibliothecadao/types";

import { StructureType } from "@bibliothecadao/types";
import { ReinforceSheet, useSelectedReinforcement } from "./reinforce";
import { transferArmies } from "./transfer-fixture";
import { REINFORCE } from "../../../design-system/kit/words";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  useAccountStore.setState({ account: { address: "0x111" } as never });
  useUIStore.setState({ isSpectating: false });
  setBlockTimestampSource(() => 350);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useUIStore.getState().selectOnMap(null);
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

/**
 * Realm 7's army 201 (600 knights) on a tile beside the realm's home today, and the realm's second army further off.
 * The realm holds 1,000 wheat; a knight costs 2 to raise.
 */
const armyBesideHome = () => {
  const store = transferArmies();
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const home = expeditionRealmSite(readExpeditionRules(store, 1)!, entityHomeNamespace(realm.entity_id), 350)!;
  const beside = getNeighborHexes(home.col, home.row)[0]!;
  const position = store.entityOccupancy(1, 201)!;
  let key = "0x75";
  let revision = 0;
  const moveTo = (hex: { col: number; row: number }) => {
    const next = `0xab${++revision}`;
    store.applyFacts([
      { model: "TileOccupancy", key, value: null },
      { model: "TileOccupancy", key: next, value: { ...position, entity_id: "201", col: hex.col, row: hex.row } },
    ] as never);
    key = next;
  };
  moveTo(beside);
  const holdWheat = (wheat: number) =>
    store.applyFacts([
      {
        model: "ResourceBalance",
        key: "0xc",
        value: {
          game_id: 1,
          entity_id: 7,
          resource_type: ResourcesIds.Wheat,
          balance: String(Math.round(wheat * RESOURCE_PRECISION)),
        },
      },
    ] as never);
  return { store, realm, home, beside, moveTo, holdWheat };
};

/** The selection's reinforcement card, as the HUD draws it for the realm. */
const Card = ({ realm, onClose }: { realm: never; onClose: () => void }) => {
  const reinforcing = useSelectedReinforcement(realm);
  return (
    reinforcing && <ReinforceSheet realm={realm} army={reinforcing.army} post={reinforcing.post} onClose={onClose} />
  );
};

/** The realm selected and acting on the tile beside it, as the map selects it on a right-click there. */
const render = (fixture: ReturnType<typeof armyBesideHome>, tile = fixture.beside) => {
  const add = vi.fn().mockResolvedValue({ transaction_hash: "0x1" });
  const close = vi.fn();
  useUIStore.getState().selectOnMap({ kind: "structure", entityId: 7, tile });
  act(() =>
    root.render(
      <GameProvider
        value={{ store: fixture.store, systemCalls: { explorer_add: add } } as never}
        account={{ address: "0x111" } as never}
      >
        <Card realm={fixture.realm as never} onClose={close} />
      </GameProvider>,
    ),
  );
  return { add, close };
};

const button = (text: string) =>
  [...host.querySelectorAll("button")].find((each) =>
    text === "Reinforce" ? each.textContent?.startsWith("Reinforce +") : each.textContent === text,
  );
const press = async (text: string) => {
  expect(button(text)).toBeDefined();
  await act(async () => button(text)!.click());
};
const troops = () => host.querySelector(".reinforce-army__troops")?.textContent ?? null;
const wheat = () => host.querySelector('.ui-price [role="img"]')?.getAttribute("aria-label") ?? null;

it("opens on the army beside the realm at the most it can take, and names the troops it adds on Reinforce", async () => {
  const fixture = armyBesideHome();
  const { add, close } = render(fixture);
  expect(host.textContent).toContain("Reinforce 600 Knights");
  expect(troops()).toBe("600 → 1,020");
  expect(button("Reinforce")?.textContent).toBe("Reinforce +420");
  expect(wheat()).toBe("840 Wheat");
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="One fewer"]')!.click());
  expect(button("Reinforce")?.textContent).toBe("Reinforce +419");
  const field = host.querySelector<HTMLInputElement>(".size-row .ui-field input")!;
  const slider = host.querySelector<HTMLInputElement>("input[type=range]")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "300");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect([field.value, slider.value, troops(), button("Reinforce")?.textContent]).toEqual([
    "300",
    "300",
    "600 → 900",
    "Reinforce +300",
  ]);
  await press("Max");
  expect([field.value, slider.value]).toEqual(["420", "420"]);
  await press("Reinforce");
  expect(add).toHaveBeenCalledOnce();
  expect(add.mock.calls[0][0]).toMatchObject({
    to_explorer_id: 201,
    amount: 420 * RESOURCE_PRECISION,
    supply_post: undefined,
  });
  // The HUD hands the panel to the army once the troops land (useOrderSettledReturnsToTheArmy); the sheet closes nothing.
  expect(close).not.toHaveBeenCalled();
});

it.each([
  ["eight Wheat raises four troops", 8, "600 → 604", "8 Wheat"],
  ["four and a half Wheat raises two", 4.5, "600 → 602", null],
])("prices Max on the whole batch at the recipe cost: %s", async (_case, held, after, price) => {
  const fixture = armyBesideHome();
  fixture.holdWheat(held);
  render(fixture);
  await press("Max");
  expect(troops()).toBe(after);
  if (price) expect(wheat()).toBe(price);
});

it("leaves a newer pick alone when the troops land after it", async () => {
  const fixture = armyBesideHome();
  const { add, close } = render(fixture);
  let land!: (sent: unknown) => void;
  add.mockImplementation(() => new Promise((resolve) => (land = resolve)));
  close.mockImplementation(() => useUIStore.getState().closeSelectedTile());
  await press("Max");
  await press("Reinforce");
  const newer = { kind: "hex" as const, hex: { col: 99, row: 98 } };
  act(() => useUIStore.getState().selectOnMap(newer));
  await act(async () => land({ transaction_hash: "0x1" }));
  expect(useUIStore.getState().mapSelection).toEqual(newer);
});

it("stops Max where the wheat runs out, and says so in one line", async () => {
  const fixture = armyBesideHome();
  fixture.holdWheat(100);
  render(fixture);
  await press("Max");
  expect(troops()).toBe("600 → 650");
  expect(host.textContent).toContain("Wheat for only 50 of 420 troops");
});

it("stops Max where the wheat left still feeds the whole army revealing its bar", async () => {
  const fixture = armyBesideHome();
  fixture.holdWheat(100);
  fixture.store.applyFacts([
    {
      model: "ArmySlot",
      key: "0x9",
      value: {
        game_id: 1,
        structure_id: 7,
        epoch: "0",
        slot: 0,
        explorer_id: 201,
        stamina: { amount: "100", settled_at: "350", remainder: 0 },
      },
    },
  ] as never);
  render(fixture);
  await press("Max");
  expect(troops()).toBe("600 → 619");
  expect(wheat()).toBe("38 Wheat");
  expect(host.textContent).toContain("Wheat for only 19 of 420 troops");
});

it("still sends a count above Max that the wheat pays for, as the contract takes it", async () => {
  const fixture = armyBesideHome();
  fixture.holdWheat(50);
  fixture.store.applyFacts([
    {
      model: "ArmySlot",
      key: "0x9",
      value: {
        game_id: 1,
        structure_id: 7,
        epoch: "0",
        slot: 0,
        explorer_id: 201,
        stamina: { amount: "100", settled_at: "350", remainder: 0 },
      },
    },
  ] as never);
  const { add } = render(fixture);
  await press("Max");
  expect(troops()).toBe("600 → 600");
  const slider = host.querySelector<HTMLInputElement>("input[type=range]")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "25");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(troops()).toBe("600 → 625");
  expect(wheat()).toBe("50 Wheat");
  await press("Reinforce");
  expect(add.mock.calls[0][0]).toMatchObject({ to_explorer_id: 201, amount: 25 * RESOURCE_PRECISION });
});

it("offers nothing to raise into an army at its cap", () => {
  const fixture = armyBesideHome();
  const army = fixture.store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const cap = configManager.getMaxArmySize(fixture.realm.base.level, TroopTier.T1);
  fixture.store.applyFacts([
    {
      model: "ExplorerTroops",
      key: "0x74",
      value: JSON.parse(
        JSON.stringify(
          { ...army, troops: { ...army.troops, count: BigInt(cap) * BigInt(RESOURCE_PRECISION) } },
          (_, field) => (typeof field === "bigint" ? field.toString() : field),
        ),
      ),
    },
  ] as never);
  render(fixture);
  expect(host.textContent).toContain(`An army holds at most ${formatExact(cap)}.`);
  expect(button("Reinforce")).toBeUndefined();
});

it("opens no card for the realm on its own, an army away from home, or a viewer", () => {
  const fixture = armyBesideHome();
  render(fixture);
  act(() => useUIStore.getState().closeSelectedTile());
  expect(useUIStore.getState().mapSelection).toEqual({ kind: "structure", entityId: 7 });
  expect(host.textContent).toBe("");

  act(() => useUIStore.getState().selectOnMap({ kind: "structure", entityId: 7, tile: fixture.beside }));
  expect(host.textContent).toContain("Reinforce 600 Knights");
  const away = { col: fixture.beside.col + 10, row: fixture.beside.row };
  act(() => fixture.moveTo(away));
  act(() => useUIStore.getState().selectOnMap({ kind: "structure", entityId: 7, tile: away }));
  expect(host.textContent).toBe("");

  act(() => fixture.moveTo(fixture.beside));
  act(() => useUIStore.getState().selectOnMap({ kind: "structure", entityId: 7, tile: fixture.beside }));
  act(() => useUIStore.setState({ isSpectating: true }));
  expect(host.textContent).toBe("");
});

it("reinforces through a cleared camp with its id and refuses it after the army leaves", async () => {
  const fixture = armyBesideHome();
  const camp = getNeighborHexes(fixture.beside.col, fixture.beside.row).find(
    (hex) => hex.col !== fixture.home.col || hex.row !== fixture.home.row,
  )!;
  const site = {
    game_id: 1,
    entity_id: 711n,
    category: StructureType.Camp,
    initial_guard_count: 1300_000_000_000n,
    alt: false,
    col: camp.col,
    row: camp.row,
    clear: { explorer_id: 201n, home_id: fixture.realm.entity_id, reward: null },
  };
  fixture.store.applyFacts([{ model: "ExpeditionSite", key: "0x712", value: site }] as never);
  const add = vi.fn().mockResolvedValue({ transaction_hash: "0x2" });
  useUIStore.getState().selectOnMap({ kind: "structure", entityId: 711, tile: fixture.beside });
  act(() =>
    root.render(
      <GameProvider
        value={{ store: fixture.store, systemCalls: { explorer_add: add } } as never}
        account={{ address: "0x111" } as never}
      >
        <Card realm={fixture.realm as never} onClose={() => {}} />
      </GameProvider>,
    ),
  );
  expect(host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label")).toBe("Reinforce 600 Knights");
  expect(host.querySelector("[data-kit-sheet] .ui-frame__head .ui-chip")?.textContent).toBe(siteName(711));
  expect(host.textContent).toContain(REINFORCE.stockReady("420"));
  expect(host.textContent).toContain("Ends in");
  await press("Max");
  await press("Reinforce");
  expect(add).toHaveBeenCalledWith(
    expect.objectContaining({ to_explorer_id: 201, supply_post: 711, amount: 420 * RESOURCE_PRECISION }),
  );
  fixture.moveTo({ col: camp.col + 5, row: camp.row });
  await press("Reinforce");
  expect(add).toHaveBeenCalledTimes(1);
});
