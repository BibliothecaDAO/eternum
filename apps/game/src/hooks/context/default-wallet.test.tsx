import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ read: vi.fn(), realmsId: "0xa" }));
vi.mock("./identity-session", () => {
  const state = () => ({ session: { user: { realmsId: identity.realmsId } } });
  return {
    identityClient: { readDefaultWallet: identity.read },
    useIdentitySessionStore: Object.assign((select: (value: ReturnType<typeof state>) => unknown) => select(state()), {
      getState: state,
    }),
  };
});

import { noteDefaultWallet, useDefaultWallet } from "./default-wallet";

const WALLET = {
  address: "0x123",
  credentialId: "c",
  publicKeyX: "0x1",
  origin: "https://realms.test",
  rpId: "realms.test",
};

let seen: ReturnType<typeof useDefaultWallet>;
const Probe = () => {
  seen = useDefaultWallet();
  return null;
};
let root: ReturnType<typeof createRoot> | undefined;
const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement("div"));
  await act(async () => root!.render(<Probe />));
};
const unmount = async () => {
  await act(async () => root?.unmount());
  root = undefined;
};
afterEach(async () => {
  await unmount();
  identity.read.mockReset();
});

it("keeps a failed read unknown, never none, and reads again when a surface mounts", async () => {
  identity.realmsId = "0xa";
  identity.read.mockRejectedValueOnce(new Error("offline"));
  await mount();
  expect(seen.wallet).toBeUndefined();
  expect(seen.failed).toBe(true);
  await unmount();
  identity.read.mockResolvedValue(WALLET);
  await mount();
  await act(async () => {});
  expect(identity.read).toHaveBeenCalledTimes(2);
  expect(seen).toMatchObject({ wallet: WALLET, failed: false });
});

it("reads again on retry after a failure", async () => {
  identity.realmsId = "0xb";
  identity.read.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(null);
  await mount();
  expect(seen.failed).toBe(true);
  await act(async () => seen.retry());
  expect(seen).toMatchObject({ wallet: null, failed: false });
});

it("never lets an older empty read replace the wallet just made", async () => {
  identity.realmsId = "0xc";
  let finish!: (value: null) => void;
  identity.read.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  await mount();
  await act(async () => noteDefaultWallet("0xc", WALLET));
  expect(seen.wallet).toEqual(WALLET);
  await act(async () => finish(null));
  expect(seen.wallet).toEqual(WALLET);
});
