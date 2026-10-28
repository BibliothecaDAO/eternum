import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: null as object | null }));
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ session: session.current }) }));

import { useAppNotice } from "./app-notice";

const Host = ({ offersInstall }: { offersInstall: boolean }): ReactNode => useAppNotice({ offersInstall });

const render = async (offersInstall = true) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<Host offersInstall={offersInstall} />));
  return { container, unmount: () => act(async () => root.unmount()) };
};

afterEach(() => {
  vi.unstubAllGlobals();
  session.current = null;
  localStorage.clear();
});

it("shows Offline with Try again when the connection drops, before anything else", async () => {
  vi.stubGlobal("navigator", { ...navigator, onLine: false });
  session.current = { user: {} };
  const ui = await render();
  try {
    expect(ui.container.textContent).toBe("OfflineTry again");
  } finally {
    await ui.unmount();
  }
});

it("offers Install to a player with an account, never to a first visit, and Later puts it off", async () => {
  const anonymous = await render();
  expect(anonymous.container.textContent).toBe("");
  await anonymous.unmount();
  session.current = { user: {} };
  const ui = await render();
  try {
    // Its icon and Install say it on screen: no line to wrap above a phone's tabs or crowd a desktop's bar (audit
    // 10-27, 18), only its name for assistive technology.
    expect(ui.container.textContent).toBe("LaterInstall");
    expect(ui.container.querySelector('[role="status"]')!.getAttribute("aria-label")).toBe(
      "Realms on your home screen",
    );
    const later = [...ui.container.querySelectorAll("button")].find((button) => button.textContent === "Later")!;
    await act(async () => later.click());
    expect(ui.container.textContent).toBe("");
  } finally {
    await ui.unmount();
  }
});

it("offers Install on Play only: another page keeps its room", async () => {
  session.current = { user: {} };
  const ui = await render(false);
  try {
    expect(ui.container.textContent).toBe("");
  } finally {
    await ui.unmount();
  }
});
