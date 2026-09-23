import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

// The identity client binds fetch when its module loads, and the chip's first session load asks it: nobody is signed in.
vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

vi.mock("./account-runtime", () => ({
  default: () => <p data-testid="sign-in-view">Sign in with your Starknet wallet.</p>,
}));

import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { IdentityChip } from "./identity-chip";

afterEach(() => {
  useIdentitySessionStore.setState({ status: "anonymous", session: null, signInRequest: null });
  usePopoverStore.getState().close();
});

async function mount() {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <IdentityChip />
      </MemoryRouter>,
    ),
  );
  return {
    container,
    click: () => act(async () => container.querySelector("button")!.click()),
    close: () => act(async () => root.unmount()),
  };
}

it("opens the sign-in view for a signed-out player who clicks the chip", async () => {
  useIdentitySessionStore.setState({ status: "anonymous", session: null, signInRequest: null });
  const ui = await mount();
  try {
    expect(ui.container.querySelector("button")?.textContent).toBe("Sign in");
    await ui.click();
    await act(async () => {});
    expect(ui.container.querySelector("[role='dialog']")).not.toBeNull();
    expect(ui.container.textContent).not.toContain("Loading…");
    expect(ui.container.querySelector("[data-testid='sign-in-view']")).not.toBeNull();
    expect(useIdentitySessionStore.getState().signInRequest).toEqual({});
  } finally {
    await ui.close();
  }
});
