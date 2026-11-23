import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/sync/action-outcome", async (original) => ({
  ...(await original<typeof import("@/sync/action-outcome")>()),
  untilApplied: async (sent: Promise<unknown>) => {
    await sent;
    return "0x1";
  },
}));

import { configManager } from "@bibliothecadao/eternum";
import { nativeReleaseConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import { GameProvider } from "@/hooks/context/game-context";
import type { DockArmy } from "../hud/dock-armies";
import { ArmyRefill, sellsStamina } from "./army-refill";
import { sellingFragments } from "../value/fragments-fixture";
import { transferArmies } from "./transfer-fixture";

const PLAYER = "0x111";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

const army = (over: Partial<DockArmy> = {}): DockArmy =>
  ({ explorerId: 201, stamina: { current: 20, max: 150, perExplore: 20 }, ethereal: undefined, ...over }) as DockArmy;

const render = (
  held: number,
  shown: DockArmy,
  look: "price" | "reading" | "button" = "price",
  release: number = nativeReleaseConstants.SEAL_RELEASE,
  selling = true,
) => {
  const store = transferArmies();
  store.applyFacts([
    ...(selling ? sellingFragments(store) : []),
    {
      model: "Fragments",
      key: "0xf7a1",
      value: { game_id: 1, account: PLAYER, balance: String(held) },
    },
    {
      model: "GameRelease",
      key: "0x1ab0",
      value: { game_id: 1, release_id: release, created_release_id: release },
    },
  ] as never);
  const buy = vi.fn().mockResolvedValue({ transaction_hash: "0x2" });
  act(() =>
    root.render(
      <GameProvider
        value={{ store, systemCalls: { buy_stamina: buy } } as never}
        account={{ address: PLAYER } as never}
      >
        <ArmyRefill army={shown} look={look} />
      </GameProvider>,
    ),
  );
  return { buy };
};
const button = (find: (button: HTMLButtonElement) => boolean) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find(find);

it("prices a full bar at 2 points a Fragment and buys only what the account holds", async () => {
  const { buy } = render(40, army());
  const price = button((each) => each.textContent === "Refill65 Fragments");
  expect(price?.disabled).toBe(false);
  await act(async () => price!.click());
  expect(host.textContent).toContain("20 → 100");
  expect(host.textContent).toContain("40 → 0");
  await act(async () => button((each) => each.textContent === "Refill · 40 Fragments")!.click());
  expect(buy).toHaveBeenCalledOnce();
  expect(buy.mock.calls[0][0]).toMatchObject({ explorerId: 201, fragments: 40 });
});

it("takes no press without a Fragment, and says what it needs", () => {
  render(0, army());
  const price = button((each) => each.textContent === "Refill65 Fragments");
  expect(price?.disabled).toBe(true);
  expect(price?.title).toContain("65");
});

it("sells no stamina in the Deep or to a full bar", () => {
  expect(sellsStamina(army(), 40)).toBe(true);
  expect(sellsStamina(army({ ethereal: 3 }), 40)).toBe(false);
  expect(sellsStamina(army({ stamina: { current: 150, max: 150, perExplore: 20 } }), 40)).toBe(false);
  expect(sellsStamina(army({ stamina: { current: 149, max: 150, perExplore: 20 } }), 40)).toBe(true);
  render(40, army({ ethereal: 3 }));
  expect(host.querySelectorAll("button")).toHaveLength(0);
});

it("sells no stamina in a game whose rules take no Fragment spend, as the Season 1 playtest's release", () => {
  render(40, army(), "price", nativeReleaseConstants.SEAL_RELEASE, false);
  expect(host.querySelectorAll("button")).toHaveLength(0);
});

it("sells no stamina in a game on a release before the Seal's", () => {
  render(40, army(), "price", nativeReleaseConstants.SEAL_RELEASE - 1);
  expect(host.querySelectorAll("button")).toHaveLength(0);
});
