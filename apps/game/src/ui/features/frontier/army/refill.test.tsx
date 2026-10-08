import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { RefillButton, RefillConfirm } from "./refill";

const render = (node: React.ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, unmount: () => act(() => root.unmount()) };
};

describe("the refill", () => {
  it("prices the missing points in LORDS, and shows the LORDS held against the price when they fall short", () => {
    const onRefill = vi.fn();
    const enough = render(<RefillButton price={140} held={1_240} onRefill={onRefill} />);
    act(() => enough.host.querySelector("button")!.click());
    expect(onRefill).toHaveBeenCalled();
    expect(enough.host.textContent).toContain("140");
    enough.unmount();
    const short = render(<RefillButton price={130} held={40} onRefill={onRefill} />);
    expect(short.host.querySelector("button")).toBeNull();
    expect(short.host.querySelector('[aria-label="LORDS 40 / 130"]')).not.toBeNull();
    short.unmount();
  });

  it("confirms the bar to full and the LORDS before and after, with Cancel and Refill", () => {
    const onRefill = vi.fn();
    const onCancel = vi.fn();
    const { host, unmount } = render(
      <RefillConfirm
        stamina={{ current: 20, max: 150 }}
        held={1_240}
        sending={false}
        onRefill={onRefill}
        onCancel={onCancel}
      />,
    );
    expect(host.querySelector('[aria-label="stamina 20 → 150"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="LORDS 1,240 → 1,110"]')).not.toBeNull();
    const buttons = [...host.querySelectorAll("button")];
    act(() => buttons.find((button) => button.textContent?.startsWith("Refill"))!.click());
    act(() => buttons.find((button) => button.textContent === "Cancel")!.click());
    expect(onRefill).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    unmount();
  });
});
