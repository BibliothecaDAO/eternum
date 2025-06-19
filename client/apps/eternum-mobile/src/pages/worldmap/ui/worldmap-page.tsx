import { useRef, useState } from "react";
import { SceneControls } from "./scene-controls";
import { ThreeCanvas, type ThreeCanvasRef } from "./three-canvas";

export function WorldmapPage() {
  const [currentScene, setCurrentScene] = useState("worldmap");
  const canvasRef = useRef<ThreeCanvasRef>(null);

  const handleSceneChange = (sceneId: string) => {
    setCurrentScene(sceneId);
    canvasRef.current?.switchScene(sceneId);
  };

  const handleCameraReset = () => {
    // Reset camera to default position
    // This would need to be implemented in the GameRenderer
    console.log("Reset camera");
  };

  const handleZoomIn = () => {
    // Zoom in functionality
    console.log("Zoom in");
  };

  const handleZoomOut = () => {
    // Zoom out functionality
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
    </div>
  );
}
