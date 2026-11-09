import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { IdentityRequestError, type Session } from "@realms-world/identity";

import { DeleteAccount } from "./account-deletion";

const EMAIL = "leaving@mail.test";
const SESSION = {
  session: { id: "s", expiresAt: "2026-12-01T00:00:00Z", userId: "u" },
  user: { id: "u", realmsId: "0x7", name: "Leaving", email: EMAIL },
} satisfies Session;

const mounted: (() => Promise<void>)[] = [];

/** Settings' Delete account row, on Settings, with Play to land on. */
const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/profile/settings"]}>
        <Routes>
          <Route path="/profile/settings" element={<DeleteAccount email={EMAIL} />} />
          <Route path="/" element={<p>Play</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  mounted.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};

const press = async (word: string) =>
  act(async () => [...document.body.querySelectorAll("button")].find((button) => button.textContent === word)!.click());

const typeCode = async (code: string) => {
  const input = document.body.querySelector<HTMLInputElement>(".app-code input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, code);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

afterEach(async () => {
  for (const unmount of mounted.splice(0)) await unmount();
  vi.restoreAllMocks();
});

it("says what is deleted and what stays, the wallet's recovery included, before any code is sent", async () => {
  const sendCode = vi.spyOn(identityClient, "sendSignInCode");
  await mount();
  await press("Delete account");
  const sheet = document.body.textContent!;
  expect(sheet).toContain("permanent");
  expect(sheet).toContain("Your notification settings and push alerts on every device");
  expect(sheet).toContain("email recovery ends");
  expect(sheet).toContain("Your game accounts stay on chain");
  expect(sheet).toContain("until they are 30 days old");
  expect(sendCode).not.toHaveBeenCalled();
});

it("deletes the account with the emailed code, says a wrong one, and lands signed out on Play", async () => {
  useIdentitySessionStore.getState().applySession(SESSION);
  const sendCode = vi
    .spyOn(identityClient, "sendSignInCode")
    .mockResolvedValue({ success: true, expires_at: Date.now() / 1000 + 300 });
  const deleteAccount = vi
    .spyOn(identityClient, "deleteAccount")
    .mockRejectedValueOnce(new IdentityRequestError(400, "INVALID_OTP"))
    .mockResolvedValueOnce();
  const page = await mount();
  await press("Delete account");
  await press("Email me a code");
  expect(sendCode).toHaveBeenCalledWith(EMAIL);

  await typeCode("111111");
  expect(document.body.textContent).toContain("That code is not right.");
  expect(useIdentitySessionStore.getState().session).toBe(SESSION);

  await typeCode("222222");
  expect(deleteAccount.mock.calls).toEqual([["111111"], ["222222"]]);
  expect(useIdentitySessionStore.getState().session).toBeNull();
  expect(page.textContent).toBe("Play");
});
