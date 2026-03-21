import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveFactoryManifestContractAddress } from "../developer/resolve-factory-manifest-contract-address";
import { FactoryV2DeveloperTools } from "./factory-v2-developer-tools";

const clipboardWriteText = vi.fn();

vi.mock("@/ui/design-system/atoms/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("../mode-appearance", () => ({
  resolveFactoryModeAppearance: vi.fn(() => ({
    featureSurfaceClassName: "",
    quietSurfaceClassName: "",
    primaryButtonClassName: "",
    secondaryButtonClassName: "",
    listItemClassName: "",
  })),
}));

vi.mock("../developer/resolve-factory-manifest-contract-address", () => ({
  resolveFactoryManifestContractAddress: vi.fn(),
}));

vi.mock("./factory-v2-developer-config", () => ({
  FactoryV2DeveloperConfig: () => <div>Factory config panel</div>,
}));

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("FactoryV2DeveloperTools", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    localStorage.clear();
    clipboardWriteText.mockReset();
    vi.mocked(resolveFactoryManifestContractAddress).mockReset();

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

  async function renderDeveloperTools() {
    await act(async () => {
      root.render(
        <FactoryV2DeveloperTools
          mode="blitz"
          chain="slot"
          environmentLabel="Slot"
          draftGameName="etrn-sunrise-01"
          selectedRunName={null}
        />,
      );
      await waitForAsyncWork();
    });
  }

  async function unlockDeveloperTools() {
    const revealButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("fv2/dev"),
    ) as HTMLButtonElement;

    await act(async () => {
      for (let index = 0; index < 5; index += 1) {
        revealButton.click();
      }
      await waitForAsyncWork();
    });
  }

  it("stays hidden by default and reveals after the secret footer gesture", async () => {
    await renderDeveloperTools();

    expect(container.textContent).not.toContain("Developer tools");

    await unlockDeveloperTools();

    expect(container.textContent).toContain("Developer tools");
    expect(container.textContent).toContain("Factory config panel");
    expect(localStorage.getItem("factory-v2-developer-tools-visible")).toBe("true");
  });

  it("restores visibility from local storage", async () => {
    localStorage.setItem("factory-v2-developer-tools-visible", "true");

    await renderDeveloperTools();

    expect(container.textContent).toContain("Developer tools");
  });

  it("defaults to Prize address and reveals the custom input only when selected", async () => {
    await renderDeveloperTools();
    await unlockDeveloperTools();

    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("prize-address");
    expect(container.textContent).not.toContain("Manifest contract");

    await act(async () => {
      select.value = "custom";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Manifest contract");
  });

  it("shows the resolved address and supports copy", async () => {
    vi.mocked(resolveFactoryManifestContractAddress).mockResolvedValue({
      kind: "success",
      worldName: "etrn-sunrise-01",
      resolvedTag: "s1_eternum-prize_distribution_systems",
      worldAddress: "0x111",
      contractAddress: "0xabc",
    });

    await renderDeveloperTools();
    await unlockDeveloperTools();

    const resolveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Resolve address"),
    ) as HTMLButtonElement;

    await act(async () => {
      resolveButton.click();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("0xabc");
    expect(container.textContent).toContain("Prize address");

    const copyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy address"),
    ) as HTMLButtonElement;

    await act(async () => {
      copyButton.click();
      await waitForAsyncWork();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith("0xabc");
  });

  it("reruns lookup when a suggestion is selected", async () => {
    vi.mocked(resolveFactoryManifestContractAddress)
      .mockResolvedValueOnce({
        kind: "failure",
        code: "world_not_found",
        message: 'No Factory world named "etrn" was found on the selected chain.',
        worldSuggestions: ["etrn-sunrise-01"],
      })
      .mockResolvedValueOnce({
        kind: "success",
        worldName: "etrn-sunrise-01",
        resolvedTag: "s1_eternum-prize_distribution_systems",
        worldAddress: "0x111",
        contractAddress: "0xabc",
      });

    await renderDeveloperTools();
    await unlockDeveloperTools();

    const gameNameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      gameNameInput.value = "etrn";
      gameNameInput.dispatchEvent(new Event("input", { bubbles: true }));
      await waitForAsyncWork();
    });

    const resolveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Resolve address"),
    ) as HTMLButtonElement;

    await act(async () => {
      resolveButton.click();
      await waitForAsyncWork();
    });

    const suggestionButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("etrn-sunrise-01"),
    ) as HTMLButtonElement;

    await act(async () => {
      suggestionButton.click();
      await waitForAsyncWork();
    });

    expect(vi.mocked(resolveFactoryManifestContractAddress)).toHaveBeenNthCalledWith(2, {
      chain: "slot",
      worldName: "etrn-sunrise-01",
      manifestContractName: "s1_eternum-prize_distribution_systems",
    });
    expect(container.textContent).toContain("0xabc");
  });
});
