import type { BridgeRealm } from "@/types/ark";
import type { RowSelectionState } from "@tanstack/react-table";
import { createTable } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";

import { getRealmBridgeTableOptions, reconcileRealmBridgeSelection } from "./-realms.bridge-table";

function createBridgeTable(realms: BridgeRealm[], rowSelection: RowSelectionState) {
  return createTable({
    ...getRealmBridgeTableOptions({
      data: realms,
      onRowSelectionChange: () => undefined,
      rowSelection,
    }),
    onStateChange: () => undefined,
    renderFallbackValue: null,
  });
}

describe("Realm bridge selection", () => {
  it("keeps the same selected token when a refreshed inventory changes order", () => {
    const selection = { "3324": true };
    const before = createBridgeTable([{ token_id: 1801 }, { token_id: 3324 }], selection);
    const after = createBridgeTable([{ token_id: 1101 }, { token_id: 3324 }, { token_id: 1801 }], selection);

    expect(before.getFilteredSelectedRowModel().rows.map((row) => row.original)).toEqual([{ token_id: 3324 }]);
    expect(after.getFilteredSelectedRowModel().rows.map((row) => row.original)).toEqual([{ token_id: 3324 }]);
  });

  it("removes a selected token that disappears during refresh", () => {
    const refreshedRealms = [{ token_id: 1101 }];
    const selection = reconcileRealmBridgeSelection({ "3324": true }, refreshedRealms);
    const table = createBridgeTable(refreshedRealms, selection);

    expect(selection).toEqual({});
    expect(table.getFilteredSelectedRowModel().rows).toEqual([]);
  });
});
