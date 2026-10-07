import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { type ProductionLine, ProductionSheet } from "./production-sheet";

const line = (overrides: Partial<ProductionLine> & Pick<ProductionLine, "icon" | "spentAt">): ProductionLine => ({
  perHour: 500,
  held: 9_640,
  limit: 18_000,
  tone: "calm",
  fullIn: 16 * 3_600 + 44 * 60,
  noBuilding: false,
  ...overrides,
});

describe("Production", () => {
  it("shows each store's rate, what it holds against its limit and when it is full, a Full store's way out, and Build", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onSpend = vi.fn();
    const onBuild = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <ProductionSheet
          lines={[
            line({ icon: "Wh", spentAt: "deploy" }),
            line({ icon: "La", spentAt: "realm", held: 18_000, tone: "ember" }),
            line({ icon: "Tr", spentAt: "deploy", perHour: 0, noBuilding: true, fullIn: undefined }),
          ]}
          onSpend={onSpend}
          onBuild={onBuild}
          onClose={() => {}}
        />,
      ),
    );
    const rows = [...host.querySelectorAll("section[aria-label='Production'] > div > div")];
    expect(rows[0].textContent).toBe("+500/h9,640 / 18,000Full in16h 44m");
    expect(rows[1].textContent).toBe("+0/h18,000 / 18,000FullRealm");
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Realm")!.click());
    expect(onSpend).toHaveBeenCalledWith("realm");
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Build")!.click());
    expect(onBuild).toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });
});
