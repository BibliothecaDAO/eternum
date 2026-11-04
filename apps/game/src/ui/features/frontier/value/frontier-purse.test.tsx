import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { depositStructure } from "../../../../../../value-relay/test-support/deposit-structure";
import { FrontierPurse } from "./frontier-purse";
const wallet = vi.hoisted(() => ({
  props: null as null | { calls: { calldata: string[] }[]; onState: (state: unknown) => void },
  refetch: vi.fn(),
}));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 7 } }));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ session: { user: { realmsId: "0x77" } } }),
}));
vi.mock("@/hooks/context/payout-wallet", () => ({ payoutAddressOf: () => "0x33" }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => 1000 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => {} }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { store: { get: () => ({ start_main_at: 1, end_at: 2000 }) } } }),
}));
vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x2" }) }));
vi.mock("@/runtime/l2-rpc", () => ({ L2_CHAIN: { id: "0x1" }, L2_BLOCK_MS: 1000 }));
vi.mock("@/shell/value/ledger", () => ({ environmentLedger: () => ({ address: "0x10" }) }));
vi.mock("@/shell/value/use-ledger-paused", () => ({ useLedgerPaused: () => false }));
vi.mock("./use-realm-lords", () => ({ useRealmLords: () => 90 }));
vi.mock("./use-spend-lords", () => ({
  useSpendLords: () => ({
    source: { chain: "0x1", ledger: "0x10" },
    balance: { available: 20n, swept: 0n },
    receipts: [],
  }),
}));
vi.mock("./link-wallet", () => ({ useLinkWallet: () => () => {} }));
vi.mock("./frontier-withdraw", () => ({ FrontierWithdraw: () => null }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "deposit-token" ? "0x99" : [],
    refetch: wallet.refetch,
  }),
}));
vi.mock("@/shell/value/wallet-actions", () => ({
  WalletSign: (props: typeof wallet.props) => {
    wallet.props = props;
    return <p>Wallet opened</p>;
  },
}));
const realm = depositStructure("0x30");
beforeEach(() => {
  localStorage.clear();
  wallet.props = null;
  vi.clearAllMocks();
});
async function render() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<FrontierPurse realm={realm} onClose={() => {}} />));
  return {
    host,
    button: (text: string) => [...host.querySelectorAll("button")].find((button) => button.textContent === text)!,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}
const amount = (host: HTMLElement) =>
  host.querySelector<HTMLInputElement>('input[aria-label="Whole LORDS to deposit"]')!;
const edit = (input: HTMLInputElement, value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
it("confirms one payment, resets the form and sends a second deposit with a fresh identity", async () => {
  const view = await render();
  await act(async () => view.button("Deposit LORDS").click());
  const first = wallet.props!.calls[1].calldata.at(-1);
  expect(amount(view.host).disabled).toBe(true);
  act(() => wallet.props!.onState({ kind: "landed" }));
  expect(amount(view.host).disabled).toBe(false);
  expect(localStorage.length).toBe(0);
  edit(amount(view.host), "25");
  await act(async () => view.button("Deposit LORDS").click());
  expect(wallet.props!.calls[1].calldata.slice(-2)).toEqual(["25", expect.any(String)]);
  expect(wallet.props!.calls[1].calldata.at(-1)).not.toBe(first);
  expect(view.host.querySelector("[data-spend-lords]")?.getAttribute("data-spend-lords")).toBe("20");
  view.unmount();
});
it.each(["no-strk", "refused"])("allows editing a definitively unsent or reverted %s payment", async (kind) => {
  const view = await render();
  await act(async () => view.button("Deposit LORDS").click());
  act(() => wallet.props!.onState({ kind, reason: "Rejected" }));
  act(() => view.button("Edit or cancel deposit").click());
  expect(amount(view.host).disabled).toBe(false);
  edit(amount(view.host), "3");
  await act(async () => view.button("Deposit LORDS").click());
  expect(wallet.props!.calls[1].calldata.at(-2)).toBe("3");
  view.unmount();
});
it("restores the exact uncertain 25 LORDS display and signed terms across reopening and an unsent retry", async () => {
  let view = await render();
  edit(amount(view.host), "25");
  await act(async () => view.button("Deposit LORDS").click());
  const first = wallet.props!.calls;
  act(() => wallet.props!.onState({ kind: "uncertain", reason: "Unavailable" }));
  expect(view.button("Edit or cancel deposit")).toBeUndefined();
  view.unmount();
  wallet.props = null;
  view = await render();
  expect(wallet.props).toBeNull();
  expect(amount(view.host).value).toBe("25");
  expect(amount(view.host).disabled).toBe(true);
  await act(async () => view.button("Retry payment").click());
  expect(wallet.props!.calls).toEqual(first);
  expect(wallet.props!.calls[1].calldata.at(-2)).toBe("25");
  act(() => wallet.props!.onState({ kind: "no-strk" }));
  expect(view.button("Edit or cancel deposit")).toBeUndefined();
  expect(amount(view.host).disabled).toBe(true);
  act(() => wallet.props!.onState({ kind: "landed" }));
  expect(amount(view.host).disabled).toBe(false);
  view.unmount();
});
