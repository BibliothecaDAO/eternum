import { IDENTITY_PORTRAITS, IdentityRequestError, type Session } from "@realms-world/identity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

// The identity client binds fetch when its module loads; nothing in these tests reaches the network.
vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { SignInPage } from "./sign-in-page";

const NEXT = "/g/0x5245414c4d53/1/map?col=4&row=9&spectate=true";

const sessionOf = (user: Partial<Session["user"]>): Session => ({
  session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
  user: { id: "u", realmsId: "0x7", name: "u", email: "you@mail.test", suggestedName: "Ysolde", image: null, ...user },
});

const Where = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
};

const mount = async (path: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  const query = <T extends Element>(selector: string) => container.querySelector<T>(selector);
  const type = (selector: string, value: string) =>
    act(async () => {
      const input = query<HTMLInputElement>(selector)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  const unmount = () =>
    act(async () => {
      root.unmount();
      container.remove();
    });
  return { container, query, type, unmount };
};

afterEach(() => {
  vi.restoreAllMocks();
  useIdentitySessionStore.setState({ status: "anonymous", session: null });
});

describe("the sign-in flow", () => {
  it("takes a new player from an emailed code through their name and portrait to Play, back where they asked", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    const sendCode = vi.spyOn(identityClient, "sendSignInCode").mockResolvedValue();
    vi.spyOn(identityClient, "signInWithCode").mockResolvedValue(sessionOf({}));
    const save = vi.spyOn(identityClient, "updateUser").mockResolvedValue();
    // The app's one first session load finds nobody; the refresh after the profile is saved finds the named player.
    vi.spyOn(identityClient, "getSession")
      .mockResolvedValueOnce(null)
      .mockResolvedValue(sessionOf({ name: "Ysolde", image: "04" }));
    const ui = await mount(`/sign-in?next=${encodeURIComponent(NEXT)}`);
    try {
      await ui.type('input[type="email"]', "you@mail.test");
      await act(async () => ui.query<HTMLFormElement>("form")!.requestSubmit());
      expect(sendCode).toHaveBeenCalledWith("you@mail.test");
      expect(ui.container.textContent).toContain("you@mail.test");

      await ui.type('input[autocomplete="one-time-code"]', "481927");
      const name = () => ui.query<HTMLInputElement>('input[autocomplete="nickname"]')!;
      expect(name().value).toBe("Ysolde");
      expect(name().getAttribute("aria-invalid")).toBe("false");
      const picked = ui.query('[role="radio"][aria-checked="true"]')!.getAttribute("aria-label")!;
      expect(IDENTITY_PORTRAITS.map((id) => `Portrait ${id}`)).toContain(picked);

      await ui.type('input[autocomplete="nickname"]', "Ys@lde");
      expect(name().getAttribute("aria-invalid")).toBe("true");
      expect(ui.query<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

      await ui.type('input[autocomplete="nickname"]', "Ysolde");
      await act(async () => ui.query<HTMLFormElement>("form")!.requestSubmit());
      expect(save).toHaveBeenCalledWith({ name: "Ysolde", image: picked.replace("Portrait ", "") });
      expect(ui.container.textContent).toContain("You're in, Ysolde");

      await act(async () => ui.query<HTMLAnchorElement>("a")!.click());
      expect(ui.query('[data-testid="where"]')?.textContent).toBe(NEXT);
    } finally {
      await ui.unmount();
    }
  });

  it("clears the boxes and says why when the code is refused", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "sendSignInCode").mockResolvedValue();
    vi.spyOn(identityClient, "signInWithCode").mockRejectedValue(new IdentityRequestError(401, "INVALID_OTP"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ui = await mount("/sign-in?next=%2Fresults");
    try {
      await ui.type('input[type="email"]', "you@mail.test");
      await act(async () => ui.query<HTMLFormElement>("form")!.requestSubmit());
      await ui.type('input[autocomplete="one-time-code"]', "111111");
      await act(async () => {});
      expect(ui.container.textContent).toContain("That code is not right.");
      expect(ui.query<HTMLInputElement>('input[autocomplete="one-time-code"]')!.value).toBe("");
    } finally {
      await ui.unmount();
    }
  });

  it("opens on the name step for a session that has no name yet", async () => {
    useIdentitySessionStore.setState({ status: "signed-in", session: sessionOf({ image: "04" }) });
    const ui = await mount("/sign-in?next=%2Fplay");
    try {
      expect(ui.query<HTMLInputElement>('input[autocomplete="nickname"]')?.value).toBe("Ysolde");
      expect(ui.query('[role="radio"][aria-checked="true"]')?.getAttribute("aria-label")).toBe("Portrait 04");
    } finally {
      await ui.unmount();
    }
  });

  it("sends a player who already has a name straight back, and never off the site", async () => {
    useIdentitySessionStore.setState({ status: "signed-in", session: sessionOf({ name: "Ysolde", image: "04" }) });
    const back = await mount("/sign-in?next=%2Fresults");
    expect(back.query('[data-testid="where"]')?.textContent).toBe("/results");
    await back.unmount();

    const home = await mount(`/sign-in?next=${encodeURIComponent("//evil.example/")}`);
    expect(home.query('[data-testid="where"]')?.textContent).toBe("/");
    await home.unmount();
  });
});
