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

it("shows a session without a payout wallet as a fault, with no uncoded link or unlink", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(identityClient, "listSignInProviders").mockResolvedValue([]);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const linked = { ...session, user: { ...session.user, address: "0xabc" } } as Session;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <AccountCard session={linked} />
      </MemoryRouter>,
    ),
  );
  try {
    expect(container.textContent).toContain("Payout wallet");
    expect(container.textContent).toContain("Unavailable");
    expect(logged).toHaveBeenCalledWith("identity_payout_wallet_missing", { user: "u" });
    const row = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Payout wallet"),
    );
    await act(async () => row!.click());
    expect(document.body.textContent).toContain("Your account did not say which wallet pays you.");
    const words = [...document.querySelectorAll("button")].map((button) => button.textContent);
    expect(words).not.toContain("Unlink");
    expect(words).not.toContain("Link wallet");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    logged.mockRestore();
  }
});
