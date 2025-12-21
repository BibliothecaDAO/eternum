import { useResourceBalances } from "@/features/resource-balances/model/use-resource-balances";
import { useStructureUpgrade } from "@/features/upgrade-structure/model/use-structure-upgrade";
import { currencyFormat } from "@/shared/lib/utils";
import { useStore } from "@/shared/store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ProgressCircle } from "@/shared/ui/progress-circle";
import { SelectStructureDrawer } from "@/shared/ui/select-structure-drawer";
import { FELT_CENTER as getFeltCenterOffset, getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import { usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo } from "@bibliothecadao/react";
import { getLevelName, ResourcesIds } from "@bibliothecadao/types";
import { ChevronDown, Copy } from "lucide-react";
import { useMemo } from "react";

export const RealmInfoHeader = () => {
  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();

  const playerRealmsAndVillages = useMemo(() => {
    return [...playerRealms, ...playerVillages];
  }, [playerRealms, playerVillages]);

  const { structureEntityId, selectedRealm, setSelectedStructure } = useStore();

  // Get LORDS balance
  const { resourceAmounts } = useResourceBalances(structureEntityId);
  const lordsBalance = useMemo(() => {
    const lordsResource = resourceAmounts.find((resource) => resource.id === ResourcesIds.Lords);
    return lordsResource?.amount || 0;
  }, [resourceAmounts]);

  // Get level progress
  const { upgradeProgress } = useStructureUpgrade(structureEntityId);

  const FELT_CENTER = getFeltCenterOffset();
  const adjustedCoords = useMemo(() => {
    if (!selectedRealm) return null;
    return {
      x: selectedRealm.position.x - FELT_CENTER,
      y: selectedRealm.position.y - FELT_CENTER,
    };
  }, [selectedRealm]);

  const handleCopyCoords = () => {
    if (adjustedCoords) {
      navigator.clipboard.writeText(`${adjustedCoords.x},${adjustedCoords.y}`);
    }
  };

  const isBlitz = getIsBlitz();
  return (
    <div className="space-y-2">
      {/* First row */}
      <div className="flex items-center space-x-2">
        <Badge variant="secondary" className="font-mono">
          {currencyFormat(lordsBalance)} $LORDS
        </Badge>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {adjustedCoords ? `${adjustedCoords.x},${adjustedCoords.y}` : "No coordinates"}
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" onClick={handleCopyCoords}>
              <Copy className="h-4 w-4" />
            </Button>
          </Badge>
        </div>

        <span className="text-sm text-muted-foreground">#{selectedRealm?.realmId || selectedRealm?.entityId}</span>
      </div>

      {/* Second row */}
      <div className="flex items-center space-x-2">
        <div>
          <h1 className="text-5xl font-bold font-bokor flex items-end gap-2">
            <SelectStructureDrawer
              structures={playerRealmsAndVillages}
              selectedStructureId={structureEntityId}
              onSelectStructure={(entityId) => {
                const realm = playerRealmsAndVillages.find((r) => r.entityId === entityId);
                setSelectedStructure(realm || null);
              }}
            >
              <div className="flex items-center gap-2 text-4xl">
                <span>
                  {selectedRealm ? getStructureName(selectedRealm?.structure, isBlitz).name : "Select Structure"}
                </span>
                <ChevronDown className="h-6 w-6" />
              </div>
            </SelectStructureDrawer>
            <span className="text-xl font-normal text-muted-foreground">
              {selectedRealm ? getLevelName(selectedRealm.level) : "No level"}
            </span>
          </h1>
        </div>
        <ProgressCircle progress={upgradeProgress} size="md">
          {(selectedRealm?.level || 0) + 1}
        </ProgressCircle>
      </div>
    </div>
  );
};
