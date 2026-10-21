import { IDENTITY_PORTRAITS, IdentityRequestError, type Session } from "@realms-world/identity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

// The identity client binds fetch when its module loads; nothing in these tests reaches the network.
vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { setViewportWidth } from "../frame/test-viewport";
import { useRequestSignIn, useConnectStore } from "./connect";
import { TabBar } from "../frame/tabs";
import { ConnectFlow } from "./connect-flow";
import { forgetDiscordStart, pendingDiscordStart, rememberDiscordStart } from "./discord-pending";

const NEXT = "/g/0x5245414c4d53/1/map?col=4&row=9&spectate=true";

const sessionOf = (user: Partial<Session["user"]>): Session => ({
  session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
  user: { id: "u", realmsId: "0x7", name: "u", email: "you@mail.test", suggestedName: "Ysolde", image: null, ...user },
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
  const ask = () => act(async () => query<HTMLButtonElement>('[data-testid="ask"]')!.click());
  const where = () => query('[data-testid="where"]')?.textContent;
  const window = () => query('[role="dialog"]');
  return { container, query, type, ask, where, window, unmount };
};

/** The identity Worker's answer to a sent code: when it stops working, seconds from now. */
const sentCode = (seconds: number) => ({ success: true as const, expires_at: Date.now() / 1000 + seconds });

afterEach(() => {
  vi.restoreAllMocks();
  useIdentitySessionStore.setState({ status: "anonymous", session: null });
  useConnectStore.setState({ request: null, nameDismissed: false });
  forgetDiscordStart();
});

describe("Connect", () => {
  it("takes a new player from an emailed code through their name and portrait, on to where the asker sends them", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    const sendCode = vi.spyOn(identityClient, "sendSignInCode").mockResolvedValue(sentCode(300));
    vi.spyOn(identityClient, "signInWithCode").mockResolvedValue(sessionOf({}));
    const save = vi.spyOn(identityClient, "updateUser").mockResolvedValue();
    // The app's one first session load finds nobody; the refresh after the profile is saved finds the named player.
    vi.spyOn(identityClient, "getSession")
      .mockResolvedValueOnce(null)
      .mockResolvedValue(sessionOf({ name: "Ysolde", image: "04" }));
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
      const name = () => ui.query<HTMLInputElement>('input[autocomplete="nickname"]')!;
      expect(name().value).toBe("Ysolde");
      expect(name().getAttribute("aria-invalid")).toBeNull();
      const picked = ui.query('[role="radio"][aria-checked="true"]')!.getAttribute("aria-label")!;
      expect(IDENTITY_PORTRAITS.map((id) => `Portrait ${id}`)).toContain(picked);

      await ui.type('input[autocomplete="nickname"]', "Ys@lde");
      expect(name().getAttribute("aria-invalid")).toBe("true");
      expect(ui.query<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

      await ui.type('input[autocomplete="nickname"]', "Ysolde");
      await act(async () => ui.query<HTMLFormElement>("form")!.requestSubmit());
      expect(save).toHaveBeenCalledWith({ name: "Ysolde", image: picked.replace("Portrait ", "") });
      // No welcome step: the claimed name closes the window and the player goes on.
      await act(async () => {});
      expect(ui.window()).toBeNull();
      expect(ui.where()).toBe(NEXT);
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

  it("closes from its cross and leaves the page as it was", async () => {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    const ui = await mount("/results?game=2", NEXT);
    try {
      await ui.ask();
      await act(async () => ui.query<HTMLButtonElement>('button[aria-label="Close"]')!.click());
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

  it("opens by itself on the name step, on any page, for a session that has no name yet", async () => {
    useIdentitySessionStore.setState({ status: "signed-in", session: sessionOf({ image: "04" }) });
    const ui = await mount("/g/0x5245414c4d53/1/map");
    try {
      expect(ui.window()?.getAttribute("aria-label")).toBe("Your name");
      expect(ui.query<HTMLInputElement>('input[autocomplete="nickname"]')?.value).toBe("Ysolde");
      expect(ui.query('[role="radio"][aria-checked="true"]')?.getAttribute("aria-label")).toBe("Portrait 04");
    } finally {
      await ui.unmount();
    }
  });

  it("stays shut for a player who already has a name", async () => {
    useIdentitySessionStore.setState({ status: "signed-in", session: sessionOf({ name: "Ysolde", image: "04" }) });
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

describe("Connect with Discord", () => {
  // Where the test's Discord sends the page: jsdom reports the navigation as not implemented and stays.
  const DISCORD = "https://discord.test/oauth2/authorize";
  const navigations = () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    return () => errors.mock.calls.filter(([error]) => String(error).includes("navigation")).length;
  };

  const pressDiscord = async (ui: Awaited<ReturnType<typeof mount>>) => {
    await ui.ask();
    await act(async () => {});
    const discord = [...ui.container.querySelectorAll("button")].find((button) => button.textContent === "Discord")!;
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
      expect(left()).toBe(1);
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
      expect(ui.container.textContent).toContain("Discord finished in another window? Enter the code it shows.");
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
    useConnectStore.setState({ request: null, nameDismissed: false });
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
        [...view.container.querySelectorAll("button")].some((button) => button.textContent?.includes("Discord")),
      ).toBe(providers.includes("discord"));
      expect(view.query('input[type="email"]')).not.toBeNull();
    } finally {
      await view.unmount();
    }
  },
);
