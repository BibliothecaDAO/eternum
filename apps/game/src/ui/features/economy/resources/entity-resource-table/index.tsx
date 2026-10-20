import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { configManager } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";
import React, { useCallback, useEffect, useState } from "react";
import { ViewToggle } from "./view-toggle";

type TableComponent = React.ComponentType<{
  entityId: ID | undefined;
  disableButtons?: boolean;
}>;

/** Resource actions need the holding shown to be the player's own, and the main phase to have begun. */
const useResourceActionsDisabled = (entityId: ID | undefined): boolean => {
  const ownsShown = useFactView(playerStructuresView).some((structure) => structure.entityId === entityId);
  const nowSeconds = useCurrentBlockTimestamp();
  return !ownsShown || configManager.getSeasonConfig().startMainAt > nowSeconds;
};

export const EntityResourceTable = React.memo(({ entityId }: { entityId: ID | undefined }) => {
  const [useNewVersion, setUseNewVersion] = useState(() => localStorage.getItem("useNewResourceTable") === "true");
  const disableButtons = useResourceActionsDisabled(entityId);

  const [OldTable, setOldTable] = useState<TableComponent | null>(null);
  const [NewTable, setNewTable] = useState<TableComponent | null>(null);

  useEffect(() => {
    if (useNewVersion && !NewTable) {
      import("./entity-resource-table-new").then((module) => {
        setNewTable(() => module.EntityResourceTableNew);
      });
    } else if (!useNewVersion && !OldTable) {
      import("./entity-resource-table-old").then((module) => {
        setOldTable(() => module.EntityResourceTableOld);
      });
    }
  }, [useNewVersion, OldTable, NewTable]);

  const handleToggle = useCallback((newValue: boolean) => {
    setUseNewVersion(newValue);
    localStorage.setItem("useNewResourceTable", String(newValue));
  }, []);

  const TableComponent = useNewVersion ? NewTable : OldTable;

  if (!TableComponent) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {!disableButtons && (
        <div className="flex justify-center border-b border-hud-divider pb-2">
          <ViewToggle useNewVersion={useNewVersion} onToggle={handleToggle} />
        </div>
      )}
      <TableComponent entityId={entityId} disableButtons={disableButtons} />
    </div>
  );
});
