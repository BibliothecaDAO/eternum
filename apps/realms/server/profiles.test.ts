import { describe, expect, it, vi } from "vitest";

vi.mock("@realms-world/db/client", () => ({ db: {} }));
vi.mock("@realms-world/db", () => ({ user: {} }));
vi.mock("./binding", () => ({ ownerOfGameplayAccount: vi.fn() }));

import { profilesByAccounts } from "./profiles";

describe("profilesByAccounts", () => {
  it("resolves gameplay accounts to their owners once, keeps unbound addresses as owners, and applies the chosen-name rule", async () => {
    const ownerOf = vi.fn(async (account: string) =>
      account === "0xa1" ? "0x0000000000000000000000000000000000000000000000000000000000000001" : null,
    );
    const identitiesOf = vi.fn(async () => [
      { id: "0x1", name: "Redbeard", image: "03" },
      { id: "0xb2", name: "0xB2", image: null },
    ]);
    const readers = { ownerOf, identitiesOf };

    const profiles = await profilesByAccounts(["0xA1", "0xb2", "0xc3"], readers);
    expect(profiles).toEqual({
      "0xA1": { name: "Redbeard", portrait: "03" },
      "0xb2": { name: null, portrait: null },
    });
    expect(identitiesOf).toHaveBeenCalledWith(["0x1", "0xb2", "0xc3"]);

    await profilesByAccounts(["0xa1"], readers);
    // The binding is immutable: the second lookup for the bound account never asks the chain again.
    expect(ownerOf.mock.calls.filter(([account]) => account === "0xa1")).toHaveLength(1);
    // An unbound address may be bound later, so it is asked again.
    await profilesByAccounts(["0xc3"], readers);
    expect(ownerOf.mock.calls.filter(([account]) => account === "0xc3")).toHaveLength(2);
  });

  it("answers nothing for no accounts without touching the readers", async () => {
    const readers = { ownerOf: vi.fn(), identitiesOf: vi.fn() };
    await expect(profilesByAccounts([], readers)).resolves.toEqual({});
    expect(readers.identitiesOf).not.toHaveBeenCalled();
  });
});
