import { describe, expect, it } from "vitest";

import { defaultNameCandidates } from "./default-name";

describe("a new account's default names", () => {
  it("tries the Discord name, then numbers it", () => {
    expect(defaultNameCandidates("nelly_b")).toEqual(["nelly_b", "nelly_b2", "nelly_b3", "nelly_b4", "nelly_b5"]);
  });

  it("stays within the name's length, numbered forms included", () => {
    const names = defaultNameCandidates("Aelinor of the Weste");
    expect(names[0]).toBe("Aelinor of the Weste");
    expect(names[1]).toBe("Aelinor of the West2");
    expect(names.every((name) => name.length <= 20)).toBe(true);
  });

  it("has none for an email sign-up, which is suggested nothing", () => {
    expect(defaultNameCandidates(null)).toEqual([]);
    expect(defaultNameCandidates("")).toEqual([]);
  });
});
