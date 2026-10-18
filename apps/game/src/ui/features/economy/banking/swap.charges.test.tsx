// @vitest-environment jsdom
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { act, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// What the bank's pool asks for the Wheat a player buys, in LORDS: the one figure each case sets.
const pool = vi.hoisted(() => ({ lordsForWheat: 0 }));

// Only the boundaries are stubbed: the game's mode, chain and balances, the bank's pool maths, the amount fields, the
// donkey check and the dialog's frame. The swap, its debit and credit and the writer they go through are the real ones.
// Frontier: the swap asks first, and its confirmation states what it takes and gives.
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ id: "frontier", resources: { getTiers: () => ({ food: [ResourcesIds.Wheat] }) } }),
}));
vi.mock("@/audio", () => ({ useUISound: () => () => undefined }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    account: { account: { address: "0x1" } },
    setup: { store: { get: () => undefined }, systemCalls: { buy_resources: vi.fn(), sell_resources: vi.fn() } },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const eternum = await importOriginal<typeof import("@bibliothecadao/eternum")>();
  class MarketManager {
    resourceId: number;
    constructor(_store: unknown, _player: unknown, resourceId: number) {
      this.resourceId = resourceId;
    }
    calculateLordsInputForResourceOutput = () => eternum.multiplyByPrecision(pool.lordsForWheat);
    calculateResourceOutputForLordsInput = () => 0;
    getMarketPrice = () => 1;
    slippage = () => 0;
  }
  return {
    ...eternum,
    MarketManager,
    getBlockTimestamp: () => ({ currentDefaultTick: 1 }),
    getBalance: () => ({ balance: 10 ** 30 }),
    getClosestBank: () => ({ bankId: 9 }),
  };
});
vi.mock("./resource-bar", () => ({
  // The Wheat field: typing an amount is setting it.
  ResourceBar: ({ resourceId, setAmount }: { resourceId: number; setAmount: (amount: number) => void }) =>
    resourceId === ResourcesIds.Lords ? null : (
      <button type="button" data-wheat onClick={() => setAmount(Number(document.body.dataset.wheat))}>
        type wheat
      </button>
    ),
}));
vi.mock("@/ui/features/economy/resources", () => ({
  TravelInfo: ({ setCanCarry }: { setCanCarry: (canCarry: boolean) => void }) => {
    useEffect(() => {
      setCanCarry(true);
    }, [setCanCarry]);
    return null;
  },
}));
vi.mock("@/ui/design-system/molecules/popover", () => ({
  PopoverPanel: ({ children }: { children: ReactNode }) => <section data-confirm>{children}</section>,
}));

import { ResourceSwap } from "./swap";

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  vi.restoreAllMocks();
});

describe("a swap's debit and credit, in its confirmation", () => {
  it.each([
    { wheat: 100, lords: 0.25, debit: "-0.25", credit: "+100" },
    { wheat: 2.5, lords: 1.25, debit: "-1.25", credit: "+2.5" },
    { wheat: 50_000, lords: 12_400, debit: "-12,400", credit: "+50,000" },
  ])("buying $wheat Wheat for $lords LORDS reads $debit → $credit", ({ wheat, lords, debit, credit }) => {
    vi.spyOn(configManager, "getAdminBankOwnerFee").mockReturnValue(0);
    vi.spyOn(configManager, "getAdminBankLpFee").mockReturnValue(0);
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    vi.spyOn(configManager, "getBankConfig").mockReturnValue({ lpFeesNumerator: 0 } as ReturnType<
      typeof configManager.getBankConfig
    >);
    pool.lordsForWheat = lords;
    document.body.dataset.wheat = String(wheat);

    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(<ResourceSwap entityId={1} listResourceId={ResourcesIds.Wheat} />));
    unmount = () => {
      act(() => root.unmount());
      host.remove();
    };

    act(() => host.querySelector<HTMLButtonElement>("[data-wheat]")!.click());
    const swap = [...host.querySelectorAll("button")].find((button) => button.textContent === "Swap LORDS for Wheat");
    expect(swap?.disabled).toBe(false);
    act(() => swap!.click());

    const confirmation = host.querySelector("[data-confirm]")?.textContent ?? "";
    expect(confirmation.match(/-[\d,.]+→\+[\d,.]+/)?.[0]).toBe(`${debit}→${credit}`);
  });
});
