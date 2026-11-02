import type { Session } from "@realms-world/identity";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
// The wallet's own steps (a signature, an emailed code) stand in as their two ends: a change taken, or one refused.
vi.mock("./payout-wallet-panel", () => ({
  PayoutWalletPanel: ({ onChanged }: { onChanged: () => void }) => (
    <>
      <button type="button" onClick={onChanged}>
        Change taken
      </button>
      <button type="button">Change refused</button>
    </>
  ),
}));

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";

import { AccountCard } from "./account-card";

const user = { id: "u", realmsId: "0x7", name: "Maelis", email: "you@mail.test", image: "04", emailVerified: true };
const sessionWith = (address: string | null) =>
  ({
    session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
    user: { ...user, address },
  }) as unknown as Session;

let container: HTMLDivElement;
let root: Root;
const refresh = vi.fn(async () => undefined);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(identityClient, "listSignInProviders").mockResolvedValue([]);
  useIdentitySessionStore.setState({ refresh } as never);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  refresh.mockClear();
  // A sheet closed steps back off its history entry a moment later: that step lands here, not in the next test.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
});

const draw = (session: Session) =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <AccountCard session={session} />
      </MemoryRouter>,
    ),
  );
const payoutRow = () =>
  [...container.querySelectorAll<HTMLElement>(".app-row")].find((row) => row.textContent?.startsWith("Payout wallet"))!;
const sheet = () => document.querySelector('[role="dialog"][aria-label="Payout wallet"]');
const press = (words: string) =>
  act(async () =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === words)!.click(),
  );

it("closes the payout wallet's sheet once a change is taken, the row showing the new wallet (review-no-back-1, P3-5)", async () => {
  await draw(sessionWith(null));
  expect(payoutRow().textContent).toContain("Link wallet");
  await act(async () => payoutRow().click());
  expect(sheet()).not.toBeNull();

  await press("Change taken");
  expect(sheet()).toBeNull();
  expect(refresh).toHaveBeenCalledOnce();
  // The refreshed session carries the wallet, and the row reads it.
  await draw(sessionWith("0x04a1d2c3e4f59f3c"));
  expect(payoutRow().textContent).toContain("0x04a1");
});

it("keeps the payout wallet's sheet open when a change is refused", async () => {
  await draw(sessionWith(null));
  await act(async () => payoutRow().click());
  await press("Change refused");
  expect(sheet()).not.toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});
