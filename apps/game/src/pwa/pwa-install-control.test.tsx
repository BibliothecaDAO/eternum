import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

/** The app the client runs in; the web unless a test is about a store app. */
const app = vi.hoisted(() => ({ channel: "web" as "web" | "play" | "app-store" }));
vi.mock("@/runtime/distribution-channel", () => ({ distributionChannel: () => app.channel }));

import { useInstallState } from "./install-state";
import { AppSettings } from "@/ui/modules/settings/app-settings";

import { PwaInstallRuntime } from "./pwa-install-control";

afterEach(() => {
  vi.unstubAllGlobals();
  app.channel = "web";
  useInstallState.setState({ prompt: null, installed: false, steps: false });
});
const installButton = (container: HTMLElement) =>
  [...container.querySelectorAll("button")].find((button) => button.textContent === "Install");
async function mount(visible = true) {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"),
    root = createRoot(container);
  const render = (show: boolean) =>
    act(async () =>
      root.render(
        <>
          <PwaInstallRuntime />
          {show && <AppSettings onShowKeys={() => undefined} />}
        </>,
      ),
    );
  await render(visible);
  return {
    container,
    render,
    click: () => act(async () => installButton(container)!.click()),
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
    expect(installButton(ui.container)).toBeUndefined();
  } finally {
    await ui.close();
  }
});

it.each(["play", "app-store"] as const)(
  "offers no install inside the %s app, even when the browser would",
  async (channel) => {
    app.channel = channel;
    const ui = await mount();
    try {
      await act(async () => {
        window.dispatchEvent(
          Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
            prompt: vi.fn(),
            userChoice: Promise.resolve({ outcome: "accepted" }),
          }),
        );
      });
      expect(installButton(ui.container)).toBeUndefined();
    } finally {
      await ui.close();
    }
  },
);
