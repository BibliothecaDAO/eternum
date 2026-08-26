import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let accountValue: unknown = null;
const navigateMock = vi.fn();
const setModalMock = vi.fn();

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (selector: (state: { account: unknown }) => unknown) => selector({ account: accountValue }),
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (selector: (state: { setModal: typeof setModalMock }) => unknown) => selector({ setModal: setModalMock }),
}));

vi.mock("@/ui/modules/identity/identity-login", () => ({
  IdentityLogin: () => <div data-testid="identity-login">identity login</div>,
}));

vi.mock("@/ui/design-system/molecules/dialog-shell", () => ({
  DialogShell: ({ children }: { children: ReactNode }) => <div data-testid="dialog-shell">{children}</div>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({
      pathname: "/markets",
      search: "?status=live",
      hash: "",
      state: null,
      key: "test",
    }),
  };
});

import { SignInPromptModal } from "./sign-in-prompt-modal";

describe("SignInPromptModal redirect state", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    accountValue = null;
    navigateMock.mockReset();
    setModalMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("does not redirect while the gameplay account is unresolved", async () => {
    await act(async () => {
      root.render(
        <SignInPromptModal
          redirectTo="/enter/madara/aurora-blitz?intent=play"
          redirectState={{ returnTo: "/learn?ref=hero" }}
        />,
      );
    });

    expect(setModalMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("replays the original landing route state when sign-in finishes", async () => {
    await act(async () => {
      root.render(
        <SignInPromptModal
          redirectTo="/enter/madara/aurora-blitz?intent=play"
          redirectState={{ returnTo: "/learn?ref=hero" }}
        />,
      );
    });

    expect(navigateMock).not.toHaveBeenCalled();

    accountValue = { address: "0x123" };

    await act(async () => {
      root.render(
        <SignInPromptModal
          redirectTo="/enter/madara/aurora-blitz?intent=play"
          redirectState={{ returnTo: "/learn?ref=hero" }}
        />,
      );
    });

    expect(setModalMock).toHaveBeenCalledWith(null, false);
    expect(navigateMock).toHaveBeenCalledWith("/enter/madara/aurora-blitz?intent=play", {
      replace: true,
      state: { returnTo: "/learn?ref=hero" },
    });
  });
});
