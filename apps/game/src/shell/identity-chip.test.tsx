import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

// The identity client binds fetch when its module loads, and the chip's first session load asks it: nobody is signed in.
vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { IdentityChip } from "./identity-chip";

afterEach(() => useIdentitySessionStore.setState({ status: "anonymous", session: null }));

const nameless = {
  session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
  user: { id: "u", realmsId: "0x7", name: "u", email: "you@mail.test", image: "04" },
};

const Where = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
};

const mountAt = async (path: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[path]}>
          <IdentityChip />
          <Routes>
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  return {
    chip: () => container.querySelector("button")!,
    where: () => container.querySelector("[data-testid='where']")?.textContent,
    unmount: () => act(async () => root.unmount()),
  };
};

it("sends a signed-out player who clicks the chip to the sign-in flow, to come back to this page", async () => {
  useIdentitySessionStore.setState({ status: "anonymous", session: null });
  const ui = await mountAt("/results?game=2");
  try {
    expect(ui.chip().textContent).toBe("Sign in");
    await act(async () => ui.chip().click());
    expect(ui.where()).toBe(`/sign-in?next=${encodeURIComponent("/results?game=2")}`);
  } finally {
    await ui.unmount();
  }
});

it("asks a signed-in player without a name to claim one, in the flow, never showing their address", async () => {
  useIdentitySessionStore.setState({ status: "signed-in", session: nameless });
  const ui = await mountAt("/play");
  try {
    expect(ui.chip().textContent).toBe("Claim name");
    await act(async () => ui.chip().click());
    expect(ui.where()).toBe(`/sign-in?next=${encodeURIComponent("/play")}`);
  } finally {
    await ui.unmount();
  }
});
