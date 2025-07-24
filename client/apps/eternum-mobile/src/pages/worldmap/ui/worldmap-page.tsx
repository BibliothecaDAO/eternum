import { useStore } from "@/shared/store";
import { useEffect, useRef, useState } from "react";
import { SceneControls } from "./scene-controls";
import { ThreeCanvas, type ThreeCanvasRef } from "./three-canvas";

export function WorldmapPage() {
  const [currentScene, setCurrentScene] = useState("worldmap");
  const canvasRef = useRef<ThreeCanvasRef>(null);
  const { selectedRealm } = useStore();

  const handleSceneChange = (sceneId: string) => {
    setCurrentScene(sceneId);
    canvasRef.current?.switchScene(sceneId);

    if (sceneId === "worldmap" && selectedRealm) {
      canvasRef.current?.moveCameraToStructure(selectedRealm.position);
    }
  };

  useEffect(() => {
    if (selectedRealm && canvasRef.current && currentScene === "worldmap") {
      canvasRef.current.moveCameraToStructure(selectedRealm.position);
    }
  }, [selectedRealm, currentScene]);

  useEffect(() => {
    if (selectedRealm && canvasRef.current) {
      const timer = setTimeout(() => {
        canvasRef.current?.moveCameraToStructure(selectedRealm.position);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedRealm]);

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
        <ThreeCanvas ref={canvasRef} onSceneChange={setCurrentScene} className="w-full h-full" />
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
      <div id="labelrenderer" className="absolute top-0 pointer-events-none z-10" />
    </div>
  );
}
