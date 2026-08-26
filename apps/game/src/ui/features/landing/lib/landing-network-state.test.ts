// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  canInteractWithLandingChain,
  resolveLandingNetworkState,
  resolvePreferredLandingChain,
} from "./landing-network-state";

describe("landing network state", () => {
  it("derives one shared preferred and connected state model for landing consumers", () => {
    expect(resolvePreferredLandingChain("madara")).toBe("madara");
    expect(resolvePreferredLandingChain("appchain")).toBe("appchain");

    const disconnected = resolveLandingNetworkState({
      preferredChain: "appchain",
      connectedChain: null,
      hasConnectedWallet: false,
    });
    expect(disconnected.status).toBe("disconnected");
    expect(canInteractWithLandingChain(disconnected, "appchain")).toBe(true);

    const detecting = resolveLandingNetworkState({
      preferredChain: "appchain",
      connectedChain: null,
      hasConnectedWallet: true,
    });
    expect(detecting.status).toBe("detecting");
    expect(canInteractWithLandingChain(detecting, "appchain")).toBe(false);

    const matched = resolveLandingNetworkState({
      preferredChain: "appchain",
      connectedChain: "appchain",
      hasConnectedWallet: true,
    });
    expect(matched.status).toBe("matched");
    expect(matched.connectedLandingChain).toBe("appchain");
    expect(canInteractWithLandingChain(matched, "appchain")).toBe(true);
    expect(canInteractWithLandingChain(matched, "madara")).toBe(false);

    const mismatched = resolveLandingNetworkState({
      preferredChain: "appchain",
      connectedChain: "madara",
      hasConnectedWallet: true,
    });
    expect(mismatched.status).toBe("mismatched");
    expect(mismatched.connectedLandingChain).toBe("madara");
    expect(canInteractWithLandingChain(mismatched, "appchain")).toBe(false);
  });
});
