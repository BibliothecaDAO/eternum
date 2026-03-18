import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FactoryV2ModeSwitch } from "./factory-v2-mode-switch";
import { FactoryV2WorkflowSwitch } from "./factory-v2-workflow-switch";

vi.mock("@/ui/design-system/atoms/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("../mode-appearance", () => ({
  resolveFactoryModeAppearance: vi.fn(() => ({
    activeToggleClassName: "active",
    inactiveToggleClassName: "inactive",
  })),
}));

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("Factory V2 mobile switches", () => {
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
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("renders full-width network and game switches on mobile", async () => {
    await act(async () => {
      root.render(
        <FactoryV2ModeSwitch
          modes={[
            { id: "eternum", label: "Eternum", strapline: "", description: "", accentClassName: "", focusLabel: "", stepPrinciples: [] },
            { id: "blitz", label: "Blitz", strapline: "", description: "", accentClassName: "", focusLabel: "", stepPrinciples: [] },
          ]}
          selectedMode="eternum"
          environmentOptions={[
            { id: "slot", label: "Slot", mode: "eternum", chain: "slot" },
            { id: "mainnet", label: "Mainnet", mode: "eternum", chain: "mainnet" },
          ]}
          selectedEnvironmentId="slot"
          onSelectEnvironment={vi.fn()}
          onSelectMode={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const networkSwitch = container.querySelector('[data-testid="factory-network-switch"]');
    const gameSwitch = container.querySelector('[data-testid="factory-game-switch"]');

    expect(networkSwitch?.className).toContain("w-full");
    expect(networkSwitch?.className).toContain("md:max-w-[18rem]");
    expect(gameSwitch?.className).toContain("w-full");
    expect(gameSwitch?.className).toContain("md:max-w-[18rem]");
  });

  it("renders a full-width workflow switch on mobile", async () => {
    await act(async () => {
      root.render(<FactoryV2WorkflowSwitch mode="blitz" selectedView="start" canWatch onSelect={vi.fn()} />);
      await waitForAsyncWork();
    });

    const workflowSwitch = container.querySelector('[data-testid="factory-workflow-switch"]');

    expect(workflowSwitch?.className).toContain("w-full");
    expect(workflowSwitch?.className).toContain("md:max-w-[20rem]");
  });
});
