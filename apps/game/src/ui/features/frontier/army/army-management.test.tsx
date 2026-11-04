import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  entityHomeNamespace,
  expeditionRealmSite,
  readExpeditionRules,
  setBlockTimestampSource,
} from "@bibliothecadao/eternum";
import { getNeighborHexes, RESOURCE_PRECISION } from "@bibliothecadao/types";

vi.mock("@/sync/action-outcome", async (original) => ({
  ...(await original<typeof import("@/sync/action-outcome")>()),
  untilApplied: async (sent: Promise<unknown>) => {
    await sent;
    return "0x1";
  },
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { DockArmy } from "../hud/dock-armies";
import { ArmyManagement } from "./army-management";
import { readReinforcePlan } from "./reinforce-plan";
import { transferArmies } from "./transfer-fixture";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  useUIStore.setState({ isSpectating: false });
  setBlockTimestampSource(() => 350);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

const fixture = () => {
  const store = transferArmies();
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const rules = readExpeditionRules(store, 1)!;
  const home = expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), 350)!;
  const at = getNeighborHexes(home.col, home.row)[0]!;
  const position = store.entityOccupancy(1, 201)!;
  let key = "0x75";
  let revision = 0;
  const move = (col: number, row: number) => {
    const next = `0xab${++revision}`;
    store.applyFacts([
      { model: "TileOccupancy", key, value: null },
      { model: "TileOccupancy", key: next, value: { ...position, entity_id: "201", col, row } },
    ] as never);
    key = next;
  };
  move(at.col, at.row);
  return { store, realm, home, at, move };
};

it("prices the added troops from the home recipe, within stock and the existing army cap", () => {
  const { store, realm } = fixture();
  const plan = readReinforcePlan(store, realm, 201, 100, 350)!;
  expect(plan).toMatchObject({ current: 600, maximum: 420, reason: null, besideHome: true });
  expect(plan.costs).toEqual([
    { resource: 35, amount: 200n * BigInt(RESOURCE_PRECISION), held: 1000n * BigInt(RESOURCE_PRECISION) },
  ]);
  expect(readReinforcePlan(store, realm, 201, 421, 350)?.reason).toBe("Choose how many troops to add.");
  expect(readReinforcePlan(store, realm, 201, 0.5, 350)?.reason).toBe("Choose how many troops to add.");
});

it("refuses another home's ring, another depth and a new day even with stock available", () => {
  const { store, realm, at, move } = fixture();
  for (const [col, row, now] of [
    [at.col + 10, at.row, 350],
    [at.col, at.row + 10, 350],
    [at.col, at.row, 401],
  ]) {
    move(col, row);
    expect(readReinforcePlan(store, realm, 201, 1, now)?.besideHome).toBe(false);
  }
});

it("refuses a missing or insufficient raising balance without treating it as free", () => {
  const { store, realm } = fixture();
  store.applyFacts([
    { model: "ResourceBalance", key: "0xc", value: { game_id: 1, entity_id: 7, resource_type: 35, balance: "1" } },
  ] as never);
  expect(readReinforcePlan(store, realm, 201, 1, 350)?.reason).toBe("Your realm cannot pay this raising cost.");
});

const render = () => {
  const f = fixture();
  const add = vi.fn().mockResolvedValue({ transaction_hash: "0x1" });
  const remove = vi.fn().mockResolvedValue({ transaction_hash: "0x2" });
  const deleted = vi.fn();
  const army = { explorerId: 201 } as DockArmy;
  act(() =>
    root.render(
      <GameProvider
        value={{ store: f.store, systemCalls: { explorer_add: add, explorer_delete: remove } } as never}
        account={{ address: "0x111" } as never}
      >
        <ArmyManagement army={army} realm={f.realm} onDeleted={deleted} />
      </GameProvider>,
    ),
  );
  return { ...f, add, remove, deleted };
};
const click = async (name: string) =>
  act(async () => {
    const button = [...host.querySelectorAll("button")].find((b) => b.textContent === name);
    expect(button).toBeDefined();
    button!.click();
  });

it("opens the reinforcement preview and sends the exact selected stock amount", async () => {
  const { add } = render();
  await click("Reinforce");
  expect(host.querySelector('[aria-label="Troops after reinforcement"]')?.textContent).toBe("600 → 601");
  expect(host.querySelector('[aria-label="Reinforcement cost"]')?.textContent?.trim()).toBe("2");
  await click("Reinforce");
  expect(add).toHaveBeenCalledOnce();
  expect(add.mock.calls[0][0]).toMatchObject({ to_explorer_id: 201, amount: RESOURCE_PRECISION });
});

it("rechecks the position after the preview opens and sends nothing after the army moves", async () => {
  const { add, move, at } = render();
  await click("Reinforce");
  act(() => move(at.col + 10, at.row));
  await click("Reinforce");
  expect(add).not.toHaveBeenCalled();
});

it("deletes only after confirming every loss, then closes the army panel", async () => {
  const { remove, deleted } = render();
  await click("Delete");
  expect(remove).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain(
    "troops, skills, XP and carried resources are lost",
  );
  await click("Cancel");
  expect(remove).not.toHaveBeenCalled();
  await click("Delete");
  await click("Delete");
  expect(remove).toHaveBeenCalledOnce();
  expect(remove.mock.calls[0][0]).toMatchObject({ explorer_id: 201 });
  expect(deleted).toHaveBeenCalledOnce();
});

it("offers neither action to spectators", () => {
  const { add, remove } = render();
  act(() => useUIStore.setState({ isSpectating: true }));
  expect(host.querySelectorAll("button")).toHaveLength(0);
  expect(add).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
