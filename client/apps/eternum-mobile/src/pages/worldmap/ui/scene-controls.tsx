import { DEFAULT_SCENES } from "@/shared/lib/three/constants";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Map, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

interface SceneControlsProps {
  currentScene: string;
  onSceneChange: (sceneId: string) => void;
  onCameraReset?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  className?: string;
}

export function SceneControls({
  currentScene,
  onSceneChange,
  onCameraReset,
  onZoomIn,
  onZoomOut,
  className,
}: SceneControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const currentSceneConfig = DEFAULT_SCENES.find((scene) => scene.id === currentScene);

  return (
    <div className={`fixed top-4 left-4 right-4 z-20 ${className}`}>
      <Card className="p-3 bg-background/95 backdrop-blur-md border-border/50">
        {/* Main Controls Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Scene Selector */}
          <div className="flex-1">
            <Select value={currentScene} onValueChange={onSceneChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <Map size={14} />
                    <span>{currentSceneConfig?.name || "Select Scene"}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_SCENES.map((scene) => (
                  <SelectItem key={scene.id} value={scene.id}>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">{scene.name}</span>
                      {scene.description && <span className="text-xs text-muted-foreground">{scene.description}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Camera Controls */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={onZoomOut} className="h-8 w-8 p-0" title="Zoom Out">
              <ZoomOut size={14} />
            </Button>

            <Button variant="outline" size="sm" onClick={onZoomIn} className="h-8 w-8 p-0" title="Zoom In">
              <ZoomIn size={14} />
            </Button>

            <Button variant="outline" size="sm" onClick={onCameraReset} className="h-8 w-8 p-0" title="Reset Camera">
              <RotateCcw size={14} />
            </Button>
          </div>

          {/* Expand/Collapse Button */}
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-8 w-8 p-0">
            <span className="text-xs">{isExpanded ? "−" : "+"}</span>
          </Button>
        </div>

        {/* Expanded Info */}
        {isExpanded && currentSceneConfig?.description && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">{currentSceneConfig.description}</p>
          </div>
        )}
      </Card>

      {/* Touch Gesture Hints */}
      <div className="mt-2 text-center">
        <div className="inline-flex items-center gap-4 px-3 py-1 bg-background/80 backdrop-blur-sm rounded-full text-xs text-muted-foreground">
          <span>👆 Pan</span>
          <span>🤏 Zoom</span>
        </div>
      </div>
    </div>
  );
}
