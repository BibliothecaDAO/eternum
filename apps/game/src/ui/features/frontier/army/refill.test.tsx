import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { RefillButton, RefillChip, RefillConfirm, StaminaRefill } from "./refill";

const render = (node: React.ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, unmount: () => act(() => root.unmount()) };
};

describe("the refill", () => {
  it("refills on its verb alone (its confirm says the price), and shows the LORDS held against the price when they fall short", () => {
    const onRefill = vi.fn();
    const enough = render(<RefillButton price={140} held={1_240} onRefill={onRefill} />);
    act(() => enough.host.querySelector("button")!.click());
    expect(onRefill).toHaveBeenCalled();
    expect(enough.host.textContent).toBe("Refill");
    enough.unmount();
    const short = render(<RefillButton price={130} held={40} onRefill={onRefill} />);
    expect(short.host.querySelector("button")).toBeNull();
    // Named Refill, and its hover says what the two numbers are: the LORDS held, against the refill's whole price.
    const chip = short.host.querySelector('[role="img"]')!;
    expect(chip.getAttribute("aria-label")).toBe("Refill needs 130 LORDS, has 40");
    expect(chip.textContent).toBe("Refill40 / 130");
    // Two lines, its name over the numbers, with no frame of its own: it stands inside the card that holds it.
    expect([...chip.lastElementChild!.children].map((line) => line.textContent)).toEqual(["Refill", "40 / 130"]);
    expect(chip.querySelector(".ui-panel")).toBeNull();
    short.unmount();
  });

  it("on the army card is a chip that presses: its price, or short of LORDS what is held against it, unpressable", () => {
    const onRefill = vi.fn();
    const enough = render(<RefillChip price={150} held={1_240} onRefill={onRefill} />);
    const chip = enough.host.querySelector("button")!;
    // A chip's size, so it stands level with the troops and +120 a tile beside it.
    expect(chip.className).toBe("ui-chip");
    expect(chip.getAttribute("aria-label")).toBe("Refill 150");
    act(() => chip.click());
    expect(onRefill).toHaveBeenCalledTimes(1);
    enough.unmount();

    const short = render(<RefillChip price={150} held={40} onRefill={onRefill} />);
    const shortChip = short.host.querySelector("button")!;
    expect(shortChip.textContent).toBe("40 / 150");
    expect(shortChip.getAttribute("data-tone")).toBe("bad");
    expect(shortChip.getAttribute("data-tip")).toBe("Refill needs 150 LORDS, has 40");
    expect(shortChip.disabled).toBe(true);
    act(() => shortChip.click());
    expect(onRefill).toHaveBeenCalledTimes(1);
    short.unmount();

    const sending = render(<RefillChip price={150} held={1_240} refilling onRefill={onRefill} />);
    expect(sending.host.querySelector("button")!.textContent).toBe("Refilling…");
    expect(sending.host.querySelector("button")!.disabled).toBe(true);
    sending.unmount();
  });

  it("beside a phone's picked army is its stamina: pressed for the refill, red and unpressable when short, at rest when full", () => {
    const onRefill = vi.fn();
    const button = (node: React.ReactNode) => {
      const view = render(node);
      const pressed = view.host.querySelector("button")!;
      const read = [
        pressed.textContent,
        pressed.getAttribute("aria-label"),
        pressed.disabled,
        pressed.dataset.tone ?? null,
      ];
      const tip = pressed.dataset.tip ?? null;
      act(() => pressed.click());
      view.unmount();
      return [...read, tip];
    };
    expect(button(<StaminaRefill stamina={{ current: 14, max: 140 }} held={500} onRefill={onRefill} />)).toEqual([
      "14/140",
      "Refill 14/140",
      false,
      null,
      null,
    ]);
    expect(onRefill).toHaveBeenCalledTimes(1);
    expect(button(<StaminaRefill stamina={{ current: 14, max: 140 }} held={100} onRefill={onRefill} />)).toEqual([
      "14/140",
      "Refill 14/140",
      true,
      "bad",
      "Refill needs 126 LORDS, has 100",
    ]);
    expect(button(<StaminaRefill stamina={{ current: 140, max: 140 }} held={100} onRefill={onRefill} />)).toEqual([
      "140/140",
      "Refill 140/140",
      true,
      null,
      null,
    ]);
    expect(onRefill).toHaveBeenCalledTimes(1);
  });

  it("reads Refilling… and cannot be pressed while the army's refill is in flight", () => {
    const onRefill = vi.fn();
    const { host, unmount } = render(<RefillButton price={140} held={1_240} refilling onRefill={onRefill} />);
    const button = host.querySelector("button")!;
    expect(button.textContent).toContain("Refilling…");
    expect(button.disabled).toBe(true);
    act(() => button.click());
    expect(onRefill).not.toHaveBeenCalled();
    unmount();
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
    expect(host.querySelector('[aria-label="LORDS 1.2K → 1.1K"]')).not.toBeNull();
    const buttons = [...host.querySelectorAll("button")];
    act(() => buttons.find((button) => button.textContent?.startsWith("Refill"))!.click());
    act(() => buttons.find((button) => button.textContent === "Cancel")!.click());
    expect(onRefill).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    unmount();
  });
});
