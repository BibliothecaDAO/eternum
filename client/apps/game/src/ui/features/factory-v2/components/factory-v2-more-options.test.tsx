import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFactoryMoreOptionsDraft,
  getFactoryMoreOptionSections,
  validateFactoryMoreOptions,
} from "../map-options";
import { FactoryV2MoreOptions } from "./factory-v2-more-options";

vi.mock("@/ui/design-system/atoms/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const buildProps = (overrides: Record<string, unknown> = {}) => {
  const draft = createFactoryMoreOptionsDraft("eternum", "slot");

  return {
    mode: "eternum" as const,
    isOpen: true,
    sections: getFactoryMoreOptionSections("eternum"),
    draft,
    errors: validateFactoryMoreOptions("eternum", "slot", draft).errors,
    invalidReason: null,
    onToggle: vi.fn(),
    onValueChange: vi.fn(),
    ...overrides,
  };
};

describe("FactoryV2MoreOptions", () => {
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

  it("shows compact percentage guidance and expands the first section by default", async () => {
    await act(async () => {
      root.render(<FactoryV2MoreOptions {...buildProps()} />);
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Chance fields use percentages");
    expect(container.textContent).toContain("Shard Mine chance");
    expect(container.textContent).not.toContain("Center chance");
    expect(container.textContent).toContain("%");
  });

  it("reveals collapsed section fields when an inner section is opened", async () => {
    await act(async () => {
      root.render(<FactoryV2MoreOptions {...buildProps()} />);
      await waitForAsyncWork();
    });

    const hyperstructureButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Hyperstructures"),
    );

    await act(async () => {
      (hyperstructureButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Center chance");
    expect(container.textContent).toContain("Radius multiplier");
  });

  it("shows user-friendly minute guidance in blitz relic options", async () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "slot");

    await act(async () => {
      root.render(
        <FactoryV2MoreOptions
          {...buildProps({
            mode: "blitz",
            sections: getFactoryMoreOptionSections("blitz", { twoPlayerMode: false }),
            draft,
            errors: validateFactoryMoreOptions("blitz", "slot", draft, { twoPlayerMode: false }).errors,
          })}
        />,
      );
      await waitForAsyncWork();
    });

    const relicButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Relics"),
    );

    await act(async () => {
      (relicButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Relic discovery interval");
    expect(container.textContent).toContain("Minutes between relic discovery checks.");
    expect(container.textContent).toContain("min");
  });

  it("shows the blitz prize section with token and amount fields", async () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "slot");

    await act(async () => {
      root.render(
        <FactoryV2MoreOptions
          {...buildProps({
            mode: "blitz",
            sections: getFactoryMoreOptionSections("blitz", { twoPlayerMode: false }),
            draft,
            errors: validateFactoryMoreOptions("blitz", "slot", draft, { twoPlayerMode: false }).errors,
          })}
        />,
      );
      await waitForAsyncWork();
    });

    const prizeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Prize") && button.textContent?.includes("Token and amount"),
    );

    await act(async () => {
      (prizeButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Prize token address");
    expect(container.textContent).toContain("Prize amount");
    expect(container.textContent).toContain("Token decimals");
  });

  it("keeps Blitz player-cap controls out of the advanced drawer", async () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "slot");

    await act(async () => {
      root.render(
        <FactoryV2MoreOptions
          {...buildProps({
            mode: "blitz",
            sections: getFactoryMoreOptionSections("blitz", { twoPlayerMode: false }),
            draft,
            errors: validateFactoryMoreOptions("blitz", "slot", draft, { twoPlayerMode: false }).errors,
          })}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).not.toContain("Players");
    expect(container.textContent).not.toContain("Max players");
  });

  it("keeps an opened section expanded while editing a field", async () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "slot");
    const sections = getFactoryMoreOptionSections("blitz", { twoPlayerMode: false });

    await act(async () => {
      root.render(
        <FactoryV2MoreOptions
          {...buildProps({
            mode: "blitz",
            sections,
            draft,
            errors: validateFactoryMoreOptions("blitz", "slot", draft, { twoPlayerMode: false }).errors,
          })}
        />,
      );
      await waitForAsyncWork();
    });

    const relicButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Relics"),
    );

    await act(async () => {
      (relicButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Relic discovery interval");

    const updatedDraft = {
      ...draft,
      relicDiscoveryInterval: "12",
    };

    await act(async () => {
      root.render(
        <FactoryV2MoreOptions
          {...buildProps({
            mode: "blitz",
            sections: getFactoryMoreOptionSections("blitz", { twoPlayerMode: false }),
            draft: updatedDraft,
            errors: validateFactoryMoreOptions("blitz", "slot", updatedDraft, { twoPlayerMode: false }).errors,
          })}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Relic discovery interval");
  });

  it("hides advanced sections that no longer have visible fields", async () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "slot");

    await act(async () => {
      root.render(
        <FactoryV2MoreOptions
          {...buildProps({
            mode: "blitz",
            sections: getFactoryMoreOptionSections("blitz", { twoPlayerMode: true }),
            draft,
            errors: validateFactoryMoreOptions("blitz", "slot", draft, { twoPlayerMode: true }).errors,
          })}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).not.toContain("Players");
  });
});
