import { IDENTITY_PORTRAITS, IdentityRequestError, type Session, type SocialProvider } from "@realms-world/identity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

// The identity client binds fetch when its module loads; nothing in these tests reaches the network.
vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

const passkeys = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/ui/modules/identity/passkey", () => ({
  createPasskey: passkeys.create,
  signWithPasskey: vi.fn(),
  PasskeyUnavailableError: class PasskeyUnavailableError extends Error {},
}));

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { pageNavigation } from "@/utils/page-navigation";
import { setViewportWidth } from "../frame/test-viewport";
import { useRequestSignIn, useConnectStore } from "./connect";
import { TabBar } from "../frame/tabs";
import { ConnectFlow } from "./connect-flow";
import { APP_WAIT_MS, discordAndroidIntent, discordAppUrl } from "./discord-app";
import { forgetSocialStart, pendingSocialStart, rememberSocialStart } from "./social-pending";

const NEXT = "/g/0x5245414c4d53/1/map?col=4&row=9&spectate=true";

const sessionOf = (user: Partial<Session["user"]>): Session => ({
  session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
  // A payout wallet unless a test is about the account without one.
  user: {
    id: "u",
    realmsId: "0x7",
    name: "u",
    email: "you@mail.test",
    suggestedName: "Ysolde",
    image: null,
    address: "0x4a1",
    ...user,
  },
});

/** A page with a surface that asks to connect, sending the player on to `next` once connected. */
const Page = ({ next }: { next?: string }) => {
  const { pathname, search } = useLocation();
  const requestSignIn = useRequestSignIn();
  return (
    <>
      <p data-testid="where">{`${pathname}${search}`}</p>
      <button type="button" data-testid="ask" onClick={() => requestSignIn(next)}>
        Ask
      </button>
      <ConnectFlow />
    </>
  );
};

const mount = async (path: string, next?: string, bar = false) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(390);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        {bar && <TabBar />}
        <Page next={next} />
      </MemoryRouter>,
    ),
  );
  // The page and Connect's window, which opens over it at the body's end.
  const query = <T extends Element>(selector: string) => document.body.querySelector<T>(selector);
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
  const ask = () => act(async () => query<HTMLButtonElement>('[data-testid="ask"]')!.click());
  const where = () => query('[data-testid="where"]')?.textContent;
  const window = () => query('[role="dialog"]');
  // What a player sees: the page and Connect's window over it, at the body's end.
  return { container: document.body, query, type, ask, where, window, unmount };
};

/** The identity Worker's answer to a sent code: when it stops working, seconds from now. */
const sentCode = (seconds: number) => ({ success: true as const, expires_at: Date.now() / 1000 + seconds });

afterEach(() => {
  vi.restoreAllMocks();
  useIdentitySessionStore.setState({ status: "anonymous", session: null });
  useConnectStore.setState({ request: null, nameDismissed: false, walletDismissed: false });
  forgetSocialStart();
});

describe("Connect", () => {
  it("asks a new player from an emailed code for their name, suggesting nothing, then takes them where the asker sends them", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    const sendCode = vi.spyOn(identityClient, "sendSignInCode").mockResolvedValue(sentCode(300));
    // An email sign-up is suggested no name (the identity service suggests only a Discord name).
    vi.spyOn(identityClient, "signInWithCode").mockResolvedValue(sessionOf({ suggestedName: null }));
    const save = vi.spyOn(identityClient, "updateUser").mockResolvedValue();
    // The app's one first session load finds nobody; the refresh after the name is saved finds the named player.
    vi.spyOn(identityClient, "getSession")
      .mockResolvedValueOnce(null)
      .mockResolvedValue(sessionOf({ name: "Ysolde", image: "04", address: null }));
    const ui = await mount("/", NEXT);
    try {
      expect(ui.window()).toBeNull();
      await ui.ask();
      expect(ui.window()?.getAttribute("aria-label")).toBe("Connect");
      await ui.type('input[type="email"]', "you@mail.test");
      await act(async () => ui.query<HTMLFormElement>("form")!.requestSubmit());
      expect(sendCode).toHaveBeenCalledWith("you@mail.test");
      expect(ui.container.textContent).toContain("you@mail.test");

      await ui.type('input[autocomplete="one-time-code"]', "481927");
      await act(async () => {});
      // Nothing is saved by itself: the name step opens empty, saying what to put in it, nothing from the email.
      expect(save).not.toHaveBeenCalled();
      expect(ui.window()?.getAttribute("aria-label")).toBe("Your name");
      const name = ui.query<HTMLInputElement>('input[autocomplete="nickname"]')!;
      expect(name.value).toBe("");
      expect(name.getAttribute("aria-invalid")).toBeNull();
      expect(ui.window()?.textContent).toContain("Pick the name other players see on the leaderboards.");
      expect(ui.query<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

      await ui.type('input[autocomplete="nickname"]', "Ysolde");
      await act(async () => ui.query<HTMLFormElement>("form")!.requestSubmit());
      expect(save).toHaveBeenCalledTimes(1);
      const saved = save.mock.calls[0][0] as { name: string; image: string };
      expect(saved.name).toBe("Ysolde");
      expect(IDENTITY_PORTRAITS).toContain(saved.image);
      expect(ui.where()).toBe(NEXT);
      expect(ui.window()?.getAttribute("aria-label")).toBe("Your wallet");
    } finally {
      await ui.unmount();
    }
  });

  it("asks an unnamed account back from Discord with its old suggestion taken off for a name, saving nothing by itself", async () => {
    // The session identity.test.ts reads after 0031 for an email account linked to Discord later: unnamed (its name is
    // its id), suggested nothing.
    useIdentitySessionStore.setState({ status: "signed-in", session: sessionOf({ suggestedName: null }) });
    const save = vi.spyOn(identityClient, "updateUser").mockResolvedValue();
    const ui = await mount("/");
    try {
      await act(async () => {});
      expect(save).not.toHaveBeenCalled();
      expect(ui.window()?.getAttribute("aria-label")).toBe("Your name");
      expect(ui.query<HTMLInputElement>('input[autocomplete="nickname"]')!.value).toBe("");
    } finally {
      await ui.unmount();
    }
  });

  it("names a Discord sign-up by its Discord name by itself and goes straight on", async () => {
    useIdentitySessionStore.setState({ status: "signed-in", session: sessionOf({ suggestedName: "nelly_b" }) });
    const save = vi.spyOn(identityClient, "updateUser").mockResolvedValue();
    vi.spyOn(identityClient, "getSession").mockResolvedValue(sessionOf({ name: "nelly_b", image: "04" }));
    const ui = await mount("/g/0x5245414c4d53/1/map");
    try {
      await act(async () => {});
      expect(save).toHaveBeenCalledTimes(1);
      expect((save.mock.calls[0][0] as { name: string }).name).toBe("nelly_b");
      expect(ui.query('input[autocomplete="nickname"]')).toBeNull();
    } finally {
      await ui.unmount();
    }
  });

  it("tries the suggestion with a number after it when the name is taken", async () => {
    useIdentitySessionStore.setState({ status: "signed-in", session: sessionOf({ suggestedName: "ysolde" }) });
    const save = vi
      .spyOn(identityClient, "updateUser")
      .mockRejectedValueOnce(new Error("NAME_TAKEN"))
      .mockResolvedValue();
    vi.spyOn(identityClient, "getSession").mockResolvedValue(sessionOf({ name: "ysolde2", image: "04" }));
    const ui = await mount("/g/0x5245414c4d53/1/map");
    try {
      await act(async () => {});
      expect(save.mock.calls.map(([fields]) => (fields as { name: string }).name)).toEqual(["ysolde", "ysolde2"]);
      expect(ui.window()).toBeNull();
    } finally {
      await ui.unmount();
    }
  });

  it("asks for a name, with the rule and a portrait, only when no default name could be saved", async () => {
    useIdentitySessionStore.setState({ status: "signed-in", session: sessionOf({}) });
    const save = vi.spyOn(identityClient, "updateUser").mockRejectedValue(new Error("NAME_TAKEN"));
    vi.spyOn(identityClient, "getSession").mockResolvedValue(sessionOf({ name: "Ysolde", image: "04" }));
    const ui = await mount("/", NEXT);
    try {
      await act(async () => {});
      // The suggestion and its four numbered forms were all taken.
      expect(save).toHaveBeenCalledTimes(5);
      expect(ui.window()?.getAttribute("aria-label")).toBe("Your name");
      const name = () => ui.query<HTMLInputElement>('input[autocomplete="nickname"]')!;
      expect(name().value).toBe("Ysolde");
      const picked = ui.query('[role="radio"][aria-checked="true"]')!.getAttribute("aria-label")!;
      expect(IDENTITY_PORTRAITS.map((id) => `Portrait ${id}`)).toContain(picked);

      await ui.type('input[autocomplete="nickname"]', "Ys@lde");
      expect(name().getAttribute("aria-invalid")).toBe("true");
      expect(ui.query<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

      save.mockResolvedValue();
      await ui.type('input[autocomplete="nickname"]', "Ysolde the Bold");
      await act(async () => ui.query<HTMLFormElement>("form")!.requestSubmit());
      expect(save).toHaveBeenLastCalledWith({ name: "Ysolde the Bold", image: picked.replace("Portrait ", "") });
    } finally {
      await ui.unmount();
    }
  });

  it("leaves the player on the page they asked from when the asker names nowhere", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "sendSignInCode").mockResolvedValue(sentCode(300));
    vi.spyOn(identityClient, "signInWithCode").mockResolvedValue(sessionOf({ name: "Ysolde", image: "04" }));
    const ui = await mount("/season?tab=frontier");
    try {
      await ui.ask();
      await ui.type('input[type="email"]', "you@mail.test");
      await act(async () => ui.query<HTMLFormElement>("form")!.requestSubmit());
      await ui.type('input[autocomplete="one-time-code"]', "481927");
      await act(async () => {});
      expect(ui.window()).toBeNull();
      expect(ui.where()).toBe("/season?tab=frontier");
    } finally {
      await ui.unmount();
    }
  });

  it("opens from the bar's Connect, which stands for You while no one is signed in", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    const ui = await mount("/season", undefined, true);
    try {
      const connect = ui.query<HTMLButtonElement>('button[data-role="tab"]')!;
      expect(connect.textContent).toBe("Connect");
      await act(async () => connect.click());
      expect(ui.window()?.getAttribute("aria-label")).toBe("Connect");
      expect(ui.where()).toBe("/season");
    } finally {
      await ui.unmount();
    }
  });

  it("leaves the page under it inert while open, and closes from its cross to leave the page as it was", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    const ui = await mount("/results?game=2", NEXT);
    const inert = () => ui.query('[data-testid="ask"]')!.closest("[inert]") !== null;
    try {
      await ui.ask();
      expect(inert()).toBe(true);
      expect(ui.window()!.closest("[inert]")).toBeNull();
      await act(async () => ui.query<HTMLButtonElement>('button[aria-label="Close"]')!.click());
      expect(inert()).toBe(false);
      expect(ui.window()).toBeNull();
      expect(ui.where()).toBe("/results?game=2");
    } finally {
      await ui.unmount();
    }
  });

  it("clears the boxes and says why when the code is refused", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "sendSignInCode").mockResolvedValue(sentCode(300));
    vi.spyOn(identityClient, "signInWithCode").mockRejectedValue(new IdentityRequestError(401, "INVALID_OTP"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ui = await mount("/results");
    try {
      await ui.ask();
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

  it("stays shut for a player who already has a name and a payout wallet", async () => {
    useIdentitySessionStore.setState({
      status: "signed-in",
      session: sessionOf({ name: "Ysolde", image: "04", address: "0x4a1" }),
    });
    const ui = await mount("/results");
    try {
      await ui.ask();
      expect(ui.window()).toBeNull();
    } finally {
      await ui.unmount();
    }
  });

  it("shows when the code expires from the Worker's answer, and a dash with New code when it gives none", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    const send = vi.spyOn(identityClient, "sendSignInCode").mockResolvedValue(sentCode(300));
    const sendCodeTo = async (ui: Awaited<ReturnType<typeof mount>>) => {
      await ui.ask();
      await ui.type('input[type="email"]', "you@mail.test");
      await act(async () => ui.query<HTMLFormElement>("form")!.requestSubmit());
    };
    const newCode = (ui: Awaited<ReturnType<typeof mount>>) =>
      [...ui.container.querySelectorAll("button")].some((button) => button.textContent?.includes("New code"));

    const known = await mount("/results");
    try {
      await sendCodeTo(known);
      expect(known.container.textContent).toMatch(/Expires \d{2}:\d{2} · /);
      expect(newCode(known)).toBe(false);
    } finally {
      await known.unmount();
    }

    // A Worker that predates the expiry answers without it.
    send.mockResolvedValue({ success: true } as unknown as ReturnType<typeof sentCode>);
    const unknown = await mount("/results");
    try {
      await sendCodeTo(unknown);
      expect(unknown.container.textContent).toContain("Expires —");
      expect(newCode(unknown)).toBe(true);
    } finally {
      await unknown.unmount();
    }
  });
});

describe("Your wallet", () => {
  const WALLET = {
    address: "0x6c3d70a2d9197da8e24ee33ec8e26b00faccfaafe0fa9bd0003c0eb11397b4f",
    credentialId: "cred",
    publicKeyX: "0x1",
    origin: "https://realms.test",
    rpId: "realms.test",
  };
  const named = (user: Partial<Session["user"]> = {}) =>
    useIdentitySessionStore.setState({
      status: "signed-in",
      session: sessionOf({ name: "Ysolde", address: null, ...user }),
    });

  it("meets a named account with no payout wallet on any page, and makes its wallet with one passkey", async () => {
    named();
    vi.spyOn(identityClient, "readDefaultWallet").mockResolvedValue(null);
    passkeys.create.mockResolvedValue({ credentialId: "cred", publicKey: "spki" });
    const create = vi.spyOn(identityClient, "createDefaultWallet").mockResolvedValue(WALLET);
    vi.spyOn(identityClient, "getSession").mockResolvedValue(sessionOf({ name: "Ysolde", address: WALLET.address }));
    const ui = await mount("/g/0x5245414c4d53/1/map");
    try {
      expect(ui.window()?.getAttribute("aria-label")).toBe("Your wallet");
      expect(ui.container.textContent).toContain("I have a wallet");
      expect(ui.container.textContent).not.toContain("I need one");
      await act(async () =>
        [...ui.container.querySelectorAll("button")].find((b) => b.textContent === "Create my wallet")!.click(),
      );
      expect(passkeys.create).toHaveBeenCalledWith({ realmsId: "0x7", email: "you@mail.test", name: "Ysolde" });
      expect(create).toHaveBeenCalledWith({ passkey: { credentialId: "cred", publicKey: "spki" } });
      await act(async () => {});
      expect(ui.window()).toBeNull();
    } finally {
      await ui.unmount();
    }
  });

  it("asks an older sign-in for the emailed code, then makes the wallet from the same passkey", async () => {
    named({ realmsId: "0x9" });
    vi.spyOn(identityClient, "readDefaultWallet").mockResolvedValue(null);
    vi.spyOn(identityClient, "sendSignInCode").mockResolvedValue(sentCode(300));
    passkeys.create.mockResolvedValue({ credentialId: "cred", publicKey: "spki" });
    const create = vi
      .spyOn(identityClient, "createDefaultWallet")
      .mockRejectedValueOnce(new IdentityRequestError(403, "CODE_REQUIRED"))
      .mockResolvedValueOnce(WALLET);
    vi.spyOn(identityClient, "getSession").mockResolvedValue(sessionOf({ name: "Ysolde", address: WALLET.address }));
    const ui = await mount("/");
    try {
      await act(async () =>
        [...ui.container.querySelectorAll("button")].find((b) => b.textContent === "Create my wallet")!.click(),
      );
      expect(ui.container.textContent).toContain("Code sent to you@mail.test");
      await ui.type('input[autocomplete="one-time-code"]', "123456");
      // The passkey made before the code is sent again with it: the server kept nothing of it.
      expect(create).toHaveBeenLastCalledWith({ passkey: { credentialId: "cred", publicKey: "spki" }, code: "123456" });
      await act(async () => {});
      expect(ui.window()).toBeNull();
    } finally {
      await ui.unmount();
    }
  });

  it("closes for the visit when the player closes it", async () => {
    named();
    vi.spyOn(identityClient, "readDefaultWallet").mockResolvedValue(null);
    const ui = await mount("/");
    try {
      await act(async () => ui.query<HTMLButtonElement>('[role="dialog"] button[aria-label="Close"]')!.click());
      expect(ui.window()).toBeNull();
      expect(useConnectStore.getState().walletDismissed).toBe(true);
    } finally {
      await ui.unmount();
    }
  });

  it("says why when the browser cannot make a passkey, and keeps the window open", async () => {
    // Another account than the tests above, whose wallet this page already knows.
    named({ realmsId: "0x8" });
    vi.spyOn(identityClient, "readDefaultWallet").mockResolvedValue(null);
    passkeys.create.mockRejectedValue(new DOMException("cancelled", "NotAllowedError"));
    const ui = await mount("/");
    try {
      await act(async () =>
        [...ui.container.querySelectorAll("button")].find((b) => b.textContent === "Create my wallet")!.click(),
      );
      expect(ui.container.textContent).toContain("The passkey was not used. Try again.");
      expect(ui.window()?.getAttribute("aria-label")).toBe("Your wallet");
    } finally {
      await ui.unmount();
    }
  });
});

describe("Connect with a provider", () => {
  // Where the test's provider sends the page; the page stays, recording where it was sent.
  const PROVIDER = "https://accounts.google.test/o/oauth2/auth";
  const navigations = () => vi.spyOn(pageNavigation, "open").mockImplementation(() => {});
  const providerButtons = () =>
    [...document.body.querySelectorAll("button")].filter((button) => button.textContent?.startsWith("Continue with"));

  const press = async (ui: Awaited<ReturnType<typeof mount>>, label: string) => {
    await ui.ask();
    await act(async () => {});
    const button = providerButtons().find((each) => each.textContent === label)!;
    await act(async () => button.click());
  };

  it("sends the provider back to where the asker sends the player, or to this page", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["google", "discord"]);
    const start = vi.spyOn(identityClient, "socialSignInUrl").mockResolvedValue(PROVIDER);
    const left = navigations();
    const asked = await mount("/", NEXT);
    try {
      await press(asked, "Continue with Google");
      expect(start).toHaveBeenLastCalledWith("google", NEXT);
      expect(left.mock.calls).toEqual([[PROVIDER]]);
    } finally {
      await asked.unmount();
    }
    // Another visit, the first attempt abandoned.
    useConnectStore.setState({ request: null });
    forgetSocialStart();
    const here = await mount("/season?tab=frontier");
    try {
      await press(here, "Continue with Discord");
      expect(start).toHaveBeenLastCalledWith("discord", "/season?tab=frontier");
    } finally {
      await here.unmount();
    }
  });

  it("signs in with the code another browser shows when the provider finished there, and says why a code is refused", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["google", "twitter"]);
    vi.spyOn(identityClient, "socialSignInUrl").mockResolvedValue(PROVIDER);
    navigations();
    const claim = vi
      .spyOn(identityClient, "claimSocialHandoff")
      .mockRejectedValueOnce(new IdentityRequestError(400, "INVALID_OTP"))
      .mockResolvedValue(sessionOf({ name: "Ysolde", image: "04" }));
    const ui = await mount("/", NEXT);
    try {
      await press(ui, "Continue with X");
      expect(ui.window()?.getAttribute("aria-label")).toBe("X");
      expect(ui.container.textContent).toContain("Finished with X? Enter the code its page showed you.");
      await ui.type('input[autocomplete="one-time-code"]', "111111");
      await act(async () => {});
      expect(ui.container.textContent).toContain("That code is not right.");
      expect(ui.query<HTMLInputElement>('input[autocomplete="one-time-code"]')!.value).toBe("");

      await ui.type('input[autocomplete="one-time-code"]', "482913");
      await act(async () => {});
      expect(claim).toHaveBeenLastCalledWith("482913");
      expect(ui.window()).toBeNull();
      expect(ui.where()).toBe(NEXT);
    } finally {
      await ui.unmount();
    }
  });

  it("comes back on the provider's step after the page reloads while it is out, and the code finishes that attempt", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["google", "apple"]);
    const start = vi.spyOn(identityClient, "socialSignInUrl").mockResolvedValue(PROVIDER);
    navigations();
    const claim = vi
      .spyOn(identityClient, "claimSocialHandoff")
      .mockResolvedValue(sessionOf({ name: "Ysolde", image: "04" }));
    const before = await mount("/", NEXT);
    await press(before, "Continue with Apple");
    await before.unmount();
    // A reload: the page and its memory are gone; only what the browser keeps is left.
    useConnectStore.setState({ request: null, nameDismissed: false, walletDismissed: false });
    const after = await mount("/");
    try {
      expect(after.window()?.getAttribute("aria-label")).toBe("Apple");
      expect(after.container.textContent).toContain("Try Apple again");
      await after.type('input[autocomplete="one-time-code"]', "482913");
      await act(async () => {});
      expect(claim).toHaveBeenCalledWith("482913");
      expect(start).toHaveBeenCalledTimes(1);
      expect(after.window()).toBeNull();
      expect(after.where()).toBe(NEXT);
      expect(pendingSocialStart()).toBeNull();
    } finally {
      await after.unmount();
    }
  });

  it("ends a pending provider sign-in when it comes back failed, when Connect is closed, or once it is too old", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
    rememberSocialStart("google", NEXT);
    const failed = await mount("/?error=access_denied");
    try {
      await act(async () => {});
      expect(failed.window()?.getAttribute("aria-label")).toBe("Connect");
      expect(failed.container.textContent).toContain("Sign-in was cancelled.");
      expect(pendingSocialStart()).toBeNull();
    } finally {
      await failed.unmount();
    }

    rememberSocialStart("google", NEXT);
    const closed = await mount("/");
    try {
      await act(async () => closed.query<HTMLButtonElement>('button[aria-label="Close"]')!.click());
      expect(closed.window()).toBeNull();
      expect(pendingSocialStart()).toBeNull();
    } finally {
      await closed.unmount();
    }

    rememberSocialStart("google", NEXT, Date.now() - 11 * 60_000);
    const old = await mount("/");
    try {
      expect(old.window()).toBeNull();
    } finally {
      await old.unmount();
    }
  });

  it("opens with the provider's refusal when a sign-in comes back failed, and takes it off the address", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ui = await mount("/season?tab=frontier&error=access_denied");
    try {
      await act(async () => {});
      expect(ui.window()?.getAttribute("aria-label")).toBe("Connect");
      expect(ui.container.textContent).toContain("Sign-in was cancelled.");
      expect(ui.where()).toBe("/season?tab=frontier");
    } finally {
      await ui.unmount();
    }
  });

  it.each([
    { providers: [], buttons: [] },
    { providers: ["discord"], buttons: ["Continue with Discord"] },
    {
      providers: ["google", "apple", "discord", "twitter"],
      buttons: ["Continue with Google", "Continue with Apple", "Continue with Discord", "Continue with X"],
    },
  ] satisfies { providers: SocialProvider[]; buttons: string[] }[])(
    "offers exactly the configured providers, in the sheet's order: %j",
    async ({ providers, buttons }) => {
      useIdentitySessionStore.setState({ status: "anonymous", session: null });
      vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(providers);
      const view = await mount("/");
      try {
        await view.ask();
        await act(async () => {});
        expect(providerButtons().map((button) => button.textContent)).toEqual(buttons);
        expect(view.query('input[type="email"]')).not.toBeNull();
        // Most visitors from a flyer are new: the one sheet says their first sign-in is their sign-up, whichever way in.
        expect(document.body.textContent).toContain("New here? Your first sign-in creates your Realms account.");
      } finally {
        await view.unmount();
      }
    },
  );
});

describe("Connect with Discord on a phone", () => {
  const WEB =
    "https://discord.com/api/oauth2/authorize?scope=identify+email&response_type=code&client_id=42&redirect_uri=https%3A%2F%2Fid.test%2Fapi%2Fauth%2Fcallback%2Fdiscord&state=first&prompt=none";
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
  const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";

  /** An authorize answer the test lets through when it chooses, as a slow identity service would. */
  const slowAnswer = () => {
    let send!: (url: string) => void;
    let refuse!: (cause: Error) => void;
    const answer = new Promise<string>((resolve, reject) => {
      send = resolve;
      refuse = reject;
    });
    return {
      answer,
      send: (url: string) => act(async () => send(url)),
      fail: (cause: Error) => act(async () => refuse(cause)),
    };
  };
  const button = (label: string) =>
    [...document.body.querySelectorAll("button")].find((each) => each.textContent === label);
  const press = (label: string) => act(async () => button(label)!.click());
  const wait = (ms: number) => act(async () => vi.advanceTimersByTime(ms));
  const setVisibility = (state: DocumentVisibilityState) =>
    act(async () => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
      document.dispatchEvent(new Event("visibilitychange"));
    });

  /** Connect asked for on a phone, Discord offered: the window and what the page was sent to. */
  const openOn = async (userAgent: string, start: Promise<string> | string = WEB) => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["google", "discord"]);
    vi.spyOn(identityClient, "getSession").mockResolvedValue(null);
    const asked = vi.spyOn(identityClient, "socialSignInUrl").mockImplementation(async () => start);
    const opened = vi.spyOn(pageNavigation, "open").mockImplementation(() => {});
    const ui = await mount("/", NEXT);
    await ui.ask();
    await act(async () => {});
    return { ui, asked, opened };
  };

  afterEach(() => vi.useRealTimers());

  it("asks for the address as soon as Discord is offered, so the tap opens the app inside itself, even after a slow answer", async () => {
    const slow = slowAnswer();
    const { ui, asked, opened } = await openOn(IPHONE, slow.answer);
    try {
      expect(asked.mock.calls).toEqual([["discord", NEXT]]);
      await slow.send(WEB);
      act(() => {
        button("Continue with Discord")!.click();
        // Inside the tap itself: no wait between the press and the app's address.
        expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
      });
      await act(async () => {});
      expect(asked).toHaveBeenCalledTimes(1);
      expect(pendingSocialStart()?.next).toBe(NEXT);
    } finally {
      await ui.unmount();
    }
  });

  it.each([
    ["an iPhone", IPHONE],
    ["Android", ANDROID],
  ])(
    "on %s the tap opens the app straight away over the screen it was on; the code step shows only once the page comes back",
    async (_, userAgent) => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
      const { ui, opened } = await openOn(userAgent);
      const codeBoxes = () => ui.query('input[autocomplete="one-time-code"]');
      try {
        await press("Continue with Discord");
        expect(opened).toHaveBeenCalledTimes(1);
        expect(ui.window()?.getAttribute("aria-label")).toBe("Connect");
        expect(codeBoxes()).toBeNull();
        expect(button("Continue with Discord")).toBeDefined();

        // In the Discord app: the page behind it is hidden, then the player comes back without a sign-in here.
        await setVisibility("hidden");
        expect(codeBoxes()).toBeNull();
        await setVisibility("visible");
        expect(ui.window()?.getAttribute("aria-label")).toBe("Discord");
        expect(ui.container.textContent).toContain("Finished with Discord? Enter the code its page showed you.");
        expect(codeBoxes()).not.toBeNull();
        expect(button("Try Discord again")).toBeDefined();
        expect(button("Continue in browser")).toBeDefined();
        expect(opened).toHaveBeenCalledTimes(1);
      } finally {
        await ui.unmount();
      }
    },
  );

  it("while the address is on its way Discord waits, the answer opens nothing by itself, and the next tap opens the app inside itself", async () => {
    const slow = slowAnswer();
    const { ui, asked, opened } = await openOn(ANDROID, slow.answer);
    try {
      expect(button("Preparing…")?.disabled).toBe(true);
      await press("Preparing…");
      await slow.send(WEB);
      expect(opened).not.toHaveBeenCalled();
      expect(pendingSocialStart()).toBeNull();
      expect(button("Continue with Discord")?.disabled).toBe(false);
      act(() => {
        button("Continue with Discord")!.click();
        expect(opened.mock.calls).toEqual([[discordAndroidIntent(WEB)]]);
      });
      expect(asked).toHaveBeenCalledTimes(1);
    } finally {
      await ui.unmount();
    }
  });

  it("after a refused ask, a tap asks again and opens nothing; the tap after the answer opens the app inside itself", async () => {
    const slow = slowAnswer();
    const { ui, asked, opened } = await openOn(ANDROID, slow.answer);
    try {
      await slow.fail(new IdentityRequestError(503, "unavailable"));
      asked.mockImplementation(async () => WEB);
      await press("Continue with Discord");
      expect(asked).toHaveBeenCalledTimes(2);
      expect(opened).not.toHaveBeenCalled();
      act(() => {
        button("Continue with Discord")!.click();
        expect(opened.mock.calls).toEqual([[discordAndroidIntent(WEB)]]);
      });
      expect(asked).toHaveBeenCalledTimes(2);
    } finally {
      await ui.unmount();
    }
  });

  it("on the Discord step, an address grown too old is asked again by Try Discord again, and only the next tap opens it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    const { ui, asked, opened } = await openOn(ANDROID);
    const LATER = WEB.replace("state=first", "state=later");
    try {
      await press("Continue with Discord");
      await setVisibility("hidden");
      await setVisibility("visible");
      await wait(8 * 60_000);
      asked.mockImplementation(async () => LATER);
      await press("Try Discord again");
      expect(asked).toHaveBeenCalledTimes(2);
      expect(opened.mock.calls).toEqual([[discordAndroidIntent(WEB)]]);
      act(() => {
        button("Try Discord again")!.click();
        expect(opened.mock.calls).toEqual([[discordAndroidIntent(WEB)], [discordAndroidIntent(LATER)]]);
      });
    } finally {
      await ui.unmount();
    }
  });

  it("closing Connect before the iPhone's wait ends opens nothing more", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const { ui, opened } = await openOn(IPHONE);
    try {
      await press("Continue with Discord");
      await wait(APP_WAIT_MS - 1);
      await act(async () => ui.query<HTMLButtonElement>('button[aria-label="Close"]')!.click());
      expect(ui.window()).toBeNull();
      await wait(APP_WAIT_MS * 4);
      expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
      expect(pendingSocialStart()).toBeNull();
    } finally {
      await ui.unmount();
    }
  });

  it("tapping Discord again before the first wait ends opens the same attempt once, and only the latest wait goes on", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const { ui, asked, opened } = await openOn(IPHONE);
    try {
      await press("Continue with Discord");
      await wait(1000);
      await press("Continue with Discord");
      await wait(APP_WAIT_MS - 1);
      expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)], [discordAppUrl(WEB)]]);
      await wait(1);
      expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)], [discordAppUrl(WEB)], [WEB]]);
      await wait(APP_WAIT_MS * 4);
      expect(opened).toHaveBeenCalledTimes(3);
      expect(asked).toHaveBeenCalledTimes(1);
    } finally {
      await ui.unmount();
    }
  });

  it("closing Connect while a provider's address is still on its way opens nothing when it comes", async () => {
    const slow = slowAnswer();
    // A computer asks at the tap, as it always has; every provider's website goes the same way.
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["google", "discord"]);
    const asked = vi.spyOn(identityClient, "socialSignInUrl").mockReturnValue(slow.answer);
    const opened = vi.spyOn(pageNavigation, "open").mockImplementation(() => {});
    const ui = await mount("/", NEXT);
    try {
      await ui.ask();
      await act(async () => {});
      expect(asked).not.toHaveBeenCalled();
      await press("Continue with Google");
      expect(asked).toHaveBeenCalledTimes(1);
      await act(async () => ui.query<HTMLButtonElement>('button[aria-label="Close"]')!.click());
      await slow.send(WEB);
      expect(opened).not.toHaveBeenCalled();
      expect(pendingSocialStart()).toBeNull();
      expect(ui.window()).toBeNull();
    } finally {
      await ui.unmount();
    }
  });

  it("an iPhone that left and came back without Discord stays on the step, and Continue in browser opens the same attempt", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const { ui, asked, opened } = await openOn(IPHONE);
    try {
      await press("Continue with Discord");
      await setVisibility("hidden");
      await setVisibility("visible");
      await wait(APP_WAIT_MS * 4);
      expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
      expect(ui.window()?.getAttribute("aria-label")).toBe("Discord");
      expect(ui.query('input[autocomplete="one-time-code"]')).not.toBeNull();

      await press("Continue in browser");
      expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)], [WEB]]);
      expect(asked).toHaveBeenCalledTimes(1);
      expect(pendingSocialStart()?.next).toBe(NEXT);
    } finally {
      await ui.unmount();
    }
  });

  it("choosing another provider during the iPhone's wait stops Discord's website", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const GOOGLE = "https://accounts.google.test/o/oauth2/auth?state=g";
    const google = slowAnswer();
    const { ui, asked, opened } = await openOn(IPHONE);
    asked.mockImplementation(async (provider) => (provider === "google" ? google.answer : WEB));
    try {
      await press("Continue with Discord");
      await wait(1000);
      // Google's address takes longer than the iPhone's wait has left.
      await press("Continue with Google");
      await wait(APP_WAIT_MS * 4);
      expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
      await google.send(GOOGLE);
      expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)], [GOOGLE]]);
      expect(pendingSocialStart()?.provider).toBe("google");
    } finally {
      await ui.unmount();
    }
  });

  it("on Android, Continue in browser opens the website of the attempt the app was handed", async () => {
    const { ui, asked, opened } = await openOn(ANDROID);
    try {
      await press("Continue with Discord");
      await setVisibility("hidden");
      await setVisibility("visible");
      await press("Continue in browser");
      expect(opened.mock.calls).toEqual([[discordAndroidIntent(WEB)], [WEB]]);
      expect(asked).toHaveBeenCalledTimes(1);
    } finally {
      await ui.unmount();
    }
  });

  it("on a phone, another provider still opens its own website, asked for at its tap", async () => {
    const GOOGLE = "https://accounts.google.test/o/oauth2/auth?state=g";
    const { ui, asked, opened } = await openOn(ANDROID);
    asked.mockImplementation(async (provider) => (provider === "google" ? GOOGLE : WEB));
    try {
      await press("Continue with Google");
      expect(asked.mock.calls).toEqual([
        ["discord", NEXT],
        ["google", NEXT],
      ]);
      expect(opened.mock.calls).toEqual([[GOOGLE]]);
      expect(ui.window()?.getAttribute("aria-label")).toBe("Google");
      expect(button("Continue in browser")).toBeUndefined();
      expect(pendingSocialStart()?.provider).toBe("google");
    } finally {
      await ui.unmount();
    }
  });

  it("an idle start screen asks for Discord's address again before it grows old, and the tap opens the new one", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    const { ui, asked, opened } = await openOn(ANDROID);
    const RENEWED = WEB.replace("state=first", "state=renewed");
    asked.mockImplementation(async () => RENEWED);
    try {
      await wait(8 * 60_000);
      expect(asked.mock.calls).toEqual([
        ["discord", NEXT],
        ["discord", NEXT],
      ]);
      act(() => {
        button("Continue with Discord")!.click();
        expect(opened.mock.calls).toEqual([[discordAndroidIntent(RENEWED)]]);
      });
    } finally {
      await ui.unmount();
    }
  });

  it("Discord's renewal never replaces the provider the player chose: Google asked just before it still opens, once", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    const GOOGLE = "https://accounts.google.test/o/oauth2/auth?state=g";
    const google = slowAnswer();
    const { ui, asked, opened } = await openOn(ANDROID);
    asked.mockImplementation(async (provider) => (provider === "google" ? google.answer : WEB));
    try {
      await wait(8 * 60_000 - 1000);
      await press("Continue with Google");
      await wait(2000);
      await google.send(GOOGLE);
      expect(asked.mock.calls).toEqual([
        ["discord", NEXT],
        ["google", NEXT],
      ]);
      expect(opened.mock.calls).toEqual([[GOOGLE]]);
      expect(pendingSocialStart()?.provider).toBe("google");
      expect(ui.window()?.getAttribute("aria-label")).toBe("Google");
    } finally {
      await ui.unmount();
    }
  });

  it("a computer opens the identity service's address as it is, with no browser choice to add", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["google", "discord"]);
    vi.spyOn(identityClient, "socialSignInUrl").mockResolvedValue(WEB);
    const opened = vi.spyOn(pageNavigation, "open").mockImplementation(() => {});
    const ui = await mount("/", NEXT);
    try {
      await ui.ask();
      await act(async () => {});
      await press("Continue with Discord");
      expect(opened.mock.calls).toEqual([[WEB]]);
      expect(button("Continue in browser")).toBeUndefined();
    } finally {
      await ui.unmount();
    }
  });
});
