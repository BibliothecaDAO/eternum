// @vitest-environment node

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closeSurface: vi.fn(),
  frameOnClose: null as null | (() => void),
}));

vi.mock("@/hooks/store/use-popover-store", () => ({
  usePopoverStore: (selector: (state: { closeSurface: typeof mocks.closeSurface }) => unknown) =>
    selector({ closeSurface: mocks.closeSurface }),
}));

// Production renders through the shared surface frame inside the popover panel. Mock the frame so this stays a
// focused adapter test.
vi.mock("@/ui/design-system/molecules/popover", () => ({
  SurfaceFrame: ({
    title,
    className,
    onClose,
    children,
  }: {
    title: ReactNode;
    className?: string;
    onClose: () => void;
    children: ReactNode;
  }) => {
    mocks.frameOnClose = onClose;
    return (
      <section data-size={className}>
        <span>{title}</span>
        {children}
      </section>
    );
  },
}));

import { ProductionPopupShell } from "./production-popup-shell";

describe("ProductionPopupShell", () => {
  afterEach(() => {
    mocks.closeSurface.mockReset();
    mocks.frameOnClose = null;
  });

  it("renders Production through the surface frame at panel size", () => {
    const html = renderToStaticMarkup(
      <ProductionPopupShell onClose={vi.fn()}>
        <div>Production body content</div>
      </ProductionPopupShell>,
    );

    expect(html).toContain("w-[1320px]");
    expect(html).toContain("Production");
    expect(html).toContain("Production body content");
  });

  it("invokes the provided onClose from the frame", () => {
    const onClose = vi.fn();
    renderToStaticMarkup(
      <ProductionPopupShell onClose={onClose}>
        <div>Closable content</div>
      </ProductionPopupShell>,
    );

    mocks.frameOnClose?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes the surface when no onClose is provided", () => {
    renderToStaticMarkup(
      <ProductionPopupShell>
        <div>Closable content</div>
      </ProductionPopupShell>,
    );

    mocks.frameOnClose?.();
    expect(mocks.closeSurface).toHaveBeenCalledTimes(1);
  });
});
