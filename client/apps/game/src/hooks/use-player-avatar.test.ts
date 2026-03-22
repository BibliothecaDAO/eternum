import { describe, expect, it, vi } from "vitest";

vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_REALTIME_URL: "http://localhost:3000",
  },
}));

import { normalizeAvatarAddress } from "./use-player-avatar";

describe("normalizeAvatarAddress", () => {
  it("canonicalizes hex values to a comparable lowercase form", () => {
    expect(normalizeAvatarAddress("0x0000000000000000000000000000000000000000000000000000000000000AbC")).toBe("0xabc");
    expect(normalizeAvatarAddress("ABC")).toBe("0xabc");
    expect(normalizeAvatarAddress(0xabcn)).toBe("0xabc");
  });

  it("normalizes decimal values to hex", () => {
    expect(normalizeAvatarAddress("2748")).toBe("0xabc");
    expect(normalizeAvatarAddress(2748)).toBe("0xabc");
  });

  it("returns null for unusable values", () => {
    expect(normalizeAvatarAddress(null)).toBeNull();
    expect(normalizeAvatarAddress(undefined)).toBeNull();
    expect(normalizeAvatarAddress("")).toBeNull();
    expect(normalizeAvatarAddress(-1)).toBeNull();
  });
});
