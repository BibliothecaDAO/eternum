import type { Session } from "@realms-world/identity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

import { identityClient } from "@/hooks/context/identity-session";

import { AccountCard } from "./account-card";

const session = {
  session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
  user: { id: "u", realmsId: "0x7", name: "Maelis", email: "you@mail.test", image: "04", emailVerified: true },
} as unknown as Session;

it("asks before signing out, with Keep as the safe choice", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(identityClient, "listSignInProviders").mockResolvedValue(["discord"]);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <AccountCard session={session} />
      </MemoryRouter>,
    ),
  );
  try {
    const button = (word: string) =>
      [...document.querySelectorAll("button")].find((candidate) => candidate.textContent === word);
    expect(container.textContent).toContain("Discord · email");
    await act(async () => button("Sign out")!.click());
    expect(document.body.textContent).toContain("Sign out?");
    // The question opens in the kit's sheet, which docks as a panel on a desktop: never a modal of its own.
    expect(document.querySelector('[data-kit-sheet][aria-label="Sign out?"]')).not.toBeNull();
    await act(async () => button("Keep")!.click());
    expect(document.body.textContent).not.toContain("Sign out?");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("shows the linked payout wallet by its address, changed only with a code, and Link wallet to an account with none", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(identityClient, "listSignInProviders").mockResolvedValue([]);
  const linked = { ...session, user: { ...session.user, address: "0x04a1d2c3e4f59f3c" } } as Session;
  const mount = async (shown: Session) => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <MemoryRouter>
          <AccountCard session={shown} />
        </MemoryRouter>,
      ),
    );
    return {
      container,
      unmount: async () => {
        await act(async () => root.unmount());
        container.remove();
      },
    };
  };
  const payoutRow = (container: HTMLElement) =>
    [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Payout wallet"))!;

  const account = await mount(linked);
  try {
    // The wallet receives at once: its row is its address, never a time to wait for.
    expect(payoutRow(account.container).textContent).toContain("0x04a1…9f3c");
    await act(async () => payoutRow(account.container).click());
    const words = [...document.querySelectorAll("button")].map((button) => button.textContent);
    expect(words).toContain("Replace");
    expect(words).toContain("Unlink");
  } finally {
    await account.unmount();
  }

  const unlinked = await mount(session);
  try {
    expect(payoutRow(unlinked.container).textContent).toContain("Link wallet");
  } finally {
    await unlinked.unmount();
  }
});
