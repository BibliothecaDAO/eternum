import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
// Signed out: the links do not wait on an account.
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));
vi.mock("../herald", () => ({ useRealmsPlayer: () => ({ data: null }) }));

import { setViewportWidth } from "../frame/test-viewport";
import { ProfilePage } from "./profile-pages";

let unmount: (() => Promise<void>) | null = null;

const openProfile = async (width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return container;
};

const communityLinks = (page: HTMLElement) =>
  [...page.querySelectorAll<HTMLAnchorElement>('[data-band="body"] nav[aria-label="Community"] a')].map((link) => [
    link.textContent,
    link.getAttribute("href"),
    link.target,
  ]);

afterEach(async () => {
  await unmount?.();
  unmount = null;
});

it("gives a phone, which has no footer, the community's four links as rows on Profile", async () => {
  expect(communityLinks(await openProfile(390))).toEqual([
    ["Discord", "https://discord.gg/realmsworld", "_blank"],
    ["X", "https://x.com/LootRealms", "_blank"],
    ["Telegram", "https://t.me/+UpfCtj7qEO9hZjU1", "_blank"],
    ["GitHub", "https://github.com/BibliothecaDAO", "_blank"],
  ]);
});

it("adds no such rows on the desktop, where Learn's footer holds them", async () => {
  expect(communityLinks(await openProfile(1440))).toEqual([]);
});
