import { describe, expect, it, vi } from "vitest";
import { getOffchainRealm } from "./realm";

describe("getOffchainRealm", () => {
  it("loads the bundled realm dataset without a network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await vi.waitFor(() => expect(getOffchainRealm(1)).toBeDefined());

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
