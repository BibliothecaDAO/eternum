import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SeasonPassOptionCard } from "./season-pass-option-card";

vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/ui/design-system/molecules/resource-icon", () => ({
  ResourceIcon: ({ resource }: { resource: string }) => <span>{resource}</span>,
}));

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("SeasonPassOptionCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await waitForAsyncWork();
    });

    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("shows realm metadata so players can choose between season passes", async () => {
    const onSelect = vi.fn();

    await act(async () => {
      root.render(
        <SeasonPassOptionCard
          pass={{
            tokenId: 7n,
            realmId: 7,
            realmName: "Ayla",
            resourceIds: [1, 3],
          }}
          isSelected={false}
          onSelect={onSelect}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Ayla");
    expect(container.textContent).toContain("Realm #7");
    expect(container.textContent).toContain("Stone");
    expect(container.textContent).toContain("Wood");

    await act(async () => {
      container.querySelector("button")?.click();
      await waitForAsyncWork();
    });

    expect(onSelect).toHaveBeenCalledWith(7n);
  });
});
