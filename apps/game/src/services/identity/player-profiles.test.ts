import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/context/identity-session", () => ({ identityOrigin: "https://app.test" }));
import { createIdentityProfiles } from "./player-profiles";

describe("identity profiles", () => {
  it("asks once per address, keys answers by normalized address, and wakes listeners when they land", async () => {
    const fetchProfiles = vi.fn(async (accounts: string[]) =>
      Object.fromEntries(accounts.map((account) => [account, { name: `lord-${account}`, portrait: "04" }])),
    );
    const profiles = createIdentityProfiles({ fetchProfiles });
    const listener = vi.fn();
    profiles.subscribe(listener);

    profiles.request(["0x0A", 0x0bn]);
    profiles.request(["0xa", "0xc"]);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(2));
    expect(fetchProfiles.mock.calls.map(([accounts]) => accounts)).toEqual([["0xa", "0xb"], ["0xc"]]);
    expect(profiles.get("0x0a")).toEqual({ name: "lord-0xa", portrait: "04" });
    expect(profiles.get(0xcn)?.name).toBe("lord-0xc");
    profiles.request(["0xa"]);
    expect(fetchProfiles).toHaveBeenCalledTimes(2);
  });

  it("forgets a failed batch so the addresses are asked again", async () => {
    const fetchProfiles = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ "0x1": { name: null, portrait: "02" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const profiles = createIdentityProfiles({ fetchProfiles });
    profiles.request(["0x1"]);
    await vi.waitFor(() => expect(fetchProfiles).toHaveBeenCalledTimes(1));
    profiles.request(["0x1"]);
    await vi.waitFor(() => expect(profiles.get("0x1")).toEqual({ name: null, portrait: "02" }));
  });
});
