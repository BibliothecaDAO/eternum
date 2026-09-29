import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PwaInstallControl, PwaInstallRuntime } from "./pwa-install-control";

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
