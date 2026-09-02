import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Popover } from "./popover";

const Trigger = ({ id, label }: { id: string; label: string }) => {
  const toggle = usePopoverStore((state) => state.toggle);
  return (
    <button type="button" onClick={() => toggle(id)}>
      {label}
    </button>
  );
};

const TwoPopovers = () => (
  <>
    <Popover id="a" ariaLabel="A" trigger={<Trigger id="a" label="open a" />}>
      <span>panel a</span>
    </Popover>
    <Popover id="b" ariaLabel="B" trigger={<Trigger id="b" label="open b" />}>
      <span>panel b</span>
    </Popover>
  </>
);

const panel = (id: string) => document.querySelector<HTMLElement>(`[data-popover-panel="${id}"]`);
const trigger = (label: string) =>
  [...document.querySelectorAll("button")].find((button) => button.textContent === label)!;

describe("Popover", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    usePopoverStore.setState({ openId: null });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<TwoPopovers />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("anchors the panel on the body without a scrim", async () => {
    await act(async () => trigger("open a").click());

    const panelA = panel("a");
    expect(panelA?.parentElement).toBe(document.body);
    expect(panelA?.getAttribute("role")).toBe("dialog");
    expect(document.body.querySelectorAll('[class*="inset-0"]')).toHaveLength(0);
  });

  it("keeps at most one popover open", async () => {
    await act(async () => trigger("open a").click());
    await act(async () => trigger("open b").click());

    expect(panel("a")).toBeNull();
    expect(panel("b")).not.toBeNull();
    expect(usePopoverStore.getState().openId).toBe("b");
  });

  it("toggles from its own trigger and closes on Escape", async () => {
    await act(async () => trigger("open a").click());
    await act(async () => trigger("open a").click());
    expect(panel("a")).toBeNull();

    await act(async () => trigger("open a").click());
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(panel("a")).toBeNull();
  });

  it("closes on a pointer-down outside and stays open for one inside", async () => {
    await act(async () => trigger("open a").click());
    await act(async () => {
      panel("a")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(panel("a")).not.toBeNull();

    await act(async () => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(panel("a")).toBeNull();
  });
});
