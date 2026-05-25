// @vitest-environment node

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toggleModal: vi.fn(),
  headOnClose: null as null | (() => void),
  bodyHeight: null as null | string,
  bodyWidth: null as null | string,
  bodyClassName: null as null | string,
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (selector: (state: { toggleModal: typeof mocks.toggleModal }) => unknown) =>
    selector({ toggleModal: mocks.toggleModal }),
}));

vi.mock("@/ui/design-system/molecules/secondary-popup", () => {
  const SecondaryPopup = ({
    children,
    width,
    name,
    className,
    containerClassName,
  }: {
    children: ReactNode;
    width?: string;
    name?: string;
    className?: string;
    containerClassName?: string;
  }) => (
    <section
      data-width={width}
      data-name={name}
      data-class-name={className}
      data-container-class-name={containerClassName}
    >
      {children}
    </section>
  );

  SecondaryPopup.Head = ({ children, onClose }: { children: ReactNode; onClose?: () => void }) => {
    mocks.headOnClose = onClose ?? null;
    return <button onClick={onClose}>{children}</button>;
  };

  SecondaryPopup.Body = ({
    children,
    height,
    width,
    className,
  }: {
    children: ReactNode;
    height?: string;
    width?: string;
    className?: string;
  }) => {
    mocks.bodyHeight = height ?? null;
    mocks.bodyWidth = width ?? null;
    mocks.bodyClassName = className ?? null;
    return <div>{children}</div>;
  };

  return { SecondaryPopup };
});

import { ProductionPopupShell } from "./production-popup-shell";

describe("ProductionPopupShell", () => {
  afterEach(() => {
    mocks.toggleModal.mockReset();
    mocks.headOnClose = null;
    mocks.bodyHeight = null;
    mocks.bodyWidth = null;
    mocks.bodyClassName = null;
    vi.clearAllMocks();
  });

  it("renders the production header and children", () => {
    const html = renderToStaticMarkup(
      <ProductionPopupShell onClose={vi.fn()}>
        <div>Production body content</div>
      </ProductionPopupShell>,
    );

    expect(html).toContain('data-width="min(1320px, calc(100vw - 48px))"');
    expect(html).toContain("Production");
    expect(html).toContain("Production body content");
    expect(mocks.bodyWidth).toBe("100%");
    expect(mocks.bodyHeight).toBe("calc(100vh - 48px)");
    expect(mocks.bodyClassName).toBe("p-4");
  });

  it("invokes onClose from the header close button", () => {
    const onClose = vi.fn();

    renderToStaticMarkup(
      <ProductionPopupShell onClose={onClose}>
        <div>Closable content</div>
      </ProductionPopupShell>,
    );

    expect(mocks.headOnClose).not.toBeNull();
    mocks.headOnClose?.();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
