import type { Session } from "@realms-world/identity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

import { identityClient } from "@/hooks/context/identity-session";

import { AccountCard, SignOut } from "./account-card";

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
        <SignOut />
      </MemoryRouter>,
    ),
  );
  try {
    const button = (word: string) =>
      [...document.querySelectorAll("button")].find((candidate) => candidate.textContent === word);
    expect(container.textContent).toContain("Discord · email");
    // How the player signs in is not a way to Discord: no row of the account wears Discord's logo.
    expect(container.querySelector('[data-icon="discord"]')).toBeNull();
    expect(container.querySelector('[data-icon="lock"]')).not.toBeNull();
    await act(async () => button("Sign out")!.click());
    // The question is the app's dialog over the page: Keep is its way out, and so is Escape.
    expect(document.querySelector('[role="dialog"][aria-label="Sign out?"]')).not.toBeNull();
    await act(async () => button("Keep")!.click());
    expect(document.body.textContent).not.toContain("Sign out?");
    await act(async () => button("Sign out")!.click());
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
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
    [...container.querySelectorAll<HTMLElement>(".app-row")].find((row) =>
      row.textContent?.startsWith("Payout wallet"),
    )!;

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
    // The whole row is the target: "Link wallet" itself opens the wallet's step.
    const linkWallet = payoutRow(unlinked.container).querySelector<HTMLElement>(".app-setting__value")!;
    expect(linkWallet.textContent).toBe("Link wallet");
    await act(async () => linkWallet.click());
    expect(document.querySelector('[role="region"][aria-label="Payout wallet"]')?.textContent).toContain(
      "I have a wallet",
    );
  } finally {
    await unlinked.unmount();
  }
});

it("offers Claim name only once the name differs from the one held (qa-app-1 P3-6)", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(identityClient, "listSignInProviders").mockResolvedValue([]);
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
    const nameRow = [...container.querySelectorAll(".app-row")].find((row) => row.textContent === "NameMaelis")!;
    await act(async () => (nameRow as HTMLElement).click());
    const claim = () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent === "Claim name",
      )!;
    const field = document.querySelector<HTMLInputElement>("form input")!;
    expect(field.value).toBe("Maelis");
    expect(claim().disabled).toBe(true);
    // A new name to claim: the step lights.
    const type = (value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await type("Maelis2");
    expect(claim().disabled).toBe(false);
    // Back to the name held: nothing to claim again.
    await type("Maelis");
    expect(claim().disabled).toBe(true);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

/** History moves a moment after it is asked to. */
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

it("closes Sign out's question on the system back without leaving Settings, and leaves no step behind when kept", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const previous = window.location.href;
  window.history.replaceState({}, "", "/profile");
  window.history.pushState({}, "", "/profile/settings");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const signOut = () =>
    act(async () =>
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Sign out")!.click(),
    );
  const asking = () => document.body.querySelector('[role="dialog"][aria-label="Sign out?"]') !== null;
  try {
    await act(async () => root.render(<SignOut />));
    await signOut();
    await settle();
    expect(asking()).toBe(true);
    await act(async () => window.history.back());
    await settle();
    expect([window.location.pathname, asking()]).toEqual(["/profile/settings", false]);

    // Kept with its button, then with Escape: each time the page's own back still leads to the page before.
    await signOut();
    await settle();
    await act(async () =>
      [...document.body.querySelectorAll("button")].find((button) => button.textContent === "Keep")!.click(),
    );
    await settle();
    await signOut();
    await settle();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    await settle();
    expect([window.location.pathname, asking()]).toEqual(["/profile/settings", false]);
    await act(async () => window.history.back());
    await settle();
    expect(window.location.pathname).toBe("/profile");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    window.history.replaceState({}, "", previous);
  }
});
