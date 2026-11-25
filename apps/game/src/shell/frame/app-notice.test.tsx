import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { useAppNotice } from "./app-notice";

const Host = (): ReactNode => useAppNotice();

const render = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<Host />));
  return { container, unmount: () => act(async () => root.unmount()) };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows Offline with Try again when the connection drops, before anything else", async () => {
  vi.stubGlobal("navigator", { ...navigator, onLine: false });
  const ui = await render();
  try {
    expect(ui.container.textContent).toBe("OfflineTry again");
  } finally {
    await ui.unmount();
  }
});
