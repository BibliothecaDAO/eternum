import { UnifiedArmyCreationDrawer } from "@/features/armies/ui/unified-army-creation-drawer";
import { useStore } from "@/shared/store";
import { ChestDrawer } from "@/widgets/chest-drawer/ui/chest-drawer";
import { HexEntityDetailsDrawer } from "@/widgets/hex-entity-details-drawer";
import { useEffect, useRef, useState } from "react";
import { SceneControls } from "./scene-controls";
import { ThreeCanvas, type ThreeCanvasRef } from "./three-canvas";

export function WorldmapPage() {
  const [currentScene, setCurrentScene] = useState("worldmap");
  const canvasRef = useRef<ThreeCanvasRef>(null);
  const { 
    selectedRealm, 
    selectedHex, 
    isDoubleClickedObject, 
    isChestDrawerOpen, 
    chestDrawerData, 
    closeChestDrawer, 
    resetDoubleClickState,
    isArmyCreationDrawerOpen,
    armyCreationDrawerData,
    closeArmyCreationDrawer
  } = useStore();
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [hexDrawerOpen, setHexDrawerOpen] = useState(false);

  const handleSceneChange = (sceneId: string) => {
    setCurrentScene(sceneId);
    canvasRef.current?.switchScene(sceneId);

    if (sceneId === "worldmap" && selectedRealm) {
      canvasRef.current?.moveCameraToStructure(selectedRealm.position);
    }
  };

  const handleCanvasReady = () => {
    setIsCanvasReady(true);

    // Move camera to selected realm after canvas is ready (hot reload case)
    if (selectedRealm && currentScene === "worldmap") {
      setTimeout(() => {
        canvasRef.current?.moveCameraToStructure(selectedRealm.position);
      }, 100);
    }
  };

  useEffect(() => {
    if (selectedRealm && canvasRef.current && currentScene === "worldmap" && isCanvasReady) {
      canvasRef.current.moveCameraToStructure(selectedRealm.position);
    }
  }, [selectedRealm, currentScene, isCanvasReady]);

  // Open hex drawer only when an object is double-clicked
  useEffect(() => {
    if (selectedHex && isDoubleClickedObject) {
      setHexDrawerOpen(true);
    }
  }, [selectedHex, isDoubleClickedObject]);

  const handleCameraReset = () => {
    console.log("Reset camera");
  };

  const handleZoomIn = () => {
    console.log("Zoom in");
  };

  const handleZoomOut = () => {
    console.log("Zoom out");
  };

  const handleHexDrawerClose = (open: boolean) => {
    setHexDrawerOpen(open);
    if (!open) {
      // Reset only the double-click state when drawer is closed, keep the selection
      resetDoubleClickState();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Three.js Canvas */}
      <div className="absolute inset-0">
        <ThreeCanvas
          ref={canvasRef}
          onSceneChange={setCurrentScene}
          onReady={handleCanvasReady}
          className="w-full h-full"
        />
      </div>

      {/* Scene Controls */}
      <SceneControls
        currentScene={currentScene}
        onSceneChange={handleSceneChange}
        onCameraReset={handleCameraReset}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
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
    </div>
  );
}
