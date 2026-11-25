import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const l2 = vi.hoisted(() => ({ lords: "0x10e5" }));
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  get L2_LORDS() {
    return l2.lords;
  },
  l2Provider: () => ({ callContract: async () => [`0x${(10n ** 24n).toString(16)}`, "0x0"] }),
}));
vi.mock("@/hooks/context/starknet-provider", async () => ({
  StarknetProvider: (await import("@/ui/modules/identity/test-wallet")).StandInStarknetProvider,
}));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-in", session: { user: { realmsId: "realms-1", address: WALLET } } }),
}));
const defaultWallet = vi.hoisted(() => ({
  read: { wallet: null as null | undefined, failed: false, retry: () => {} },
}));
const directoryGames = vi.hoisted(() => ({
  games: [] as {
    chainId: string;
    game_id: number;
    name: string;
    season_number?: number;
    mode: string;
    status: string;
    clock_scale?: number;
    quest_bonus_percent?: number | null;
    clock: { start_main_at: number; end_at: number };
  }[],
  isError: false,
  error: null as unknown,
  refetch: () => {},
}));
vi.mock("@/hooks/context/default-wallet", () => ({ useDefaultWallet: () => defaultWallet.read }));
vi.mock("../herald", async (original) => ({
  ...(await original<typeof import("../herald")>()),
  useDirectory: () => ({
    data: directoryGames.isError ? undefined : { games: directoryGames.games },
    isPending: false,
    isError: directoryGames.isError,
    error: directoryGames.error,
    refetch: directoryGames.refetch,
  }),
}));
vi.mock("../profile/profile-pages", () => ({
  SignedInOnly: ({ children }: { children: (account: string) => ReactNode }) => children("realms-1"),
}));

import { MAINNET_TOKENS } from "@realms-world/chain";
import { IdentityRequestError } from "@realms-world/identity";
import { identityClient } from "@/hooks/context/identity-session";
import { installWallet } from "@/ui/modules/identity/test-wallet";

import { setViewportWidth } from "../frame/test-viewport";
import { SEASON_SPENDS_FRAGMENTS } from "../season";
import { FragmentsPage } from "./fragments-page";
import { fragmentsHref } from "./fragments-route";

const WALLET = "0x4a1";
const WEI = 10n ** 18n;
const GAME = { chainId: "0x52", gameId: 7 };
const QUOTE = {
  id: "quote-1",
  lordsWei: String(2_750n * WEI),
  token: "0x10e5",
  treasury: "0x7a",
  expiresAt: Math.floor(Date.now() / 1000) + 600,
};
const unmounts: (() => Promise<void>)[] = [];

const Where = () => {
  const { pathname, hash } = useLocation();
  return <output data-where>{`${pathname}${hash}`}</output>;
};

const mount = async (entry: string = fragmentsHref(GAME, "/g/0x52/7/map#shop"), spends: boolean | "default" = true) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route
              path="/shop"
              element={spends === "default" ? <FragmentsPage /> : <FragmentsPage spends={spends} />}
            />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmounts.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};

const press = (container: HTMLElement, text: string) =>
  act(async () =>
    [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(text))!.click(),
  );

const settled = async (check: () => void) => {
  await act(async () => {
    await import("../value/wallet-actions");
  });
  await vi.waitFor(async () => {
    await act(async () => {});
    check();
  });
};

const UNKNOWN = new IdentityRequestError(404, "unknown_payment");

afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount();
  l2.lords = QUOTE.token;
  defaultWallet.read = { wallet: null, failed: false, retry: () => {} };
  directoryGames.games = [];
  directoryGames.isError = false;
  directoryGames.error = null;
  directoryGames.refetch = () => {};
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it("offers the store's packs in dollars, the Ancient Seal's chosen, and pays its quote as one LORDS transfer", async () => {
  const wallet = installWallet("argentX", { account: WALLET });
  const price = vi
    .spyOn(identityClient, "priceFragments")
    .mockResolvedValue({ fragments: 1_000, cents: 1_000, quote: QUOTE });
  const pay = vi.spyOn(identityClient, "payFragments").mockResolvedValue({ state: "delivered", fragments: 1_000 });
  vi.spyOn(identityClient, "fragmentPayment").mockRejectedValue(UNKNOWN);
  const page = await mount();
  const packs = [...page.querySelectorAll("[data-fragment-packs] button")];
  expect(packs.map((pack) => pack.textContent)).toEqual([
    "100 Fragments$1.00",
    "500 Fragments$5.00",
    "1,000 FragmentsThe Ancient Seal$10.00",
  ]);
  expect(packs.map((pack) => pack.getAttribute("aria-pressed"))).toEqual(["false", "false", "true"]);
  expect(page.textContent).toContain("Pay with LORDS");
  expect(page.textContent).not.toContain("ETH");
  await press(page, "Pay $10.00");
  expect(price).toHaveBeenCalledWith(GAME, 1_000);
  expect(page.textContent).toContain("The treasury receives 2,750 LORDS");
  expect(page.textContent).not.toContain("Paid as");
  await settled(() => expect(wallet.transactions()).toHaveLength(1));
  expect(wallet.transactions()[0]).toEqual([
    {
      contract_address: QUOTE.token,
      entry_point: "transfer",
      calldata: [QUOTE.treasury, String(2_750n * WEI), "0"],
    },
  ]);
  await settled(() => expect(page.querySelector("[data-fragments-delivered]")).not.toBeNull());
  expect(pay).toHaveBeenCalledWith(QUOTE.id, "0xtx");
  expect(page.textContent).toContain("+1,000 Fragments");
  await press(page, "Back to the shop");
  expect(page.querySelector("[data-where]")?.textContent).toBe("/g/0x52/7/map#shop");
});

it("names the wallet whose balances it lists", async () => {
  installWallet("argentX", { account: WALLET, approves: false });
  vi.spyOn(identityClient, "priceFragments").mockResolvedValue({ fragments: 1_000, cents: 1_000, quote: QUOTE });
  const page = await mount();
  await press(page, "Pay $10.00");
  await settled(() => expect(page.querySelector("[data-pay-tokens]")).not.toBeNull());
  expect(page.textContent).toContain("Pay from your wallet 0x4a1");
  expect(page.querySelector("[data-pay-tokens] button")?.textContent).toContain("Holds 1,000,000");
  expect(page.textContent).not.toContain("You hold");
});

it("says a price that expired before the payment was read, and offers the packs again", async () => {
  installWallet("argentX", { account: WALLET });
  vi.spyOn(identityClient, "priceFragments").mockResolvedValue({ fragments: 500, cents: 500, quote: QUOTE });
  vi.spyOn(identityClient, "fragmentPayment").mockRejectedValue(UNKNOWN);
  vi.spyOn(identityClient, "payFragments").mockRejectedValue(new IdentityRequestError(410, "quote_expired"));
  const page = await mount();
  await press(page, "500 Fragments");
  await press(page, "Pay $5.00");
  await settled(() => expect(page.textContent).toContain("The price expired. Choose again."));
  await press(page, "Get Fragments");
  expect(page.querySelector("[data-fragment-packs]")).not.toBeNull();
});

it("says when a day's Fragments are bought already, and pays nothing", async () => {
  const wallet = installWallet("argentX", { account: WALLET });
  vi.spyOn(identityClient, "priceFragments").mockRejectedValue(new IdentityRequestError(429, "daily_cap"));
  const page = await mount();
  await press(page, "Pay $10.00");
  await settled(() => expect(page.textContent).toContain("That is more Fragments than one day allows."));
  expect(wallet.transactions()).toEqual([]);
});

it("puts a sent payment on its quote again after the answer was lost, and after the page was closed", async () => {
  installWallet("argentX", { account: WALLET });
  localStorage.setItem(
    "realms.fragment-payment:realms-1",
    JSON.stringify({ quoteId: QUOTE.id, hash: "0xsent", fragments: 500 }),
  );
  vi.spyOn(identityClient, "fragmentPayment").mockRejectedValue(UNKNOWN);
  const pay = vi
    .spyOn(identityClient, "payFragments")
    .mockRejectedValueOnce(new IdentityRequestError(503, "unavailable"))
    .mockResolvedValue({ state: "delivered", fragments: 500 });
  const page = await mount();
  await settled(() => expect(page.textContent).toContain("Try again"));
  expect(page.querySelector("[data-fragment-packs]")).toBeNull();
  await press(page, "Try again");
  await settled(() => expect(page.querySelector("[data-fragments-delivered]")).not.toBeNull());
  expect(pay.mock.calls).toEqual([
    [QUOTE.id, "0xsent"],
    [QUOTE.id, "0xsent"],
  ]);
  expect(localStorage.getItem("realms.fragment-payment:realms-1")).toBeNull();
});

it("lists every mainnet payment token when the environment uses mainnet LORDS", async () => {
  l2.lords = MAINNET_TOKENS.lords.address;
  const page = await mount();
  expect(page.textContent).toContain("Pay with LORDS · ETH · STRK · USDC");
});

it("offers to read the account's wallet again when its read failed, rather than waiting on it", async () => {
  const retry = vi.fn();
  defaultWallet.read = { wallet: undefined, failed: true, retry };
  const page = await mount();
  expect(page.textContent).toContain("Your Realms wallet could not be read.");
  await press(page, "Try again");
  expect(retry).toHaveBeenCalledOnce();
});

it("resolves the active Frontier season on /shop, supports custom amounts >= 100, and displays real Spend uses", async () => {
  setViewportWidth(1440);
  directoryGames.games = [
    {
      chainId: GAME.chainId,
      game_id: GAME.gameId,
      name: "frontier-1795248000",
      season_number: 3,
      mode: "frontier",
      status: "Live",
      clock_scale: 1,
      quest_bonus_percent: 50,
      clock: { start_main_at: 100, end_at: 9_999_999_999 },
    },
  ];
  vi.spyOn(identityClient, "getSealCode").mockResolvedValue({ held: false });
  const price = vi
    .spyOn(identityClient, "priceFragments")
    .mockResolvedValue({ fragments: 250, cents: 250, quote: QUOTE });
  const page = await mount("/shop");
  expect(page.querySelector("[data-shop-spend]")?.textContent).toContain("The Ancient Seal");
  expect(page.querySelector("[data-shop-spend]")?.textContent).toContain(
    "+50% daily quest labor · Season 3 Realm skin",
  );
  const customInput = page.querySelector<HTMLInputElement>("[data-fragment-custom] input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(customInput, "250");
    customInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await press(page, "Pay $2.50");
  expect(price).toHaveBeenCalledWith(GAME, 250);
});

it("shows a retryable failure on /shop when the season directory fails instead of claiming no season is live", async () => {
  setViewportWidth(1440);
  const refetch = vi.fn();
  directoryGames.isError = true;
  directoryGames.error = new Error("502");
  directoryGames.refetch = refetch;
  vi.spyOn(identityClient, "getSealCode").mockResolvedValue({ held: false });
  const page = await mount("/shop");
  expect(page.textContent).toContain("Season unavailable.");
  expect(page.textContent).not.toContain("No live Frontier season right now");
  await press(page, "Try again");
  expect(refetch).toHaveBeenCalledOnce();
});

it.each([1440, 390])(
  "closes Fragment purchases and spends cleanly at %ipx when spends are off, while keeping Ancient Seal code redemption working",
  async (width) => {
    setViewportWidth(width);
    vi.spyOn(identityClient, "getSealCode").mockResolvedValue({ held: false });
    const redeem = vi.spyOn(identityClient, "redeemSealCode").mockResolvedValue({ held: true });
    const page = await mount("/shop", false);
    expect(page.querySelector("[data-shop-page]")).not.toBeNull();
    expect(page.querySelector("[data-shop-closed]")).not.toBeNull();
    expect(page.textContent).toContain("Fragments shop closed");
    expect(page.textContent).toContain(
      "Fragments purchases and spends are closed right now. You can still use an Ancient Seal code below.",
    );
    expect(page.querySelector("[data-fragment-packs]")).toBeNull();
    expect(page.querySelector("[data-fragment-custom]")).toBeNull();
    expect(page.querySelector("[data-shop-spend]")).toBeNull();
    expect(page.querySelector('[role="tablist"]')).toBeNull();
    expect(page.textContent).not.toContain("Pay $");
    expect(page.textContent).not.toContain("Refill stamina");
    expect(page.textContent).not.toContain("Reroll Oath");
    await vi.waitFor(() => expect(page.querySelector('[data-seal-code="open"]')).not.toBeNull());
    const input = page.querySelector<HTMLInputElement>('[data-seal-code="open"] input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "SEAL2345");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      page.querySelector<HTMLFormElement>('[data-seal-code="open"] form')!.requestSubmit();
    });
    expect(redeem).toHaveBeenCalledWith("SEAL2345");
    await vi.waitFor(() => expect(page.querySelector('[data-seal-code="held"]')).not.toBeNull());
    expect(page.textContent).toContain("Your Ancient Seal is held");
  },
);

it("defaults FragmentsPage open/closed state from SEASON_SPENDS_FRAGMENTS", async () => {
  setViewportWidth(1440);
  vi.spyOn(identityClient, "getSealCode").mockResolvedValue({ held: false });
  const page = await mount(fragmentsHref(GAME, "/"), "default");
  expect(page.querySelector("[data-shop-closed]") !== null).toBe(!SEASON_SPENDS_FRAGMENTS);
  expect(page.querySelector("[data-fragment-packs]") !== null).toBe(SEASON_SPENDS_FRAGMENTS);
});
