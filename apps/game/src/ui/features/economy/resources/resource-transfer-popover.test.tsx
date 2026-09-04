import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./realm-transfer", () => ({
  RealmTransfer: ({ resource }: { resource: number }) => <div data-testid="realm-transfer">transfer {resource}</div>,
}));

import { ResourceTransferPopover } from "./resource-transfer-popover";

const TwoChips = ({ onBeforeOpen }: { onBeforeOpen: () => void }) => (
  <>
    {[1, 2].map((slot) => (
      <ResourceTransferPopover
        key={slot}
        resourceId={7}
        onBeforeOpen={onBeforeOpen}
        trigger={({ toggle, isOpen }) => (
          <button type="button" onClick={toggle} data-open={isOpen}>
            open {slot}
          </button>
        )}
      />
    ))}
  </>
);

const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label)!;
const panels = () => document.querySelectorAll('[data-testid="realm-transfer"]');

describe("ResourceTransferPopover", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onBeforeOpen = vi.fn();

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    usePopoverStore.setState({ openId: null });
    onBeforeOpen.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<TwoChips onBeforeOpen={onBeforeOpen} />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("opens one transfer form per trigger, even for the same resource shown twice", async () => {
    await act(async () => button("open 1").click());
    expect(panels()).toHaveLength(1);
    expect(button("open 1").dataset.open).toBe("true");
    expect(button("open 2").dataset.open).toBe("false");

    await act(async () => button("open 2").click());
    expect(panels()).toHaveLength(1);
    expect(button("open 2").dataset.open).toBe("true");
  });

  it("runs the before-open hook only when opening", async () => {
    await act(async () => button("open 1").click());
    expect(onBeforeOpen).toHaveBeenCalledTimes(1);
    await act(async () => button("open 1").click());
    expect(onBeforeOpen).toHaveBeenCalledTimes(1);
    expect(panels()).toHaveLength(0);
  });
});
