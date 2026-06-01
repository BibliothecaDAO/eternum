import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GameToastContent } from "./game-toast";

const waitForRender = async () => {
  await Promise.resolve();
};

const renderContent = async (content: ReactNode) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<GameToastContent content={content} />);
    await waitForRender();
  });

  return { container, root };
};

describe("GameToastContent", () => {
  let roots: Root[] = [];
  let containers: HTMLDivElement[] = [];

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    roots = [];
    containers = [];
  });

  afterEach(async () => {
    await act(async () => {
      roots.forEach((root) => root.unmount());
      await waitForRender();
    });
    containers.forEach((container) => container.remove());
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  const mount = async (content: ReactNode) => {
    const rendered = await renderContent(content);
    roots.push(rendered.root);
    containers.push(rendered.container);
    return rendered.container;
  };

  it("renders resource amounts as compact icon chips", async () => {
    const container = await mount("Moved 6,030 Coal, 12 Cold Iron, and 1 Ancient Fragment.");

    expect(container.textContent).toContain("Moved");
    expect(container.textContent).toContain("6,030 Coal");
    expect(container.querySelector('[data-game-toast-resource="Coal"]')).not.toBeNull();
    expect(container.querySelector('[data-game-toast-resource="Cold Iron"]')).not.toBeNull();
    expect(container.querySelector('[data-game-toast-resource="Ancient Fragment"]')).not.toBeNull();
  });

  it("keeps icons for longer multi-word resource labels", async () => {
    const container = await mount("Found 1 Damage Reduction Relic 1.");
    const chip = container.querySelector('[data-game-toast-resource="Damage Reduction Relic 1"]');

    expect(chip).not.toBeNull();
    expect(chip?.querySelector("img")).not.toBeNull();
  });

  it("leaves unknown labels as plain text", async () => {
    const container = await mount("Mystery Ore arrived.");

    expect(container.textContent).toBe("Mystery Ore arrived.");
    expect(container.querySelector("[data-game-toast-resource]")).toBeNull();
    expect(container.querySelector("[data-game-toast-thing]")).toBeNull();
  });

  it("renders known game objects as icon chips", async () => {
    const container = await mount("Hyperstructure Quest Market updated.");

    expect(container.querySelector('[data-game-toast-thing="Hyperstructure"]')).not.toBeNull();
    expect(container.querySelector('[data-game-toast-thing="Quest"]')).not.toBeNull();
    expect(container.querySelector('[data-game-toast-thing="Market"]')).not.toBeNull();
  });
});
