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
  // better-auth lists its own email-code record too; only the sign-in providers are named, in the sheet's order.
  vi.spyOn(identityClient, "listSignInProviders").mockResolvedValue(["twitter", "credential", "google"]);
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
    expect(container.textContent).toContain("Google · X · email");
    // How the player signs in is not a way to a provider: no row of the account wears a provider's mark.
    expect(container.querySelector('[data-icon^="brand-"]')).toBeNull();
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
    expect(document.querySelector('[role="dialog"][aria-label="Payout wallet"]')?.textContent).toContain(
      "I have a wallet",
    );
  } finally {
    await unlinked.unmount();
  }
});

it("edits the name in its own row, offering Claim name only once it differs (qa-app-1 P3-6), Escape putting it back", async () => {
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
    // The field takes the focus the row held (review-no-back-1, P2-2).
    expect(document.activeElement).toBe(field);
    // The field stands in the name's own row, in the Account panel: nothing opens under the rows or over the page.
    expect(field.closest(".app-row")?.closest(".app-panel")).not.toBeNull();
    expect(document.querySelector('[role="dialog"], [role="region"]')).toBeNull();
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
    // Escape puts the row back as it was, and gives it back the focus.
    await act(async () => void field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector("form")).toBeNull();
    expect(nameRowNow(container)).not.toBeNull();
    expect(document.activeElement).toBe(nameRowNow(container));
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

/** The Name row as it stands now: the edit replaces it, and closing draws it anew. */
const nameRowNow = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>(".app-row")].find((row) => row.textContent === "NameMaelis") ?? null;

it("puts the name's row back on a press outside it, as a phone without Escape does", async () => {
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
    await act(async () => nameRowNow(container)!.click());
    const field = document.querySelector<HTMLInputElement>("form input")!;
    // A press in the row (its field, Claim name) keeps it open.
    await act(async () => void field.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })));
    expect(container.querySelector("form")).not.toBeNull();
    // A press on the page beside it puts it back.
    await act(async () => void document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })));
    expect(container.querySelector("form")).toBeNull();
    expect(nameRowNow(container)).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("gives the Name row the focus back once a new name is claimed (review-no-back-1, P2-2)", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(identityClient, "listSignInProviders").mockResolvedValue([]);
  const updateUser = vi.spyOn(identityClient, "updateUser").mockResolvedValue(undefined as never);
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
    await act(async () => nameRowNow(container)!.click());
    const field = document.querySelector<HTMLInputElement>("form input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "Maelis2");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => field.form!.requestSubmit());
    expect(updateUser).toHaveBeenCalledWith({ name: "Maelis2" });
    expect(container.querySelector("form")).toBeNull();
    expect(document.activeElement).toBe(nameRowNow(container));
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

it("opens the portrait in the app's one sheet, its row carrying no arrow, and closes it on its cross", async () => {
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
    const row = [...container.querySelectorAll<HTMLElement>(".app-row")].find(
      (each) => each.textContent === "Portrait",
    )!;
    expect(row.querySelector('[data-icon="arrow-right"]')).toBeNull();
    await act(async () => row.click());
    const sheet = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Portrait"]');
    expect(sheet()?.querySelectorAll('[role="radio"]').length).toBeGreaterThan(0);
    await act(async () => sheet()!.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(sheet()).toBeNull();
    // The sheet's own history entry goes back a moment later: let it, so it reaches no other test.
    await settle();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
