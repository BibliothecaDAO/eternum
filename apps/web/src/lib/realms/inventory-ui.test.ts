import { describe, expect, it } from "vitest";

import {
  getRealmInventoryViewState,
  getRealmRowId,
  parseRealmTokenId,
  retainExistingRealmSelections,
} from "./inventory-ui";

describe("Realm inventory selection", () => {
  it("keeps a selected Realm keyed by token ID when inventory order changes", () => {
    const before = [{ token_id: 1801 }, { token_id: 3324 }];
    const after = [{ token_id: 1101 }, ...before];

    const selectedId = getRealmRowId(before[1]);

    expect(selectedId).toBe("3324");
    expect(after.find((realm) => getRealmRowId(realm) === selectedId)).toEqual({
      token_id: 3324,
    });
  });

  it("drops selections for Realms that leave the wallet", () => {
    expect(
      retainExistingRealmSelections({ "1101": true, "3324": true }, [
        { token_id: 1101 },
      ]),
    ).toEqual({ "1101": true });
  });

  it.each([undefined, "", "not-a-token", "12invalid", -1, 1.5, NaN])(
    "rejects malformed token ID %o",
    (value) => {
      expect(parseRealmTokenId(value)).toBeUndefined();
    },
  );

  it.each([3324, "3324", "0003324"])("parses token ID %o", (value) => {
    expect(parseRealmTokenId(value)).toBe(3324);
  });
});

describe("Realm inventory route state", () => {
  it.each([
    [{ isPending: true, isError: false, status: undefined }, "loading"],
    [{ isPending: false, isError: true, status: undefined }, "error"],
    [
      { isPending: false, isError: false, status: "unavailable" },
      "unavailable",
    ],
    [{ isPending: false, isError: false, status: "syncing" }, "syncing"],
    [{ isPending: false, isError: false, status: "stale" }, "stale"],
    [{ isPending: false, isError: false, status: "ready" }, "ready"],
  ] as const)("maps query state %o to %s", (input, expected) => {
    expect(getRealmInventoryViewState(input)).toBe(expected);
  });
});
