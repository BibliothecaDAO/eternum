import { useUIStore } from "@/hooks/store/use-ui-store";
import { ID } from "@bibliothecadao/types";
import React, { useCallback, useEffect, useState } from "react";
import { ViewToggle } from "./view-toggle";

type TableComponent = React.ComponentType<{
  entityId: ID | undefined;
  disableButtons?: boolean;
}>;

export const EntityResourceTable = React.memo(({ entityId }: { entityId: ID | undefined }) => {
  const [useNewVersion, setUseNewVersion] = useState(() => localStorage.getItem("useNewResourceTable") === "true");
  const disableButtons = useUIStore((state) => state.disableButtons);

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
