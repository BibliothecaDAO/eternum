import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
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

/** Resource actions need the selected structure to be the player's own, and the main phase to have begun. */
const useResourceActionsDisabled = (): boolean => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const ownsSelected = useFactView(playerStructuresView).some((structure) => structure.entityId === structureEntityId);
  const nowSeconds = useCurrentBlockTimestamp();
  return !ownsSelected || configManager.getSeasonConfig().startMainAt > nowSeconds;
};

export const EntityResourceTable = React.memo(({ entityId }: { entityId: ID | undefined }) => {
  const [useNewVersion, setUseNewVersion] = useState(() => localStorage.getItem("useNewResourceTable") === "true");
  const disableButtons = useResourceActionsDisabled();

  const [hasInteractedWithToggle, setHasInteractedWithToggle] = useState(
    () => localStorage.getItem("hasUsedResourceTableToggle") === "true",
  );

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

  const handleToggle = useCallback(
    (newValue: boolean) => {
      setUseNewVersion(newValue);
      localStorage.setItem("useNewResourceTable", String(newValue));

      if (!hasInteractedWithToggle) {
        setHasInteractedWithToggle(true);
        localStorage.setItem("hasUsedResourceTableToggle", "true");
      }
    },
    [hasInteractedWithToggle],
  );

  const TableComponent = useNewVersion ? NewTable : OldTable;

  if (!TableComponent) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {!disableButtons && (
        <div className="flex justify-center pb-2 border-b border-gold/20">
          <ViewToggle
            useNewVersion={useNewVersion}
            onToggle={handleToggle}
            showAnimation={!hasInteractedWithToggle}
            variant="full"
          />
        </div>
      )}
      <TableComponent entityId={entityId} disableButtons={disableButtons} />
    </div>
  );
});
