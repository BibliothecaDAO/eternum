import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const sign = vi.hoisted(() => ({ props: null as null | { owner: string; calls: unknown[]; onLanded: () => void } }));
vi.mock("./wallet-actions", () => ({
  WalletSign: (props: NonNullable<typeof sign.props>) => {
    sign.props = props;
    return <p>Wallet send</p>;
  },
}));

import { useDepositPaymentStore } from "@/hooks/store/use-deposit-payment-store";
import { DepositPaymentDialog } from "./deposit-payment";

const CALLS = [{ contractAddress: "0x10", entrypoint: "deposit_lords", calldata: ["25", "0xabc"] }];

it("pays the purse's deposit through the one wallet send, closing once it lands or when closed", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<DepositPaymentDialog />));
  expect(document.querySelector('[role="dialog"]')).toBeNull();

  const onLanded = vi.fn();
  const open = () =>
    useDepositPaymentStore.getState().open({ owner: "0x33", calls: CALLS, amount: "25", request: "0xabc", onLanded });
  await act(async () => open());
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.getAttribute("aria-label")).toBe("Deposit 25 LORDS");
  expect(sign.props).toMatchObject({ owner: "0x33", calls: CALLS });

  act(() => sign.props!.onLanded());
  expect(onLanded).toHaveBeenCalledOnce();
  expect(useDepositPaymentStore.getState().payment).toBeNull();
  expect(document.querySelector('[role="dialog"]')).toBeNull();

  await act(async () => open());
  act(() => [...document.querySelectorAll("button")].find((button) => button.textContent === "Close")!.click());
  expect(useDepositPaymentStore.getState().payment).toBeNull();
  expect(onLanded).toHaveBeenCalledOnce();

  act(() => root.unmount());
  host.remove();
});
