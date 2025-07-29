import { useStore } from "@/shared/store";
import { useEffect, useRef, useState } from "react";
import { SceneControls } from "./scene-controls";
import { ThreeCanvas, type ThreeCanvasRef } from "./three-canvas";

export function WorldmapPage() {
  const [currentScene, setCurrentScene] = useState("worldmap");
  const canvasRef = useRef<ThreeCanvasRef>(null);
  const { selectedRealm } = useStore();
  const [isCanvasReady, setIsCanvasReady] = useState(false);

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

  const handleCameraReset = () => {
    console.log("Reset camera");
  };

  const handleZoomIn = () => {
    console.log("Zoom in");
  };

  const handleZoomOut = () => {
    console.log("Zoom out");
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
    </div>
  );
}
