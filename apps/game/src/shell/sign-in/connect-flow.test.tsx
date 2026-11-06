import { IDENTITY_PORTRAITS, IdentityRequestError, type Session } from "@realms-world/identity";
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
import { forgetDiscordStart, pendingDiscordStart, rememberDiscordStart } from "./discord-pending";

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
  forgetDiscordStart();
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

describe("Connect with Discord", () => {
  // Where the test's Discord sends the page; the page stays, recording where it was sent.
  const DISCORD = "https://discord.test/oauth2/authorize";
  const navigations = () => vi.spyOn(pageNavigation, "open").mockImplementation(() => {});

  const pressDiscord = async (ui: Awaited<ReturnType<typeof mount>>) => {
    await ui.ask();
    await act(async () => {});
    const discord = [...document.body.querySelectorAll("button")].find((button) => button.textContent === "Discord")!;
    await act(async () => discord.click());
  };

  it("sends Discord back to where the asker sends the player, or to this page", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["discord"]);
    const start = vi.spyOn(identityClient, "discordSignInUrl").mockResolvedValue(DISCORD);
    const left = navigations();
    const asked = await mount("/", NEXT);
    try {
      await pressDiscord(asked);
      expect(start).toHaveBeenLastCalledWith(NEXT);
      expect(left.mock.calls).toEqual([[DISCORD]]);
    } finally {
      await asked.unmount();
    }
    // Another visit, the first attempt abandoned.
    useConnectStore.setState({ request: null });
    forgetDiscordStart();
    const here = await mount("/season?tab=frontier");
    try {
      await pressDiscord(here);
      expect(start).toHaveBeenLastCalledWith("/season?tab=frontier");
    } finally {
      await here.unmount();
    }
  });

  it("signs in with the code another browser shows when Discord finished there, and says why a code is refused", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["discord"]);
    vi.spyOn(identityClient, "discordSignInUrl").mockResolvedValue(DISCORD);
    navigations();
    const claim = vi
      .spyOn(identityClient, "claimDiscordHandoff")
      .mockRejectedValueOnce(new IdentityRequestError(400, "INVALID_OTP"))
      .mockResolvedValue(sessionOf({ name: "Ysolde", image: "04" }));
    const ui = await mount("/", NEXT);
    try {
      await pressDiscord(ui);
      expect(ui.container.textContent).toContain("Discord finished elsewhere? Enter its code.");
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

  it("comes back on the Discord step after the page reloads while Discord is out, and the code finishes that attempt", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["discord"]);
    const start = vi.spyOn(identityClient, "discordSignInUrl").mockResolvedValue(DISCORD);
    navigations();
    const claim = vi
      .spyOn(identityClient, "claimDiscordHandoff")
      .mockResolvedValue(sessionOf({ name: "Ysolde", image: "04" }));
    const before = await mount("/", NEXT);
    await pressDiscord(before);
    await before.unmount();
    // A reload: the page and its memory are gone; only what the browser keeps is left.
    useConnectStore.setState({ request: null, nameDismissed: false, walletDismissed: false });
    const after = await mount("/");
    try {
      expect(after.window()?.getAttribute("aria-label")).toBe("Discord");
      await after.type('input[autocomplete="one-time-code"]', "482913");
      await act(async () => {});
      expect(claim).toHaveBeenCalledWith("482913");
      expect(start).toHaveBeenCalledTimes(1);
      expect(after.window()).toBeNull();
      expect(after.where()).toBe(NEXT);
      expect(pendingDiscordStart()).toBeNull();
    } finally {
      await after.unmount();
    }
  });

  it("ends a pending Discord sign-in when it comes back failed, when Connect is closed, or once it is too old", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
    rememberDiscordStart(NEXT);
    const failed = await mount("/?error=access_denied");
    try {
      await act(async () => {});
      expect(failed.window()?.getAttribute("aria-label")).toBe("Connect");
      expect(failed.container.textContent).toContain("Discord sign-in was cancelled.");
      expect(pendingDiscordStart()).toBeNull();
    } finally {
      await failed.unmount();
    }

    rememberDiscordStart(NEXT);
    const closed = await mount("/");
    try {
      await act(async () => closed.query<HTMLButtonElement>('button[aria-label="Close"]')!.click());
      expect(closed.window()).toBeNull();
      expect(pendingDiscordStart()).toBeNull();
    } finally {
      await closed.unmount();
    }

    rememberDiscordStart(NEXT, Date.now() - 11 * 60_000);
    const old = await mount("/");
    try {
      expect(old.window()).toBeNull();
    } finally {
      await old.unmount();
    }
  });

  it("opens with Discord's refusal when a sign-in comes back failed, and takes it off the address", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ui = await mount("/season?tab=frontier&error=access_denied");
    try {
      await act(async () => {});
      expect(ui.window()?.getAttribute("aria-label")).toBe("Connect");
      expect(ui.container.textContent).toContain("Discord sign-in was cancelled.");
      expect(ui.where()).toBe("/season?tab=frontier");
    } finally {
      await ui.unmount();
    }
  });
});

describe("Connect with Discord on a phone", () => {
  const WEB =
    "https://discord.com/api/oauth2/authorize?scope=identify+email&response_type=code&client_id=42&redirect_uri=https%3A%2F%2Fid.test%2Fapi%2Fauth%2Fcallback%2Fdiscord&state=first&prompt=none";
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
  const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";

  /** An authorize answer the test lets through when it chooses, as a slow identity service would. */
  const slowAnswer = () => {
    let send!: (url: string) => void;
    const answer = new Promise<string>((resolve) => (send = resolve));
    return { answer, send: (url: string) => act(async () => send(url)) };
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
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["discord"]);
    vi.spyOn(identityClient, "getSession").mockResolvedValue(null);
    const asked = vi.spyOn(identityClient, "discordSignInUrl").mockImplementation(async () => start);
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
      expect(asked.mock.calls).toEqual([[NEXT]]);
      await slow.send(WEB);
      act(() => {
        button("Discord")!.click();
        // Inside the tap itself: no wait between the press and the app's address.
        expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
      });
      await act(async () => {});
      expect(asked).toHaveBeenCalledTimes(1);
      expect(ui.window()?.getAttribute("aria-label")).toBe("Discord");
      expect(pendingDiscordStart()?.next).toBe(NEXT);
    } finally {
      await ui.unmount();
    }
  });

  it("a tap before the answer waits for that same ask, never a second one", async () => {
    const slow = slowAnswer();
    const { ui, asked, opened } = await openOn(ANDROID, slow.answer);
    try {
      await press("Discord");
      expect(opened).not.toHaveBeenCalled();
      await slow.send(WEB);
      expect(asked).toHaveBeenCalledTimes(1);
      expect(opened.mock.calls).toEqual([[discordAndroidIntent(WEB)]]);
    } finally {
      await ui.unmount();
    }
  });

  it("closing Connect before the iPhone's wait ends opens nothing more", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const { ui, opened } = await openOn(IPHONE);
    try {
      await press("Discord");
      await wait(APP_WAIT_MS - 1);
      await act(async () => ui.query<HTMLButtonElement>('button[aria-label="Close"]')!.click());
      expect(ui.window()).toBeNull();
      await wait(APP_WAIT_MS * 4);
      expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
      expect(pendingDiscordStart()).toBeNull();
    } finally {
      await ui.unmount();
    }
  });

  it("trying again before the first wait ends opens the same attempt once, and only the latest wait goes on", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const { ui, asked, opened } = await openOn(IPHONE);
    try {
      await press("Discord");
      await wait(1000);
      await press("Try Discord again");
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

  it("closing Connect while the address is still on its way opens nothing when it comes", async () => {
    const slow = slowAnswer();
    // A computer asks at the tap, as it always has.
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["discord"]);
    const asked = vi.spyOn(identityClient, "discordSignInUrl").mockReturnValue(slow.answer);
    const opened = vi.spyOn(pageNavigation, "open").mockImplementation(() => {});
    const ui = await mount("/", NEXT);
    try {
      await ui.ask();
      await act(async () => {});
      expect(asked).not.toHaveBeenCalled();
      await press("Discord");
      expect(asked).toHaveBeenCalledTimes(1);
      await act(async () => ui.query<HTMLButtonElement>('button[aria-label="Close"]')!.click());
      await slow.send(WEB);
      expect(opened).not.toHaveBeenCalled();
      expect(pendingDiscordStart()).toBeNull();
      expect(ui.window()).toBeNull();
    } finally {
      await ui.unmount();
    }
  });

  it("an iPhone that left and came back without Discord stays on the step, and Continue in browser opens the same attempt", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const { ui, asked, opened } = await openOn(IPHONE);
    try {
      await press("Discord");
      await setVisibility("hidden");
      await setVisibility("visible");
      await wait(APP_WAIT_MS * 4);
      expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
      expect(ui.window()?.getAttribute("aria-label")).toBe("Discord");
      expect(ui.query('input[autocomplete="one-time-code"]')).not.toBeNull();

      await press("Continue in browser");
      expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)], [WEB]]);
      expect(asked).toHaveBeenCalledTimes(1);
      expect(pendingDiscordStart()?.next).toBe(NEXT);
    } finally {
      await ui.unmount();
    }
  });

  it("choosing the browser during the iPhone's wait stops the automatic one", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const { ui, opened } = await openOn(IPHONE);
    try {
      await press("Discord");
      await wait(1000);
      await press("Continue in browser");
      await wait(APP_WAIT_MS * 4);
      expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)], [WEB]]);
    } finally {
      await ui.unmount();
    }
  });

  it("on Android, Continue in browser opens the website of the attempt the app was handed", async () => {
    const { ui, asked, opened } = await openOn(ANDROID);
    try {
      await press("Discord");
      await press("Continue in browser");
      expect(opened.mock.calls).toEqual([[discordAndroidIntent(WEB)], [WEB]]);
      expect(asked).toHaveBeenCalledTimes(1);
    } finally {
      await ui.unmount();
    }
  });

  it("a computer opens the identity service's address as it is, with no browser choice to add", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(["discord"]);
    vi.spyOn(identityClient, "discordSignInUrl").mockResolvedValue(WEB);
    const opened = vi.spyOn(pageNavigation, "open").mockImplementation(() => {});
    const ui = await mount("/", NEXT);
    try {
      await ui.ask();
      await act(async () => {});
      await press("Discord");
      expect(opened.mock.calls).toEqual([[WEB]]);
      expect(button("Continue in browser")).toBeUndefined();
    } finally {
      await ui.unmount();
    }
  });
});

it.each([{ providers: [] }, { providers: ["discord"] }])(
  "shows only configured social sign-in providers: %j",
  async ({ providers }) => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.spyOn(identityClient, "availableSignInProviders").mockResolvedValue(providers);
    const view = await mount("/");
    try {
      await view.ask();
      await act(async () => {});
      expect(
        [...document.body.querySelectorAll("button")].some((button) => button.textContent?.includes("Discord")),
      ).toBe(providers.includes("discord"));
      expect(view.query('input[type="email"]')).not.toBeNull();
      // Most visitors from a flyer are new: the one sheet says their first sign-in is their sign-up, whichever way in.
      expect(document.body.textContent).toContain("New here? Your first sign-in creates your Realms account.");
    } finally {
      await view.unmount();
    }
  },
);
