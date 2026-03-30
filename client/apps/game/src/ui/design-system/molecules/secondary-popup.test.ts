// @vitest-environment node

import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/audio/hooks/useUISound", () => ({
  useUISound: () => vi.fn(),
}));

vi.mock("@/audio", () => ({
  useUISound: () => vi.fn(),
}));

vi.mock("@/ui/design-system/atoms/button", () => ({
  default: () => null,
}));

vi.mock("@/ui/design-system/molecules/hint-modal-button", () => ({
  HintModalButton: () => null,
}));

vi.mock("react-draggable", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: { children: ReactNode }) => children,
  },
}));

import { resolvePopupWidth } from "./secondary-popup";

describe("resolvePopupWidth", () => {
  it("adds px to digit-only widths", () => {
    expect(resolvePopupWidth("960")).toBe("960px");
  });

  it("keeps widths that already include units", () => {
    expect(resolvePopupWidth("600px")).toBe("600px");
  });

  it("keeps CSS function widths unchanged", () => {
    expect(resolvePopupWidth("min(1180px, calc(100vw - 48px))")).toBe("min(1180px, calc(100vw - 48px))");
  });
});
