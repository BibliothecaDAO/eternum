import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

// The identity client binds fetch when its module loads, and the chip's first session load asks it: nobody is signed in.
vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { IdentityChip } from "./identity-chip";

afterEach(() => useIdentitySessionStore.setState({ status: "anonymous", session: null }));

const Where = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
};

it("sends a signed-out player who clicks the chip to the sign-in flow, to come back to this page", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useIdentitySessionStore.setState({ status: "anonymous", session: null });
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/results?game=2"]}>
        <IdentityChip />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  try {
    const chip = container.querySelector("button")!;
    expect(chip.textContent).toBe("Sign in");
    await act(async () => chip.click());
    expect(container.querySelector("[data-testid='where']")?.textContent).toBe(
      `/sign-in?next=${encodeURIComponent("/results?game=2")}`,
    );
    expect(container.querySelector("[role='dialog']")).toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});
