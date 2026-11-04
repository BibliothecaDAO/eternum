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
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
  RESOURCE_PRECISION,
  ResourcesIds,
  TroopTier,
} from "@bibliothecadao/types";

import { ReinforceSheet, useSelectedReinforcement } from "./reinforce";
import { transferArmies } from "./transfer-fixture";

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
  const army = useSelectedReinforcement(realm);
  return army && <ReinforceSheet realm={realm} army={army} onClose={onClose} />;
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

const button = (text: string) => [...host.querySelectorAll("button")].find((each) => each.textContent === text);
const press = async (text: string) => {
  expect(button(text)).toBeDefined();
  await act(async () => button(text)!.click());
};
/** The army's troops before and after, as its chip reads them. */
const troops = () => host.querySelector('[aria-label^="Troops "]:not(input)')?.textContent ?? null;

it("opens on the army beside the realm at no troops, and raises the most it can take with Max", async () => {
  const fixture = armyBesideHome();
  const { add, close } = render(fixture);
  expect(host.textContent).toContain("Reinforce Army 1");
  expect(troops()).toBe("600 → 600");
  expect(button("Reinforce")?.disabled).toBe(true);

  await press("Max");
  expect(troops()).toBe("600 → 1K");
  expect(host.textContent).toContain("840 Wheat");
  await press("Reinforce");
  expect(add).toHaveBeenCalledOnce();
  expect(add.mock.calls[0][0]).toMatchObject({
    to_explorer_id: 201,
    amount: 420 * RESOURCE_PRECISION,
    home_direction: getDirectionBetweenAdjacentHexes(fixture.beside, fixture.home),
  });
  // The HUD hands the panel to the army once the troops land (useOrderSettledReturnsToTheArmy); the sheet closes nothing.
  expect(close).not.toHaveBeenCalled();
});

/** One Rations pick on the Barracks row, a quarter wheat off each troop's 2: a knight raises for 1.75 wheat. */
const withOneRations = (fixture: ReturnType<typeof armyBesideHome>) => {
  const board = fixture.store.require("BoardRules", { game_id: 1 });
  fixture.store.applyFacts([
    { model: "BoardRules", key: "0xa", value: { ...board, ration_step: "250000000" } },
    {
      model: "RealmKnowledge",
      key: "0xd",
      value: { game_id: 1, structure_id: 7, learned: String((1n << 14n) | (1n << 17n)) },
    },
  ] as never);
};

it.each([
  ["seven Wheat raises four troops at 1.75 each", 7, "600 → 604", "7 Wheat"],
  ["three and a half Wheat raises two", 3.5, "600 → 602", null],
])("prices Max on the whole batch with Rations: %s", async (_case, wheat, after, price) => {
  const fixture = armyBesideHome();
  withOneRations(fixture);
  fixture.holdWheat(wheat);
  render(fixture);
  await press("Max");
  expect(troops()).toBe(after);
  if (price) expect(host.textContent).toContain(price);
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
  expect(host.textContent).toContain("Reinforce Army 1");
  const away = { col: fixture.beside.col + 10, row: fixture.beside.row };
  act(() => fixture.moveTo(away));
  act(() => useUIStore.getState().selectOnMap({ kind: "structure", entityId: 7, tile: away }));
  expect(host.textContent).toBe("");

  act(() => fixture.moveTo(fixture.beside));
  act(() => useUIStore.getState().selectOnMap({ kind: "structure", entityId: 7, tile: fixture.beside }));
  act(() => useUIStore.setState({ isSpectating: true }));
  expect(host.textContent).toBe("");
});
