// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  canInteractWithLandingChain,
  resolveLandingNetworkState,
  resolvePreferredLandingChain,
} from "./landing-network-state";

describe("landing network state", () => {
  it("derives one shared preferred and connected state model for landing consumers", () => {
    expect(resolvePreferredLandingChain("mainnet")).toBe("mainnet");
    expect(resolvePreferredLandingChain("slot")).toBe("slot");
    expect(resolvePreferredLandingChain("slottest")).toBe("slot");

    const disconnected = resolveLandingNetworkState({
      preferredChain: "slot",
      connectedChain: null,
      hasConnectedWallet: false,
    });
    expect(disconnected.status).toBe("disconnected");
    expect(canInteractWithLandingChain(disconnected, "slot")).toBe(true);

    const detecting = resolveLandingNetworkState({
      preferredChain: "slot",
      connectedChain: null,
      hasConnectedWallet: true,
    });
    expect(detecting.status).toBe("detecting");
    expect(canInteractWithLandingChain(detecting, "slot")).toBe(false);

    const matched = resolveLandingNetworkState({
      preferredChain: "slot",
      connectedChain: "slot",
      hasConnectedWallet: true,
    });
    expect(matched.status).toBe("matched");
    expect(matched.connectedLandingChain).toBe("slot");
    expect(canInteractWithLandingChain(matched, "slot")).toBe(true);
    expect(canInteractWithLandingChain(matched, "mainnet")).toBe(false);

    const mismatched = resolveLandingNetworkState({
      preferredChain: "slot",
      connectedChain: "mainnet",
      hasConnectedWallet: true,
    });
    expect(mismatched.status).toBe("mismatched");
    expect(mismatched.connectedLandingChain).toBe("mainnet");
    expect(canInteractWithLandingChain(mismatched, "slot")).toBe(false);

    const unsupportedWalletChain = resolveLandingNetworkState({
      preferredChain: "slot",
      connectedChain: "local",
      hasConnectedWallet: true,
    });
    expect(unsupportedWalletChain.status).toBe("mismatched");
    expect(unsupportedWalletChain.connectedLandingChain).toBeNull();
  });
});
