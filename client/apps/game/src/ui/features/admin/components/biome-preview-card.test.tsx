import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BiomePreviewCard } from "./biome-preview-card";

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("BiomePreviewCard", () => {
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

  test("renders seed controls and preview actions", async () => {
    const onChange = vi.fn();
    const onRandomizeSeeds = vi.fn();
    const onReset = vi.fn();

    await act(async () => {
      root.render(
        <BiomePreviewCard
          baseClimate={{
            elevationScaleBps: 10000,
            moistureScaleBps: 10000,
            elevationBiasBps: 10000,
            moistureBiasBps: 10000,
            elevationSeed: 0,
            moistureSeed: 0,
          }}
          overrides={{
            elevationSeed: "137",
            moistureSeed: "991",
          }}
          onChange={onChange}
          onRandomizeSeeds={onRandomizeSeeds}
          onReset={onReset}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Biome Preview");
    expect(container.textContent).toContain("Elevation Seed");
    expect(container.textContent).toContain("Moisture Seed");

    const elevationSeedInput = Array.from(container.querySelectorAll("input")).find(
      (input) => input.value === "137",
    ) as HTMLInputElement;
    expect(elevationSeedInput).toBeDefined();

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(elevationSeedInput, "138");
      elevationSeedInput.dispatchEvent(new Event("input", { bubbles: true }));
      await waitForAsyncWork();
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Randomize Seeds"))
        ?.click();
      await waitForAsyncWork();
    });

    expect(onChange).toHaveBeenCalledWith("elevationSeed", "138");
    expect(onRandomizeSeeds).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();
  });

  test("renders preview tiles in contract coordinate space", async () => {
    await act(async () => {
      root.render(
        <BiomePreviewCard
          baseClimate={{
            elevationScaleBps: 10000,
            moistureScaleBps: 10000,
            elevationBiasBps: 10000,
            moistureBiasBps: 10000,
            elevationSeed: 0,
            moistureSeed: 0,
          }}
          overrides={{}}
          onChange={vi.fn()}
          onRandomizeSeeds={vi.fn()}
          onReset={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const tileTitles = Array.from(container.querySelectorAll<HTMLElement>("[title]")).map(
      (element) => element.title,
    );

    expect(tileTitles.some((title) => title.includes("(-"))).toBe(false);
  });
});
