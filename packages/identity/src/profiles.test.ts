import { describe, expect, it, vi } from "vitest";
import { fetchIdentityProfiles, hasChosenIdentityName, profileOfIdentityUser } from "./profiles";

describe("identity profiles", () => {
  it("reads a name as chosen only once it differs from the address it defaulted to", () => {
    expect(hasChosenIdentityName({ id: "0xabc", name: "0xABC" })).toBe(false);
    expect(hasChosenIdentityName({ id: "0xabc", name: "Redbeard" })).toBe(true);
    expect(profileOfIdentityUser({ id: "0xabc", name: "0xabc", image: "03" })).toEqual({ name: null, portrait: "03" });
    expect(profileOfIdentityUser({ id: "0xabc", name: "Redbeard" })).toEqual({ name: "Redbeard", portrait: null });
  });

  it("fetches one public batch keyed by the accounts as sent", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        profiles: { "0x1": { name: "Redbeard", portrait: "03" }, "0x2": { name: null, portrait: null } },
      }),
    );
    await expect(fetchIdentityProfiles("https://app.realms.party", ["0x1", "0x2"], fetch)).resolves.toEqual({
      "0x1": { name: "Redbeard", portrait: "03" },
      "0x2": { name: null, portrait: null },
    });
    expect(fetch).toHaveBeenCalledWith("https://app.realms.party/api/profiles?accounts=0x1,0x2");
    await expect(fetchIdentityProfiles("https://app.realms.party", [], fetch)).resolves.toEqual({});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
