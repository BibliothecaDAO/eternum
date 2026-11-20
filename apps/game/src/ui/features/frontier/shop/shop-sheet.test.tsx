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
import { configManager } from "@bibliothecadao/eternum";
import { nativeReleaseConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";
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
  [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Get the Pass"));

const view = (over: Partial<ShopViewProps>) => {
  const onBuy = vi.fn();
  act(() =>
    root.render(
      <ShopView
        fragments={340}
        pass={{ held: false, buying: false, onBuy }}
        questBonus={50}
        bar={180}
        code={<i data-code />}
        onClose={() => {}}
        {...over}
      />,
    ),
  );
  return { onBuy };
};

describe("the shop", () => {
  it("offers the Season Pass for 1,000 Fragments, and says what is missing in dollars while short", () => {
    view({});
    expect(text()).toContain("Season Pass");
    expect(text()).toContain("For the whole season");
    expect(text()).toContain("Daily quest pays 50% more");
    expect(getPass()?.disabled).toBe(true);
    expect(host.querySelector("[data-shop-short]")?.textContent).toBe("You have 340. Get 660 more for $6.60.");
    expect(host.querySelector("[data-code]")).not.toBeNull();
    expect(text()).toContain("Fragments 340");
    expect(text()).toContain("1 cent each. Stamina, rerolls, the Pass.");
    expect(text()).toContain("Each Fragment refills 2 points. A bar of 180 is 90 Fragments, $0.90.");
  });

  it("prices a gap below the smallest purchase at that purchase", () => {
    view({ fragments: 990 });
    expect(host.querySelector("[data-shop-short]")?.textContent).toBe("You have 990. Get 100 more for $1.00.");
  });

  it("sends the purchase from Get the Pass once the Fragments cover it", () => {
    const { onBuy } = view({ fragments: 1_200 });
    expect(host.querySelector("[data-shop-short]")).toBeNull();
    act(() => getPass()!.click());
    expect(onBuy).toHaveBeenCalledOnce();
  });

  it("offers no purchase or code while it is not known whether the account holds the Pass", () => {
    view({ pass: null });
    expect(getPass()).toBeUndefined();
    expect(host.querySelector("[data-code]")).toBeNull();
  });

  it("reads a held Pass from the account's Seal row: no purchase, no code, the Pass named as held", () => {
    const store = transferArmies();
    store.applyFacts([
      {
        model: "Seal",
        key: "0x5ea1",
        value: { game_id: 1, account: PLAYER, granted_at: "1" },
      },
      {
        model: "GameRelease",
        key: "0x1ab0",
        value: {
          game_id: 1,
          release_id: nativeReleaseConstants.SEAL_RELEASE,
          created_release_id: nativeReleaseConstants.SEAL_RELEASE,
        },
      },
    ]);
    act(() =>
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <GameProvider value={{ store, systemCalls: {} } as never} account={{ address: PLAYER } as never}>
            <ShopSheet onClose={() => {}} />
          </GameProvider>
        </QueryClientProvider>,
      ),
    );
    expect(text()).toContain("You have the Season Pass");
    expect(getPass()).toBeUndefined();
    expect(host.querySelector("[data-shop=code]")).toBeNull();
  });
});
