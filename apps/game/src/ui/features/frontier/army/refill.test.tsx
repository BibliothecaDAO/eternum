import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { RefillButton, RefillConfirm, RefillPrice } from "./refill";
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

describe("the army panel's priced refill", () => {
  it("names what a full bar costs, in LORDS, and opens the confirm", () => {
    const onRefill = vi.fn();
    const { host, unmount } = render(<RefillPrice price={123} held={1240} onRefill={onRefill} />);
    const button = host.querySelector("button")!;
    expect(button.textContent).toBe("Refill123 LORDS");
    expect(button.getAttribute("aria-label")).toBe("Refill stamina · 123 LORDS");
    expect(button.dataset.tone).toBeUndefined();
    act(() => button.click());
    expect(onRefill).toHaveBeenCalledOnce();
    unmount();
  });
  it.each([
    [0, "0"],
    [0.9, "<1"],
  ])("is red and out of reach with %s LORDS, saying what it needs and what the realm holds", (held, shown) => {
    const onRefill = vi.fn();
    const { host, unmount } = render(<RefillPrice price={123} held={held} onRefill={onRefill} />);
    const button = host.querySelector("button")!;
    expect(button.disabled).toBe(true);
    expect(button.dataset.tone).toBe("bad");
    expect(button.title).toBe(`Needs 123 LORDS, have ${shown}`);
    expect(button.getAttribute("aria-label")).toBe(`Refill stamina · 123 LORDS · Needs 123 LORDS, have ${shown}`);
    unmount();
  });
});

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
