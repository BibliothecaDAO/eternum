import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/sync/action-outcome", async (original) => ({
  ...(await original<typeof import("@/sync/action-outcome")>()),
  untilApplied: async (sent: Promise<unknown>) => {
    await sent;
    return "0x1";
  },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { configManager } from "@bibliothecadao/eternum";
import { sellingFragments } from "../value/fragments-fixture";
import { GameProvider } from "@/hooks/context/game-context";
import { transferArmies } from "../army/transfer-fixture";
import { ShopSheet, ShopView, type ShopViewProps } from "./shop-sheet";

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

const text = () => host.textContent ?? "";
const getPass = () =>
  [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Get the Ancient Seal"));

const view = (over: Partial<ShopViewProps>) => {
  const onBuy = vi.fn();
  act(() =>
    root.render(
      <ShopView
        fragments={340}
        pass={{ held: false, buying: false, onBuy }}
        questBonus={50}
        bonusHeld={null}
        bar={180}
        code={<i data-code />}
        onGetFragments={() => {}}
        onClose={() => {}}
        {...over}
      />,
    ),
  );
  return { onBuy };
};

describe("the shop", () => {
  it("offers the Ancient Seal for 1,000 Fragments, and says what is missing in dollars while short", () => {
    view({});
    expect(text()).toContain("Ancient Seal");
    expect(text()).toContain("For the whole season");
    expect(text()).toContain("Daily quest pays 50% more");
    expect(getPass()?.disabled).toBe(true);
    expect(host.querySelector("[data-shop-short]")?.textContent).toBe("You have 340. Get 660 more for $6.60.");
    expect(host.querySelector("[data-code]")).not.toBeNull();
    expect(text()).toContain("Fragments 340");
    expect(text()).toContain("1 cent each. Stamina, rerolls, the Ancient Seal.");
    expect(text()).toContain("Each Fragment refills 2 points. A bar of 180 is 90 Fragments, $0.90.");
  });

  it("prices a gap below the smallest purchase at that purchase", () => {
    view({ fragments: 990 });
    expect(host.querySelector("[data-shop-short]")?.textContent).toBe("You have 990. Get 100 more for $1.00.");
  });

  it("tells an account whose Realm already pays the quest bonus that it does, beside the Seal's offer", () => {
    view({ bonusHeld: "Realm" });
    expect(host.querySelector("[data-shop=pass]")?.textContent).toContain("Your Realm gives this bonus already");
    expect(getPass()).toBeDefined();
  });

  it("sends the purchase from Get the Ancient Seal once the Fragments cover it", () => {
    const { onBuy } = view({ fragments: 1_200 });
    expect(host.querySelector("[data-shop-short]")).toBeNull();
    act(() => getPass()!.click());
    expect(onBuy).toHaveBeenCalledOnce();
  });

  it("offers no purchase or code while it is not known whether the account holds the Ancient Seal", () => {
    view({ pass: null });
    expect(getPass()).toBeUndefined();
    expect(host.querySelector("[data-code]")).toBeNull();
  });

  it("reads a held Ancient Seal from the account's Seal row: no purchase, no code, the Ancient Seal named as held", () => {
    renderShop([{ model: "Seal", key: "0x5ea1", value: { game_id: 1, account: PLAYER, granted_at: "1" } }]);
    expect(text()).toContain("You have the Ancient Seal");
    expect(getPass()).toBeUndefined();
    expect(host.querySelector("[data-shop=code]")).toBeNull();
  });

  it("tells the holder of a Realm settled as this home that its Realm pays the quest bonus already", () => {
    renderShop([{ model: "SettledRealm", key: "0x5e7", value: { game_id: 1, realm_id: 42, home: "7" } }]);
    expect(host.querySelector("[data-shop=pass]")?.textContent).toContain("Your Realm gives this bonus already");
    expect(getPass()).toBeDefined();
  });

  it("opens Get Fragments for this game, coming back to the game's shop", () => {
    renderShop([]);
    const get = [...host.querySelectorAll("button")].find((button) => button.textContent === "Get Fragments")!;
    act(() => get.click());
    const opened = new URL(host.querySelector("[data-opened]")!.textContent!, "https://realms.test");
    expect(opened.pathname).toBe("/shop/fragments");
    expect(opened.searchParams.get("chain")).toBe("0x1");
    expect(opened.searchParams.get("game")).toBe("1");
    expect(opened.searchParams.get("next")).toBe("/g/0x1/1/map#shop");
  });

  it("names no free bonus for a home with neither a Realm nor a ticket", () => {
    renderShop([]);
    expect(host.querySelector("[data-shop=pass]")?.textContent).not.toContain("gives this bonus already");
  });
});

const renderShop = (facts: object[]) => {
  const store = transferArmies();
  store.applyFacts([...facts, ...sellingFragments(store)] as never);
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/g/0x1/1/map"]}>
        <QueryClientProvider client={new QueryClient()}>
          <GameProvider value={{ store, systemCalls: {} } as never} account={{ address: PLAYER } as never}>
            <Routes>
              <Route
                path="/g/:chain/:game/:scene"
                element={
                  <ShopSheet realm={store.require("Structure", { game_id: 1, entity_id: 7 })} onClose={() => {}} />
                }
              />
              <Route path="/shop/fragments" element={<Opened />} />
            </Routes>
          </GameProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
};

const Opened = () => {
  const { pathname, search } = useLocation();
  return <i data-opened>{`${pathname}${search}`}</i>;
};
