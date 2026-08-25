// @vitest-environment node

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toggleModal: vi.fn(),
  shellTitle: null as ReactNode,
  shellSize: null as string | null,
  shellOnClose: null as null | (() => void),
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (selector: (state: { toggleModal: typeof mocks.toggleModal }) => unknown) =>
    selector({ toggleModal: mocks.toggleModal }),
}));

// Production renders through the shared CenteredModalShell (draggable, no
// backdrop, xl size). Mock the shell so this stays a focused adapter test.
vi.mock("@/ui/features/world/containers/centered-modal-shell", () => ({
  CenteredModalShell: ({
    title,
    size,
    onClose,
    children,
  }: {
    title: ReactNode;
    size?: string;
    onClose?: () => void;
    children: ReactNode;
  }) => {
    mocks.shellTitle = title;
    mocks.shellSize = size ?? null;
    mocks.shellOnClose = onClose ?? null;
    return (
      <section data-size={size}>
        <span>{title}</span>
        {children}
      </section>
    );
  },
}));

import { ProductionPopupShell } from "./production-popup-shell";

describe("ProductionPopupShell", () => {
  afterEach(() => {
    mocks.toggleModal.mockReset();
    mocks.shellTitle = null;
    mocks.shellSize = null;
    mocks.shellOnClose = null;
    vi.clearAllMocks();
  });

  it("renders Production through the shared shell at xl size", () => {
    const html = renderToStaticMarkup(
      <ProductionPopupShell onClose={vi.fn()}>
        <div>Production body content</div>
      </ProductionPopupShell>,
    );

    expect(html).toContain('data-size="xl"');
    expect(html).toContain("Production");
    expect(html).toContain("Production body content");
    expect(mocks.shellSize).toBe("xl");
  });

  it("invokes the provided onClose from the shell", () => {
    const onClose = vi.fn();

    renderToStaticMarkup(
      <ProductionPopupShell onClose={onClose}>
        <div>Closable content</div>
      </ProductionPopupShell>,
    );

    expect(mocks.shellOnClose).not.toBeNull();
    mocks.shellOnClose?.();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("falls back to toggleModal(null) when no onClose is provided", () => {
    renderToStaticMarkup(
      <ProductionPopupShell>
        <div>Closable content</div>
      </ProductionPopupShell>,
    );

    expect(mocks.shellOnClose).not.toBeNull();
    mocks.shellOnClose?.();

    expect(mocks.toggleModal).toHaveBeenCalledWith(null);
  });
});
