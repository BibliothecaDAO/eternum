import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), getSession: vi.fn() }));
const navigateMock = mocks.navigate;
const getSessionMock = mocks.getSession;

vi.mock("../../../../env", () => ({
  env: { VITE_PUBLIC_IDENTITY_ORIGIN: "https://realms.test" },
}));

vi.mock("@realms-world/chain", () => ({
  resolveEndpoint: (value: string) => value,
}));

vi.mock("@realms-world/identity", () => ({
  createIdentityClient: () => ({ getSession: mocks.getSession }),
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

describe("LandingIdentityChip sign-in requests", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    navigateMock.mockReset();
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
});
