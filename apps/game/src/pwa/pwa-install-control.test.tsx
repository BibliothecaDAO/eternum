import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const app = vi.hoisted(() => ({ channel: "web" as "web" | "play" | "app-store" }));
vi.mock("@/runtime/distribution-channel", () => ({ distributionChannel: () => app.channel }));

import { useInstallState } from "./install-state";

import { InstallButton, PwaInstallRuntime } from "./pwa-install-control";

const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

afterEach(() => {
  vi.unstubAllGlobals();
  app.channel = "web";
  useInstallState.setState({ prompt: null, installed: false, steps: false });
  document.body.replaceChildren();
});

const installIcon = () => document.querySelector<HTMLButtonElement>('button[aria-label="Install"]');

const promptEvent = (prompt = vi.fn().mockResolvedValue(undefined)) =>
  Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });

async function mount(userAgent = FIREFOX) {
  vi.stubGlobal("navigator", { ...navigator, userAgent, platform: "Linux x86_64", maxTouchPoints: 0 });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <>
        <PwaInstallRuntime />
        <InstallButton />
      </>,
    ),
  );
  return { close: () => act(async () => root.unmount()) };
}

it("shows the install icon once the browser offers its prompt, opens it on a press, and goes once installed", async () => {
  const ui = await mount();
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = promptEvent(prompt);
  try {
    expect(installIcon()).toBeNull();
    await act(async () => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    await act(async () => installIcon()!.click());
    expect(prompt).toHaveBeenCalledOnce();
    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(installIcon()).toBeNull();
  } finally {
    await ui.close();
  }
});

it("shows the install icon on Safari, which has no prompt, and opens its steps", async () => {
  const ui = await mount(IPHONE_SAFARI);
  try {
    await act(async () => installIcon()!.click());
    expect([...document.querySelectorAll("li")].map((step) => step.textContent)).toEqual([
      "1Share",
      "2Add to Home Screen",
      "3Add",
    ]);
  } finally {
    await ui.close();
  }
});

it("shows no install icon where the browser cannot install the app", async () => {
  const ui = await mount();
  try {
    expect(installIcon()).toBeNull();
  } finally {
    await ui.close();
  }
});

it.each(["play", "app-store"] as const)(
  "shows no install icon inside the %s app, even when the browser would offer one",
  async (channel) => {
    app.channel = channel;
    const ui = await mount();
    try {
      await act(async () => {
        window.dispatchEvent(promptEvent());
      });
      expect(installIcon()).toBeNull();
    } finally {
      await ui.close();
    }
  },
);
