import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const bind = vi.fn();
  const rotate = vi.fn();
  return {
    assertGameplayAccountClassDeclared: vi.fn(),
    bind,
    rotate,
    configureGameplayAccountSubmits: vi.fn(),
    createGameplayAccountApi: vi.fn(() => ({ bind, rotate })),
    ensureGameplayAccount: vi.fn(),
    getCachedRpcProvider: vi.fn(),
    getOrCreateGameplayKey: vi.fn(),
    getSession: vi.fn(),
    getStoredGameplayKey: vi.fn(),
    readBoundGameplayAccount: vi.fn(),
    readGameplayAccountPublicKey: vi.fn(),
    setGameplayAccount: vi.fn(),
  };
});

vi.mock("../../../env", () => ({
  env: { VITE_PUBLIC_IDENTITY_ORIGIN: "https://realms.test" },
}));

vi.mock("@/account/gameplay-account-submit", () => ({
  configureGameplayAccountSubmits: mocks.configureGameplayAccountSubmits,
}));

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (selector: (state: { setGameplayAccount: typeof mocks.setGameplayAccount }) => unknown) =>
    selector({ setGameplayAccount: mocks.setGameplayAccount }),
}));

vi.mock("@/runtime/world/world-directory", () => ({
  getDefaultWorld: () => ({
    chain: "madara",
    rpcUrl: "https://rpc.realms.test/rpc/v0_9_0",
    bindingAuthorityAddress: "0x1",
    playerAccountClassHash: "0x2",
    playerRegistryAddress: "0x3",
  }),
}));

vi.mock("@/utils/cached-rpc-provider", () => ({
  getCachedRpcProvider: mocks.getCachedRpcProvider,
}));

vi.mock("@bibliothecadao/eternum", () => ({
  assertGameplayAccountClassDeclared: mocks.assertGameplayAccountClassDeclared,
  connectGameplayAccount: vi.fn(),
  createGameplayAccountApi: mocks.createGameplayAccountApi,
  ensureGameplayAccount: mocks.ensureGameplayAccount,
  getOrCreateGameplayKey: mocks.getOrCreateGameplayKey,
  getStoredGameplayKey: mocks.getStoredGameplayKey,
  readBoundGameplayAccount: mocks.readBoundGameplayAccount,
  readGameplayAccountPublicKey: mocks.readGameplayAccountPublicKey,
}));

vi.mock("@realms-world/chain", () => ({
  resolveEndpoint: (value: string) => value,
}));

vi.mock("@realms-world/identity", () => ({
  createIdentityClient: () => ({ getSession: mocks.getSession }),
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: () => ({ address: undefined }),
}));

import { GameplayAccountSync } from "./gameplay-account-sync";
import { useIdentitySessionStore } from "./identity-session";
import type { Session } from "@realms-world/identity";

describe("GameplayAccountSync", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
    window.history.replaceState({}, "", "/play/madara/iron-age/map?spectate=true");
    Object.values(mocks).forEach((mock) => mock.mockClear());
    mocks.getSession.mockResolvedValue(null);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    act(() => useIdentitySessionStore.getState().applySession(null));
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("does not deploy an account or create a gameplay key for an unauthenticated spectator", async () => {
    await act(async () => {
      root.render(<GameplayAccountSync>spectating</GameplayAccountSync>);
    });
    await vi.waitFor(() => expect(mocks.getSession).toHaveBeenCalledOnce());

    expect(mocks.getCachedRpcProvider).not.toHaveBeenCalled();
    expect(mocks.ensureGameplayAccount).not.toHaveBeenCalled();
    expect(mocks.getOrCreateGameplayKey).not.toHaveBeenCalled();
    expect(mocks.configureGameplayAccountSubmits).not.toHaveBeenCalled();
    expect(mocks.setGameplayAccount).toHaveBeenCalledWith(null, null);
    expect(Object.keys(localStorage).filter((key) => key.startsWith("realms:gameplay-key"))).toEqual([]);
  });

  it("provisions and binds from the landing for a signed-in identity with no entered world", async () => {
    window.history.replaceState({}, "", "/");
    const deployedAccount = { address: "0x9" };
    const configuredAccount = { address: "0x9", configured: true };
    mocks.getCachedRpcProvider.mockReturnValue({ getChainId: vi.fn().mockResolvedValue("0x11") });
    mocks.assertGameplayAccountClassDeclared.mockResolvedValue(undefined);
    mocks.getStoredGameplayKey.mockReturnValue(null);
    mocks.getOrCreateGameplayKey.mockReturnValue({ privateKey: "0xk", publicKey: "0xp" });
    mocks.readBoundGameplayAccount.mockResolvedValue(null);
    mocks.ensureGameplayAccount.mockResolvedValue(deployedAccount);
    mocks.configureGameplayAccountSubmits.mockReturnValue(configuredAccount);

    await act(async () => {
      root.render(<GameplayAccountSync>landing</GameplayAccountSync>);
    });
    act(() => {
      useIdentitySessionStore.getState().applySession({ user: { id: "0xabc" } } as Session);
    });

    await vi.waitFor(() => expect(mocks.bind).toHaveBeenCalledWith("0x9", "0xp"));
    expect(mocks.ensureGameplayAccount).toHaveBeenCalledWith(
      expect.objectContaining({ authority: "0x1", classHash: "0x2", owner: "0xabc" }),
    );
    expect(mocks.setGameplayAccount).toHaveBeenLastCalledWith(configuredAccount, expect.stringMatching(/0x0*abc$/));
  });
});
