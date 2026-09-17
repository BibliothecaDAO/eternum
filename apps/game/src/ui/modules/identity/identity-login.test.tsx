import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  signIn: vi.fn(),
  applySession: vi.fn(),
  connectors: [] as ReturnType<typeof wallet>[],
  connected: undefined as { id: string } | undefined,
  provider: {},
}));
vi.mock("@/hooks/context/identity-session", () => ({
  identityClient: { signIn: mocks.signIn },
  identityOrigin: "https://identity.test",
  useIdentitySession: () => ({ status: "anonymous", session: null }),
  useIdentitySessionStore: (select: (state: unknown) => unknown) => select({ applySession: mocks.applySession }),
}));
vi.mock("@starknet-react/core", () => ({
  useConnect: () => ({ connectAsync: mocks.connect, connectors: mocks.connectors, connector: mocks.connected }),
  useDisconnect: () => ({ disconnectAsync: mocks.disconnect }),
  useProvider: () => ({ provider: mocks.provider }),
}));
vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({ children, onClick, disabled }: ComponentProps<"button">) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));
import { IdentityLogin } from "./identity-login";
const wallet = (id: string, address: string) => {
  const signer = { address, signMessage: vi.fn().mockResolvedValue(["1", "2"]) };
  return {
    id,
    name: id,
    chainId: vi.fn().mockResolvedValue(0x534e5f4d41494en),
    account: vi.fn().mockResolvedValue(signer),
    signer,
  };
};
const button = (name: string) => [...document.querySelectorAll("button")].find((node) => node.textContent === name)!;

describe("identity wallet selection", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mocks.connected = undefined;
    mocks.connect.mockResolvedValue(undefined);
    mocks.disconnect.mockResolvedValue(undefined);
    mocks.connectors = [wallet("First wallet", "0x123"), wallet("Second wallet", "0x456")];
    mocks.signIn.mockImplementation(async ({ signTypedData, address }) => {
      await signTypedData({ message: "sign in" });
      return { user: { id: address } };
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<IdentityLogin />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  });
  it("connects and signs with the selected wallet in one click", async () => {
    await act(async () => button("Second wallet").click());
    const selected = mocks.connectors[1];
    expect(mocks.connect).toHaveBeenCalledWith({ connector: selected });
    expect(selected.account).toHaveBeenCalledWith(mocks.provider);
    expect(selected.signer.signMessage).toHaveBeenCalledOnce();
    expect(mocks.connectors[0].signer.signMessage).not.toHaveBeenCalled();
    expect(BigInt(mocks.signIn.mock.calls[0][0].address)).toBe(0x456n);
    expect(mocks.applySession).toHaveBeenCalledOnce();
  });
  it("allows another wallet after a signature rejection", async () => {
    mocks.connectors[0].signer.signMessage.mockRejectedValueOnce(new Error("Signature cancelled"));
    await act(async () => button("First wallet").click());
    expect(container.textContent).toContain("Signature cancelled");
    expect(mocks.applySession).not.toHaveBeenCalled();
    await act(async () => button("Second wallet").click());
    expect(mocks.applySession).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain("Signature cancelled");
  });
  it("allows another wallet after connection fails", async () => {
    mocks.connect.mockRejectedValueOnce(new Error("No chainId"));
    await act(async () => button("First wallet").click());
    expect(container.textContent).toContain("No chainId");
    expect(mocks.signIn).not.toHaveBeenCalled();
    await act(async () => button("Second wallet").click());
    expect(mocks.applySession).toHaveBeenCalledOnce();
  });
  it("replaces an existing connection before signing with another wallet", async () => {
    mocks.connected = mocks.connectors[0];
    await act(async () => root.render(<IdentityLogin />));
    await act(async () => button("Second wallet").click());
    expect(mocks.disconnect.mock.invocationCallOrder[0]).toBeLessThan(mocks.connect.mock.invocationCallOrder[0]);
    expect(mocks.connectors[1].signer.signMessage).toHaveBeenCalledOnce();
    expect(mocks.connectors[0].signer.signMessage).not.toHaveBeenCalled();
  });
  it("refuses the gameplay chain before requesting an identity signature", async () => {
    mocks.connectors[0].chainId.mockResolvedValue(123n);
    await act(async () => button("First wallet").click());
    expect(container.textContent).toContain("Starknet mainnet");
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(button("Second wallet").disabled).toBe(false);
  });
  it("keeps wallet choices available after verification fails", async () => {
    mocks.signIn.mockRejectedValueOnce(new Error("Verification unavailable"));
    await act(async () => button("First wallet").click());
    expect(container.textContent).toContain("Verification unavailable");
    expect(button("Second wallet").disabled).toBe(false);
    expect(mocks.applySession).not.toHaveBeenCalled();
  });
  it("does not open competing wallet requests while one is pending", async () => {
    let finish!: () => void;
    mocks.connect.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () => {
      button("First wallet").click();
      button("Second wallet").click();
    });
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(button("Second wallet").disabled).toBe(true);
    await act(async () => finish());
    expect(mocks.applySession).toHaveBeenCalledOnce();
  });
});
