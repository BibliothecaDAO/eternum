import { useStore } from "@/shared/store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ProgressCircle } from "@/shared/ui/progress-circle";
import { SelectStructureDrawer } from "@/shared/ui/select-structure-drawer";
import { RealmLevelNames, Structure } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { ChevronDown, Copy } from "lucide-react";

export const RealmInfoHeader = () => {
  const structures: Structure[] = usePlayerStructures();
  const { structureEntityId, setStructureEntityId } = useStore();
  const {
    account: { account },
  } = useDojo();

  const selectedStructure = structures.find((s) => s.entityId === structureEntityId);

  const handleCopyCoords = () => {
    if (selectedStructure) {
      navigator.clipboard.writeText(
        `${selectedStructure.structure.base.coord_x},${selectedStructure.structure.base.coord_y}`,
      );
    }
  };

  const getRealmLevelName = (level: number) => {
    const levelMap: Record<number, keyof typeof RealmLevelNames> = {
      0: "Settlement",
      1: "City",
      2: "Kingdom",
      3: "Empire",
    };
    return RealmLevelNames[levelMap[level] || "Settlement"];
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
            {selectedStructure
              ? `${selectedStructure.structure.base.coord_x},${selectedStructure.structure.base.coord_y}`
              : "No coordinates"}
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
              {selectedStructure ? getRealmLevelName(selectedStructure.structure.base.level) : "No level"}
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
