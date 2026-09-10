import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GraphicsLabView } from "./graphics-lab-view";

vi.mock("./procedural-terrain-debug-view", () => ({
  ProceduralTerrainDebugView: () => <canvas data-tool="terrain" />,
}));
vi.mock("./model-lab-view", () => ({ ModelLabView: ModelTool }));
vi.mock("./reward-lab-view", () => ({ RewardLabView: () => <canvas data-tool="rewards" /> }));

function ModelTool() {
  const [params, setParams] = useSearchParams();
  return (
    <button data-tool="models" onClick={() => setParams({ army: "paladin" })}>
      {params.get("army")}
    </button>
  );
}

describe("graphics lab workspace", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function open(path: string) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/lab/*" element={<GraphicsLabView />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  async function clickTool(label: string) {
    const link = Array.from(container.querySelectorAll<HTMLAnchorElement>("nav a")).find(
      (link) => link.textContent === label,
    )!;
    await act(async () => link.click());
  }

  it("switches tools in one shell, unmounts the old scene and remembers each setup", async () => {
    await open("/lab?layout=settlement&radius=3");
    const header = container.querySelector("header");
    await clickTool("Models & motion");
    expect(container.querySelector('[data-tool="terrain"]')).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>("button[data-tool]")!.click());
    await clickTool("Rewards");
    expect(container.querySelectorAll("[data-tool]")).toHaveLength(1);
    await clickTool("Models & motion");
    expect(container.querySelector("[data-tool]")?.textContent).toBe("paladin");
    await clickTool("Terrain & buildings");
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe(
      "/lab?layout=settlement&radius=3",
    );
    expect(container.querySelector("header")).toBe(header);
    expect(container.querySelectorAll("nav a")).toHaveLength(3);
  });

  it("keeps capture views free of lab chrome", async () => {
    await open("/lab?capture=1");
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector('[data-tool="terrain"]')).not.toBeNull();
  });

  it("returns retired tool URLs to terrain", async () => {
    await open("/lab/interface");
    expect(container.querySelector('[data-tool="terrain"]')).not.toBeNull();
    expect(container.textContent).not.toContain("HUD & interface");
  });
});
