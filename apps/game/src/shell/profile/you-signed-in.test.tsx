import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@realms-world/identity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

// Identity's profiles never answer here: the player's own card must not wait on them.
vi.hoisted(() => vi.stubGlobal("fetch", () => new Promise<Response>(() => {})));

const signedIn = vi.hoisted(() => ({
  session: {
    session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
    user: { id: "u", realmsId: "0x7", name: "Maelis", email: "you@mail.test", image: "04", emailVerified: true },
  } as unknown as Session,
}));
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-in", session: signedIn.session }),
}));
// A player with no finished game and no season to stand in.
vi.mock("../herald", () => ({
  useRealmsPlayer: () => ({ data: "0x5eed0292" }),
  useRecentResults: () => ({ isError: false, isPending: false, data: { games: [] } }),
  useDirectory: () => ({ data: { games: [] } }),
  useLeaderboard: () => ({ data: undefined }),
}));

import { setViewportWidth } from "../frame/test-viewport";
import { ProfilePage, SettingsPage } from "./profile-pages";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
});

const open = async (path: string, width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/settings" element={<SettingsPage />} />
            <Route path="*" element={null} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return container.querySelector('[data-band="body"]')!;
};

describe.each([1440, 390])("You, signed in, at %i px", (width) => {
  it("opens the player's own card on their name, never on the address's stand-in (qa-app-1 P3-4)", async () => {
    const page = await open("/profile", width);
    expect(page.textContent).toContain("Maelis");
    expect(page.textContent).not.toMatch(/Lord/);
  });

  it("says how a rating is carried on the player's own card, on a phone as on a desktop (qa-app-1 P3-10)", async () => {
    const page = await open("/profile", width);
    expect(page.textContent).toContain("Link a wallet in Settings to carry a rating.");
  });
});

it("keeps the desktop's games plate with no finished game, saying they will show there (qa-app-1 P3-9)", async () => {
  const page = await open("/profile", 1440);
  const games = [...page.querySelectorAll("section, .plate")].find((element) =>
    element.textContent?.startsWith("Recent games"),
  );
  expect(games?.textContent).toContain("Your finished games will show here.");
});

describe("a session with no name claimed yet (qa-blitz-1 #3)", () => {
  it.each(["/profile", "/profile/settings"])("offers Claim name, and Sign out, on %s", async (path) => {
    const named = signedIn.session;
    // Identity names a new account by its id until a name is claimed.
    signedIn.session = { ...named, user: { ...named.user, name: named.user.id } } as unknown as Session;
    try {
      const page = await open(path, 1440);
      const buttons = [...page.querySelectorAll("button")].map((button) => button.textContent);
      expect(buttons).toContain("Claim name");
      expect(buttons).toContain("Sign out");
    } finally {
      signedIn.session = named;
    }
  });
});
