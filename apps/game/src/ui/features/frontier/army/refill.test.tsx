import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { RefillButton, RefillConfirm } from "./refill";
import { ArmyRefill } from "./army-refill";
import type { DockArmy } from "../hud/dock-armies";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
const calls = vi.hoisted(() => ({ refill: vi.fn(async () => "0x123"), signer: { address: "0x1" } }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { systemCalls: { refill_stamina: calls.refill } }, account: { account: calls.signer } }),
}));
vi.mock("../value/use-realm-lords", () => ({ useRealmLords: () => 40 }));
vi.mock("@/hooks/store/use-actions-in-flight", () => ({
  useInFlight: () => undefined,
  sendOnce: async (_kind: string, _id: number, _wait: boolean, send: () => Promise<unknown>) => send(),
}));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { failed: vi.fn() } }));

const render = (node: React.ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return {
    host,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
};

describe("partial stamina refills", () => {
  it.each([1, 40, 1240])("opens a refill with %s LORDS even when a full refill costs more", (held) => {
    const onRefill = vi.fn();
    const { host, unmount } = render(<RefillButton held={held} onRefill={onRefill} />);
    act(() => host.querySelector("button")!.click());
    expect(onRefill).toHaveBeenCalledOnce();
    unmount();
  });
  it.each([undefined, 0, 0.9])("refuses a purchase without a whole LORDS: %s", (held) => {
    const onRefill = vi.fn();
    const { host, unmount } = render(<RefillButton held={held} onRefill={onRefill} />);
    expect(host.querySelector("button")!.disabled).toBe(true);
    unmount();
  });
  it("keeps an in-flight refill disabled", () => {
    const onRefill = vi.fn();
    const { host, unmount } = render(<RefillButton held={1240} refilling onRefill={onRefill} />);
    expect(host.querySelector("button")!.disabled).toBe(true);
    expect(host.textContent).toContain("Refilling…");
    unmount();
  });
  it.each([
    [1240, 130, 150, "1.2K → 1.1K"],
    [40, 40, 60, "40 → 0"],
  ])("defaults to an affordable purchase from %s LORDS", (held, amount, after, balance) => {
    const onRefill = vi.fn();
    const { host, unmount } = render(
      <RefillConfirm
        stamina={{ current: 20, max: 150 }}
        held={held}
        sending={false}
        onRefill={onRefill}
        onCancel={vi.fn()}
      />,
    );
    expect(host.querySelector(`[aria-label="stamina 20 → ${after}"]`)).not.toBeNull();
    expect(host.querySelector(`[aria-label="LORDS ${balance}"]`)).not.toBeNull();
    const button = [...host.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Refill"))!;
    act(() => button.click());
    expect(onRefill).toHaveBeenCalledWith(amount);
    unmount();
  });
  it("sends the chosen amount and updates both resulting balances", () => {
    const onRefill = vi.fn();
    const { host, unmount } = render(
      <RefillConfirm
        stamina={{ current: 20, max: 150 }}
        held={40}
        sending={false}
        onRefill={onRefill}
        onCancel={vi.fn()}
      />,
    );
    const slider = host.querySelector("input")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "15");
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelector('[aria-label="stamina 20 → 35"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="LORDS 40 → 25"]')).not.toBeNull();
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Refill"))!.click());
    expect(onRefill).toHaveBeenCalledWith(15);
    unmount();
  });
});

it("sends a partial refill through the army's real caller", async () => {
  const { host, unmount } = render(
    <ArmyRefill
      army={{ explorerId: 7, stamina: { current: 20, max: 150 } } as DockArmy}
      realm={{ entity_id: 1n } as NativeRows["Structure"]}
    />,
  );
  act(() => host.querySelector("button")!.click());
  const slider = host.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "15");
    slider.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () =>
    [...host.querySelectorAll("button")].find((b) => b.textContent === "Refill · 15 LORDS")!.click(),
  );
  expect(calls.refill).toHaveBeenCalledOnce();
  expect(calls.refill).toHaveBeenCalledWith({ signer: calls.signer, explorerId: 7, amount: 15 });
  expect(host.querySelector("input")).toBeNull();
  unmount();
});
