import type { BridgeRealm } from "@/types/ark";
import type {
  OnChangeFn,
  RowSelectionState,
  TableOptions,
} from "@tanstack/react-table";
import { columns } from "@/components/modules/realms/bridge-table";
import {
  getRealmRowId,
  retainExistingRealmSelections,
} from "@/lib/realms/inventory-ui";
import { getCoreRowModel, getPaginationRowModel } from "@tanstack/react-table";

export function reconcileRealmBridgeSelection(
  selection: RowSelectionState,
  realms: BridgeRealm[],
) {
  return retainExistingRealmSelections(selection, realms);
}

export function getRealmBridgeTableOptions(input: {
  data: BridgeRealm[];
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  rowSelection: RowSelectionState;
}): TableOptions<BridgeRealm> {
  return {
    data: input.data,
    columns,
    getRowId: getRealmRowId,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: input.onRowSelectionChange,
    state: {
      rowSelection: input.rowSelection,
    },
  };
}
