// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio/hooks/useUISound", () => ({
  useUISound: () => vi.fn(),
}));

vi.mock("@/audio", () => ({
  useUISound: () => vi.fn(),
}));

vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({ children, onClick, ...props }: React.ComponentProps<"button">) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/ui/design-system/molecules/hint-modal-button", () => ({
  HintModalButton: () => null,
}));

vi.mock("react-draggable", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<"div">) => <div {...props}>{children}</div>,
  },
}));

import { BasePopup } from "./base-popup";
import { SecondaryPopup } from "./secondary-popup";

const SecondaryPopupWithSubmit = SecondaryPopup as typeof SecondaryPopup & ((props: any) => React.ReactElement);
const BasePopupWithSubmit = BasePopup as typeof BasePopup & ((props: any) => React.ReactElement);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("popup submit shortcuts", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const render = (ui: React.ReactNode) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(ui);
    });
  };

  it("submits a SecondaryPopup when Enter is pressed in an input", () => {
    const onSubmit = vi.fn();

    render(
      <SecondaryPopupWithSubmit width="560" submitOnEnter onSubmit={onSubmit}>
        <SecondaryPopup.Head>Army</SecondaryPopup.Head>
        <SecondaryPopup.Body width="100%" height="auto">
          <input aria-label="Troop count" />
        </SecondaryPopup.Body>
      </SecondaryPopupWithSubmit>,
    );

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    act(() => {
      input?.focus();
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not submit a SecondaryPopup from textarea Enter", () => {
    const onSubmit = vi.fn();

    render(
      <SecondaryPopupWithSubmit width="560" submitOnEnter onSubmit={onSubmit}>
        <SecondaryPopup.Head>Notes</SecondaryPopup.Head>
        <SecondaryPopup.Body width="100%" height="auto">
          <textarea aria-label="Notes" />
        </SecondaryPopup.Body>
      </SecondaryPopupWithSubmit>,
    );

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    act(() => {
      textarea?.focus();
      textarea?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a BasePopup when Enter is pressed in an input", () => {
    const onSubmit = vi.fn();

    render(
      <BasePopupWithSubmit title="Confirm" onClose={vi.fn()} submitOnEnter onSubmit={onSubmit}>
        <input aria-label="Amount" />
      </BasePopupWithSubmit>,
    );

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    act(() => {
      input?.focus();
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
