import { usePersistentCanvas } from "@/app/ui/layout";
import { UnifiedArmyCreationDrawer } from "@/features/armies/ui/unified-army-creation-drawer";
import { useStore } from "@/shared/store";
import { AttackDrawer } from "@/widgets/attack-drawer";
import { ChestDrawer } from "@/widgets/chest-drawer/ui/chest-drawer";
import { HexEntityDetailsDrawer } from "@/widgets/hex-entity-details-drawer";
import { TransferDrawer } from "@/widgets/transfer-drawer";
import { useCallback, useEffect, useState } from "react";
import { SceneControls } from "./scene-controls";

export function WorldmapPage() {
  const [currentScene, setCurrentScene] = useState("worldmap");
  const { canvasRef, isCanvasReady } = usePersistentCanvas();
  const {
    selectedHex,
    isDoubleClickedObject,
    isChestDrawerOpen,
    chestDrawerData,
    closeChestDrawer,
    resetDoubleClickState,
    isArmyCreationDrawerOpen,
    armyCreationDrawerData,
    closeArmyCreationDrawer,
    isAttackDrawerOpen,
    attackDrawerData,
    closeAttackDrawer,
  } = useStore();
  const [hexDrawerOpen, setHexDrawerOpen] = useState(false);

  const handleSceneChange = useCallback(
    async (sceneId: string) => {
      setCurrentScene(sceneId);
      canvasRef.current?.switchScene(sceneId);
    },
    [canvasRef],
  );

  // Ensure worldmap scene is active when component mounts (only once)
  useEffect(() => {
    if (isCanvasReady && canvasRef.current && currentScene !== "worldmap") {
      canvasRef.current.switchScene("worldmap");
      setCurrentScene("worldmap");
    }
  }, [isCanvasReady, currentScene, canvasRef]);

  // Open hex drawer only when an object is double-clicked
  useEffect(() => {
    if (selectedHex && isDoubleClickedObject) {
      setHexDrawerOpen(true);
    }
  }, [selectedHex, isDoubleClickedObject]);

  const handleCameraReset = useCallback(() => {
    console.log("Reset camera");
  }, []);

  const handleZoomIn = useCallback(() => {
    console.log("Zoom in");
  }, []);

  const handleZoomOut = useCallback(() => {
    console.log("Zoom out");
  }, []);

  const handleHexDrawerClose = useCallback(
    (open: boolean) => {
      setHexDrawerOpen(open);
      if (!open) {
        // Reset only the double-click state when drawer is closed, keep the selection
        resetDoubleClickState();
      }
    },
    [resetDoubleClickState],
  );

  return (
    <>
      {/* Scene Controls */}
      <SceneControls
        currentScene={currentScene}
        onSceneChange={handleSceneChange}
        onCameraReset={handleCameraReset}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        canvasRef={canvasRef}
      />

      {/* Bottom spacing for footer */}
      <div className="h-20" />

      {/* Chest Drawer */}
      {isChestDrawerOpen && chestDrawerData.explorerEntityId && chestDrawerData.chestHex && (
        <ChestDrawer
          explorerEntityId={chestDrawerData.explorerEntityId}
          chestHex={chestDrawerData.chestHex}
          open={isChestDrawerOpen}
          onOpenChange={(open) => !open && closeChestDrawer()}
        />
      )}

      {/* Army Creation Drawer */}
      {isArmyCreationDrawerOpen && armyCreationDrawerData.structureId && (
        <UnifiedArmyCreationDrawer
          isOpen={isArmyCreationDrawerOpen}
          onOpenChange={(open) => !open && closeArmyCreationDrawer()}
          structureId={armyCreationDrawerData.structureId}
          direction={armyCreationDrawerData.direction || undefined}
          isExplorer={armyCreationDrawerData.isExplorer}
          onSuccess={() => closeArmyCreationDrawer()}
        />
      )}

      {/* Hex Entity Details Drawer */}
      <HexEntityDetailsDrawer open={hexDrawerOpen} onOpenChange={handleHexDrawerClose} />

      {/* Transfer Drawer */}
      <TransferDrawer />

      {/* Attack Drawer */}
      {isAttackDrawerOpen && attackDrawerData.attackerEntityId && attackDrawerData.targetHex && (
        <AttackDrawer
          open={isAttackDrawerOpen}
          onOpenChange={(open) => !open && closeAttackDrawer()}
          attackerEntityId={attackDrawerData.attackerEntityId}
          targetHex={attackDrawerData.targetHex}
        />
      )}
    </>
  );
}
