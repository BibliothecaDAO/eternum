// @vitest-environment jsdom
import { RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { act, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The bank as a player uses it: the game's calls, the pool's quotes, balances and the game mode are stood in for. */
const world = vi.hoisted(() => ({
  mode: "blitz" as "blitz" | "eternum" | "frontier",
  calls: { buy_resources: vi.fn(), sell_resources: vi.fn(), add_liquidity: vi.fn() },
}));

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: { systemCalls: world.calls, store: { get: () => ({ base: { category: StructureType.Realm } }) } },
    account: { account: { address: "0x1" } },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", async () =>
  (await import("@/hooks/helpers/native-facts-mock")).nativeFactsMock(),
);
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => [] }));
vi.mock("@/audio", () => ({ useUISound: () => () => {} }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ id: world.mode, resources: { getTiers: () => ({ common: [ResourcesIds.Wood] }) } }),
}));
vi.mock("@/ui/design-system/molecules/popover", () => ({
  PopoverPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));
vi.mock("@/ui/design-system/molecules/resource-cost", () => ({ ResourceCost: () => null }));
/** The donkeys can carry whatever the trade brings back. */
vi.mock("@/ui/features/economy/resources", () => ({
  TravelInfo: ({ setCanCarry }: { setCanCarry: (canCarry: boolean) => void }) => {
    useEffect(() => {
      setCanCarry(true);
    }, [setCanCarry]);
    return null;
  },
}));
vi.mock("./liquidity-resource-row", () => ({ LiquidityResourceRow: () => null }));
/** A pool where a Lord buys two wood, with no fees, and a structure holding 1,000 of everything. */
vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bibliothecadao/eternum")>();
  vi.spyOn(actual.configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(actual.configManager, "getAdminBankOwnerFee").mockReturnValue(0);
  vi.spyOn(actual.configManager, "getAdminBankLpFee").mockReturnValue(0);
  vi.spyOn(actual.configManager, "getBankConfig").mockReturnValue({ lpFeesNumerator: 0 } as never);
  return {
    ...actual,
    getBlockTimestamp: () => ({ currentDefaultTick: 0, currentBlockTimestamp: 0 }),
    getBalance: () => ({ balance: 1_000 * RESOURCE_PRECISION }),
    getClosestBank: () => ({ bankId: 5 }),
    MarketManager: class {
      resourceId = ResourcesIds.Wood;
      calculateResourceOutputForLordsInput = (lords: number) => lords * 2;
      calculateLordsInputForResourceOutput = (resource: number) => resource / 2;
      calculateResourceInputForLordsOutput = (lords: number) => lords * 2;
      calculateLordsOutputForResourceInput = (resource: number) => resource / 2;
      getMarketPrice = () => 0.5;
      slippage = () => 0;
      hasReserves = () => false;
    },
  };
});

import AddLiquidity from "./add-liquidity";
import { ResourceSwap } from "./swap";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  Object.values(world.calls).forEach((call) => call.mockReset().mockResolvedValue(undefined));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const STRUCTURE = 7;
const buttonIn = (scope: ParentNode, text: string) =>
  [...scope.querySelectorAll("button")].find((each) => each.textContent === text)!;
const press = async (text: string, scope: ParentNode = host) => {
  await act(async () => buttonIn(scope, text).click());
};
const typeInto = (label: string, text: string) =>
  act(() => {
    const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

describe("a swap", () => {
  const swap = () => act(() => root.render(<ResourceSwap entityId={STRUCTURE} listResourceId={ResourcesIds.Wood} />));

  it.each(["blitz", "eternum"] as const)("reads a typed fraction and swaps at once in %s", async (mode) => {
    world.mode = mode;
    swap();
    typeInto("Lords amount", "2.5");
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Wood amount"]')!.value).toBe("5");
    await press("Swap LORDS for Wood");
    expect(world.calls.buy_resources).toHaveBeenCalledTimes(1);
    expect(world.calls.buy_resources.mock.calls[0][0]).toMatchObject({
      bank_entity_id: 5,
      entity_id: STRUCTURE,
      resource_type: ResourcesIds.Wood,
      amount: 5 * RESOURCE_PRECISION,
    });
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("asks first in Frontier: going back swaps nothing, confirming swaps once", async () => {
    world.mode = "frontier";
    swap();
    typeInto("Lords amount", "2.5");
    await press("Swap LORDS for Wood");
    expect(world.calls.buy_resources).not.toHaveBeenCalled();
    await press("Cancel", host.querySelector('[role="alertdialog"]')!);
    expect(world.calls.buy_resources).not.toHaveBeenCalled();
    await press("Swap LORDS for Wood");
    await press("Swap LORDS for Wood", host.querySelector('[role="alertdialog"]')!);
    expect(world.calls.buy_resources).toHaveBeenCalledTimes(1);
  });
});

describe("a deposit", () => {
  const deposit = () =>
    act(() => root.render(<AddLiquidity entityId={STRUCTURE} listResourceId={ResourcesIds.Wood} />));

  it("deposits at once in Blitz", async () => {
    world.mode = "blitz";
    deposit();
    typeInto("Lords amount", "10");
    typeInto("Wood amount", "20");
    await press("Add Liquidity");
    expect(world.calls.add_liquidity).toHaveBeenCalledTimes(1);
    expect(world.calls.add_liquidity.mock.calls[0][0].calls).toEqual([
      {
        resource_type: ResourcesIds.Wood,
        resource_amount: 20 * RESOURCE_PRECISION,
        lords_amount: 10 * RESOURCE_PRECISION,
      },
    ]);
  });

  it("asks first in Frontier", async () => {
    world.mode = "frontier";
    deposit();
    typeInto("Lords amount", "10");
    typeInto("Wood amount", "20");
    await press("Add Liquidity");
    expect(world.calls.add_liquidity).not.toHaveBeenCalled();
    await press("Add Liquidity", host.querySelector('[role="alertdialog"]')!);
    expect(world.calls.add_liquidity).toHaveBeenCalledTimes(1);
  });
});

/** The game's answer to a send, held until the test gives it: accepted, or refused. */
const held = (call: ReturnType<typeof vi.fn>) => {
  let answer!: (refused: boolean) => void;
  call.mockImplementation(
    () =>
      new Promise<void>((resolve, reject) => {
        answer = (refused) => (refused ? reject(new Error("refused")) : resolve());
      }),
  );
  return (refused = false) =>
    act(async () => {
      answer(refused);
    });
};

describe("a bank send in flight", () => {
  const forms = {
    swap: {
      call: () => world.calls.buy_resources,
      verb: "Swap LORDS for Wood",
      draw: () => act(() => root.render(<ResourceSwap entityId={STRUCTURE} listResourceId={ResourcesIds.Wood} />)),
      fill: () => typeInto("Lords amount", "2.5"),
    },
    deposit: {
      call: () => world.calls.add_liquidity,
      verb: "Add Liquidity",
      draw: () => act(() => root.render(<AddLiquidity entityId={STRUCTURE} listResourceId={ResourcesIds.Wood} />)),
      fill: () => {
        typeInto("Lords amount", "10");
        typeInto("Wood amount", "20");
      },
    },
  };
  const confirm = () => host.querySelector('[role="alertdialog"]');

  it.each(
    Object.entries(forms).flatMap(([name, form]) =>
      (["accepted", "refused"] as const).map((answered) => [name, answered, form] as const),
    ),
  )("Frontier %s sends once while its confirm waits, and again after the first was %s", async (_, answered, form) => {
    const refused = answered === "refused";
    world.mode = "frontier";
    form.draw();
    form.fill();
    const answer = held(form.call());
    vi.spyOn(console, "error").mockImplementation(() => {});
    await press(form.verb);
    await press(form.verb, confirm()!);
    await press(form.verb, confirm()!);
    expect(form.call()).toHaveBeenCalledTimes(1);
    await answer(refused);
    expect(confirm()).toBeNull();
    form.fill();
    await press(form.verb);
    await press(form.verb, confirm()!);
    expect(form.call()).toHaveBeenCalledTimes(2);
    await answer();
  });

  it.each(Object.entries(forms))("Blitz %s sends once while it waits, and again once answered", async (_, form) => {
    world.mode = "blitz";
    form.draw();
    form.fill();
    const answer = held(form.call());
    // The same button twice: once sending, it says so in its own words.
    const verb = buttonIn(host, form.verb);
    await act(async () => verb.click());
    expect(verb.disabled).toBe(true);
    await act(async () => verb.click());
    expect(form.call()).toHaveBeenCalledTimes(1);
    await answer();
    form.fill();
    await press(form.verb);
    expect(form.call()).toHaveBeenCalledTimes(2);
    await answer();
  });
});
