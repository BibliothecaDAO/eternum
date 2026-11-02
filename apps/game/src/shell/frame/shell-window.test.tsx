// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShellWindow } from "./shell-window";
import { setViewportWidth } from "./test-viewport";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  act(() => root.unmount());
  host.remove();
  // A sheet closed steps back off its history entry a moment later: that step lands here, not in the next test.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
});

/** A page with the control that opens the sheet, and the sheet's own two controls. */
const Page = ({ onClose }: { onClose?: () => void }) => {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose?.();
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Portrait
      </button>
      {open && (
        <ShellWindow title="Portrait" onClose={close}>
          <button type="button">First portrait</button>
          <button type="button">Last portrait</button>
        </ShellWindow>
      )}
    </>
  );
};

const button = (words: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (each) => each.textContent === words || each.getAttribute("aria-label") === words,
  )!;
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Portrait"]');
const key = (name: string, shift = false) =>
  act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { key: name, shiftKey: shift, bubbles: true }),
    );
  });

/** A pointer pressed on `target` at `from` and let go at `to`, from a finger or a mouse. */
const drag = (target: Element, from: number, to: number, pointerType: "touch" | "mouse") =>
  act(async () => {
    for (const [type, clientY] of [
      ["pointerdown", from],
      ["pointerup", to],
    ] as const) {
      const event = new MouseEvent(type, { bubbles: true, clientY });
      Object.defineProperty(event, "pointerType", { value: pointerType });
      target.dispatchEvent(event);
    }
  });

describe("the app's one sheet (review-no-back-1)", () => {
  it("takes the keyboard's focus as it opens, keeps Tab inside it, and gives it back to what opened it (P2-2)", async () => {
    setViewportWidth(1440);
    act(() => root.render(<Page />));
    button("Portrait").focus();
    await act(async () => button("Portrait").click());
    expect(dialog()!.contains(document.activeElement)).toBe(true);

    // Tab from the last control comes round to the first, and Shift+Tab from the first to the last.
    button("Last portrait").focus();
    await key("Tab");
    expect(document.activeElement).toBe(button("Close"));
    await key("Tab", true);
    expect(document.activeElement).toBe(button("Last portrait"));

    await key("Escape");
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(button("Portrait"));
  });

  it.each([1440, 390])(
    "closes on a finger's drag down its head at %i px, never a mouse's or a short one (P2-3)",
    async (width) => {
      setViewportWidth(width);
      const onClose = vi.fn();
      act(() => root.render(<Page onClose={onClose} />));
      await act(async () => button("Portrait").click());
      const head = dialog()!.querySelector("header")!;

      await drag(head, 100, 200, "mouse");
      await drag(head, 100, 130, "touch");
      expect(onClose).not.toHaveBeenCalled();
      expect(dialog()).not.toBeNull();

      await drag(head, 100, 200, "touch");
      expect(onClose).toHaveBeenCalledOnce();
      expect(dialog()).toBeNull();
    },
  );

  it("does not close on a drag in its body, which scrolls (P2-3)", async () => {
    setViewportWidth(390);
    act(() => root.render(<Page />));
    await act(async () => button("Portrait").click());
    await drag(button("First portrait"), 100, 300, "touch");
    expect(dialog()).not.toBeNull();
  });
});
