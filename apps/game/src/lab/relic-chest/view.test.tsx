import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { RelicChestLab } from "./view";

const renderer = vi.hoisted(() => ({ mount: vi.fn(), open: vi.fn(), reset: vi.fn(), dispose: vi.fn() }));
vi.mock("./scene", () => ({ mountChestProof: renderer.mount }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

async function mount() {
  renderer.mount.mockImplementation(async (container: HTMLElement, _signal: AbortSignal, focus: () => void) => {
    const button = document.createElement("button");
    button.textContent = "Focus chest";
    button.onclick = focus;
    container.append(button);
    return { open: renderer.open, reset: renderer.reset, dispose: renderer.dispose };
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<RelicChestLab />));
}
async function click(text: string, within: Element = host) {
  const button = [...within.querySelectorAll("button")].find((button) => button.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
const rewards = () => [...host.querySelectorAll('[aria-label="Relics"] li')].map((li) => li.textContent);

it("focuses a sealed crate, then sends Open through the caller and displays the native opening story's exact receipt", async () => {
  await mount();
  await click("Focus chest");
  expect(rewards()).toEqual([]);
  expect(host.textContent).toContain("Three relics. Open to reveal them.");
  await click("Open");
  expect(renderer.open).toHaveBeenCalledWith(expect.objectContaining({ kind: "relics", relics: [41, 43, 39] }));
  expect(rewards()).toEqual(["Damage Relic I", "Damage Reduction Relic I", "Stamina Relic I"]);
  expect(host.textContent).toContain("Crate opened");
  await click("Reset chest");
  await click("Focus chest");
  expect(rewards()).toEqual([]);
  await click("Close 3D proof");
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
});

it("releases a renderer that finishes loading after the comparison was closed", async () => {
  let finish!: (value: {
    open: typeof renderer.open;
    reset: typeof renderer.reset;
    dispose: typeof renderer.dispose;
  }) => void;
  renderer.mount.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<RelicChestLab />));
  await click("Close 3D proof");
  await act(async () => finish({ open: renderer.open, reset: renderer.reset, dispose: renderer.dispose }));
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[aria-label="Production relic chest on native terrain"]')).toBeNull();
  expect(host.querySelector("[data-relic-chest-lab]")?.getAttribute("data-ready")).toBe("false");
});

it("focuses and opens a funded Frontier chest, then records zero after rollover without inventing relics", async () => {
  window.history.replaceState({}, "", "/lab/relic-chest?mode=frontier");
  await mount();
  await click("Focus chest");
  expect(host.textContent).toContain("17 LORDS");
  expect(rewards()).toEqual([]);
  const later = performance.now() + 90000;
  vi.spyOn(performance, "now").mockReturnValue(later);
  await act(async () => useChainTimeStore.getState().tick());
  expect(host.textContent).toContain("17 LORDS");
  expect(host.textContent).not.toContain("Expired");
  await click("Open");
  expect(renderer.open).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "lords", amount: 17 }));
  expect(host.textContent).toContain("17 LORDS paid to the army's realm");
  await click("Reset chest");
  await click("Advance to day rollover");
  await click("Focus chest");
  expect(host.textContent).toContain("Expired");
  await click("Open");
  expect(renderer.open).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "lords", amount: 0 }));
  expect(host.textContent).toContain("No LORDS paid");
  expect(rewards()).toEqual([]);
});
