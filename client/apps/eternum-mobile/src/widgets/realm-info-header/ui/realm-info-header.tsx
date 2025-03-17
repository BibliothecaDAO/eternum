import { useStore } from "@/shared/store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ProgressCircle } from "@/shared/ui/progress-circle";
import { SelectStructureDrawer } from "@/shared/ui/select-structure-drawer";
import { FELT_CENTER, getLevelName, Structure } from "@bibliothecadao/eternum";
import { usePlayerStructures } from "@bibliothecadao/react";
import { ChevronDown, Copy } from "lucide-react";
import { useMemo } from "react";

export const RealmInfoHeader = () => {
  const structures: Structure[] = usePlayerStructures();
  const { structureEntityId, setStructureEntityId } = useStore();

  const selectedStructure = structures.find((s) => s.entityId === structureEntityId);

  const adjustedCoords = useMemo(() => {
    if (!selectedStructure) return null;
    return {
      x: selectedStructure.structure.base.coord_x - FELT_CENTER,
      y: selectedStructure.structure.base.coord_y - FELT_CENTER,
    };
  }, [selectedStructure]);

  const handleCopyCoords = () => {
    if (adjustedCoords) {
      navigator.clipboard.writeText(`${adjustedCoords.x},${adjustedCoords.y}`);
    }
  };

  return (
    <div className="space-y-2">
      {/* First row */}
      <div className="flex items-center space-x-2">
        <Badge variant="secondary" className="font-mono">
          {/* TODO: Replace with actual balance */}
          1000 $LORDS
        </Badge>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {adjustedCoords ? `${adjustedCoords.x},${adjustedCoords.y}` : "No coordinates"}
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" onClick={handleCopyCoords}>
              <Copy className="h-4 w-4" />
            </Button>
          </Badge>
        </div>

        <span className="text-sm text-muted-foreground">
          #{selectedStructure?.structure.metadata.realm_id || "No realm"}
        </span>
      </div>

      {/* Second row */}
      <div className="flex items-center space-x-2">
        <div>
          <h1 className="text-5xl font-bold font-bokor flex items-end gap-2">
            <SelectStructureDrawer
              structures={structures}
              selectedStructureId={structureEntityId}
              onSelectStructure={setStructureEntityId}
            >
              <div className="flex items-center gap-2 text-4xl">
                <span>{selectedStructure?.name || "Select Structure"}</span>
                <ChevronDown className="h-6 w-6" />
              </div>
            </SelectStructureDrawer>
            <span className="text-xl font-normal text-muted-foreground">
              {selectedStructure ? getLevelName(selectedStructure.structure.base.level) : "No level"}
            </span>
          </h1>
        </div>
        <ProgressCircle progress={33} size="md">
          {(selectedStructure?.structure.base.level || 0) + 1}
        </ProgressCircle>
      </div>
    </div>
  );
};
