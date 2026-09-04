import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  disconnect: vi.fn(),
}));
const navigateMock = mocks.navigate;
const getSessionMock = mocks.getSession;
const signOutMock = mocks.signOut;
const disconnectMock = mocks.disconnect;

vi.mock("../../../../env", () => ({
  env: { VITE_PUBLIC_IDENTITY_ORIGIN: "https://realms.test" },
}));

vi.mock("@realms-world/chain", () => ({
  resolveEndpoint: (value: string) => value,
}));

vi.mock("@realms-world/identity", () => ({
  createIdentityClient: () => ({ getSession: mocks.getSession, signOut: mocks.signOut }),
}));

vi.mock("@starknet-react/core", () => ({
  useDisconnect: () => ({ disconnectAsync: mocks.disconnect }),
}));

vi.mock("@/audio/hooks/useAudio", () => ({
  useAudio: () => ({ play: () => Promise.resolve(null) }),
}));

vi.mock("@/ui/modules/identity/identity-login", () => ({
  IdentityLogin: () => <div data-testid="identity-login">identity login</div>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigate };
});

import { IDENTITY_POPOVER_ID, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { LandingIdentityChip } from "./landing-identity-chip";

const signedInSession = {
  session: { id: "s1", expiresAt: "2030-01-01", userId: "0x123" },
  user: { id: "0x123", name: "raschel", email: "r@example.test" },
};

const findButton = (label: string): HTMLButtonElement => {
  const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === label);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing ${label} button`);
  return button;
};

describe("LandingIdentityChip sign-in requests", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    navigateMock.mockReset();
    signOutMock.mockReset().mockResolvedValue(undefined);
    disconnectMock.mockReset().mockResolvedValue(undefined);
    getSessionMock.mockResolvedValue(null);
    useIdentitySessionStore.setState({ status: "anonymous", session: null, signInRequest: null });
    usePopoverStore.setState({ openId: null });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<LandingIdentityChip />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("opens the sign-in popover for a request and does not redirect while anonymous", async () => {
    await act(async () => {
      useIdentitySessionStore
        .getState()
        .requestSignIn({ redirectTo: "/enter/madara/aurora-blitz?intent=play", redirectState: { returnTo: "/learn" } });
    });

    expect(usePopoverStore.getState().openId).toBe(IDENTITY_POPOVER_ID);
    expect(document.querySelector('[data-testid="identity-login"]')).not.toBeNull();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("replays the requested route with its state once the session lands, then closes the popover", async () => {
    await act(async () => {
      useIdentitySessionStore
        .getState()
        .requestSignIn({ redirectTo: "/enter/madara/aurora-blitz?intent=play", redirectState: { returnTo: "/learn" } });
    });
    await act(async () => {
      useIdentitySessionStore.getState().applySession(signedInSession);
    });

    expect(navigateMock).toHaveBeenCalledWith("/enter/madara/aurora-blitz?intent=play", {
      replace: true,
      state: { returnTo: "/learn" },
    });
    expect(useIdentitySessionStore.getState().signInRequest).toBeNull();
    expect(usePopoverStore.getState().openId).toBeNull();
  });

  it("shows the session name once signed in", async () => {
    await act(async () => {
      useIdentitySessionStore.getState().applySession(signedInSession);
    });

    expect(container.textContent).toContain("raschel");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("ends the identity session before disconnecting the wallet and closing the popover", async () => {
    const operations: string[] = [];
    signOutMock.mockImplementation(async () => operations.push("identity"));
    disconnectMock.mockImplementation(async () => operations.push("wallet"));
    await act(async () => {
      useIdentitySessionStore.getState().applySession(signedInSession);
      usePopoverStore.getState().open(IDENTITY_POPOVER_ID);
    });

    await act(async () => {
      findButton("Sign out").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(operations).toEqual(["identity", "wallet"]);
    expect(useIdentitySessionStore.getState().session).toBeNull();
    expect(usePopoverStore.getState().openId).toBeNull();
  });

  it("keeps the session and wallet connected when identity sign-out fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    signOutMock.mockRejectedValue(new Error("Identity unavailable"));
    await act(async () => {
      useIdentitySessionStore.getState().applySession(signedInSession);
      usePopoverStore.getState().open(IDENTITY_POPOVER_ID);
    });

    await act(async () => {
      findButton("Sign out").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(disconnectMock).not.toHaveBeenCalled();
    expect(useIdentitySessionStore.getState().session).toEqual(signedInSession);
    expect(usePopoverStore.getState().openId).toBe(IDENTITY_POPOVER_ID);
    expect(document.body.textContent).toContain("Identity unavailable");
    expect(consoleError).toHaveBeenCalledWith("identity_sign_out_failed", { error: "Identity unavailable" });
    consoleError.mockRestore();
  });

  it("clears the signed-out session when wallet disconnect fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    disconnectMock.mockRejectedValue(new Error("Wallet unavailable"));
    await act(async () => {
      useIdentitySessionStore.getState().applySession(signedInSession);
      usePopoverStore.getState().open(IDENTITY_POPOVER_ID);
    });

    await act(async () => {
      findButton("Sign out").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(disconnectMock).toHaveBeenCalledOnce();
    expect(useIdentitySessionStore.getState().session).toBeNull();
    expect(usePopoverStore.getState().openId).toBeNull();
    expect(consoleError).toHaveBeenCalledWith("identity_sign_out_failed", { error: "Wallet unavailable" });
    consoleError.mockRestore();
  });
});
