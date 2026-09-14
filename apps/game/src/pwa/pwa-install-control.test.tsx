import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PwaInstallControl, PwaInstallRuntime } from "./pwa-install-control";
import { pwaInstallInstructions } from "./browser-capabilities";

afterEach(() => vi.unstubAllGlobals());
async function mount(visible = true) {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"),
    root = createRoot(container);
  const render = (show: boolean) =>
    act(async () =>
      root.render(
        <>
          <PwaInstallRuntime />
          {show && <PwaInstallControl />}
        </>,
      ),
    );
  await render(visible);
  return {
    container,
    render,
    click: () => act(async () => container.querySelector("button")!.click()),
    close: () => act(async () => root.unmount()),
  };
}

it("captures an install prompt before the control mounts and opens it only on a click", async () => {
  const ui = await mount(false);
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });
  try {
    await act(async () => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    await ui.render(true);
    await ui.click();
    expect(prompt).toHaveBeenCalledOnce();
    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(ui.container.querySelector("button")).toBeNull();
  } finally {
    await ui.close();
  }
});

it("shows Safari instructions without attempting a native prompt", async () => {
  vi.stubGlobal("navigator", { userAgent: "iPhone Safari", platform: "iPhone", maxTouchPoints: 5 });
  const ui = await mount();
  try {
    await ui.click();
    expect(ui.container.textContent).toContain("Share");
    expect(ui.container.textContent).toContain("Add to Home Screen");
    expect(ui.container.querySelector("button")?.getAttribute("aria-expanded")).toBe("true");
  } finally {
    await ui.close();
  }
});

it("hides install controls inside the installed app", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const ui = await mount();
  try {
    expect(ui.container.querySelector("button")).toBeNull();
  } finally {
    await ui.close();
  }
});

it("falls back to browser instructions when a saved prompt expires", async () => {
  const ui = await mount();
  const prompt = vi.fn().mockRejectedValue(new Error("expired"));
  try {
    await act(async () => {
      window.dispatchEvent(
        Object.assign(new Event("beforeinstallprompt"), {
          prompt,
          userChoice: Promise.resolve({ outcome: "dismissed" }),
        }),
      );
    });
    await ui.click();
    expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain("browser menu");
    await ui.click();
    expect(prompt).toHaveBeenCalledOnce();
  } finally {
    await ui.close();
  }
});

it("provides Android, iPad desktop-mode, and Mac Safari instructions", () => {
  vi.stubGlobal("navigator", { userAgent: "Android Chrome", platform: "Linux" });
  expect(pwaInstallInstructions()).toContain("Add to Home screen");
  vi.stubGlobal("navigator", { userAgent: "Mac Safari", platform: "MacIntel", maxTouchPoints: 5 });
  expect(pwaInstallInstructions()).toContain("Share");
  vi.stubGlobal("navigator", { userAgent: "Mac Safari", platform: "MacIntel", maxTouchPoints: 0 });
  expect(pwaInstallInstructions()).toContain("Add to Dock");
});
