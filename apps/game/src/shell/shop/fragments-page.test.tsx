import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  l2Provider: () => ({ callContract: async () => [`0x${(10n ** 24n).toString(16)}`, "0x0"] }),
}));
vi.mock("@/hooks/context/starknet-provider", async () => ({
  StarknetProvider: (await import("@/ui/modules/identity/test-wallet")).StandInStarknetProvider,
}));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-in", session: { user: { address: WALLET } } }),
}));
const defaultWallet = vi.hoisted(() => ({
  read: { wallet: null as null | undefined, failed: false, retry: () => {} },
}));
vi.mock("@/hooks/context/default-wallet", () => ({ useDefaultWallet: () => defaultWallet.read }));
vi.mock("../profile/profile-pages", () => ({
  SignedInOnly: ({ children }: { children: (account: string) => ReactNode }) => children("realms-1"),
}));

import { IdentityRequestError } from "@realms-world/identity";
import { identityClient } from "@/hooks/context/identity-session";
import { installWallet } from "@/ui/modules/identity/test-wallet";

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

const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[fragmentsHref(GAME, "/g/0x52/7/map#shop")]}>
          <Routes>
            <Route path="/shop/fragments" element={<FragmentsPage />} />
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
  defaultWallet.read = { wallet: null, failed: false, retry: () => {} };
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
  expect(page.textContent).toContain("Pay with LORDS · ETH · STRK · USDC");
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

it("offers to read the account's wallet again when its read failed, rather than waiting on it", async () => {
  const retry = vi.fn();
  defaultWallet.read = { wallet: undefined, failed: true, retry };
  const page = await mount();
  expect(page.textContent).toContain("Your Realms wallet could not be read.");
  await press(page, "Try again");
  expect(retry).toHaveBeenCalledOnce();
});
