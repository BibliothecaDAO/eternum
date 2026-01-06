import { DEFAULT_SCENES } from "@/shared/lib/three/constants/constants";
import { useStore } from "@/shared/store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { SelectStructureDrawer } from "@/shared/ui/select-structure-drawer";
import { FELT_CENTER, getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import { usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo } from "@bibliothecadao/react";
import { getLevelName } from "@bibliothecadao/types";
import { ChevronDown, Copy, Eye, EyeOff, Map, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { RefObject, useEffect, useMemo, useState } from "react";
import { ThreeCanvasRef } from "./three-canvas";

interface SceneControlsProps {
  currentScene: string;
  onSceneChange: (sceneId: string) => void;
  onCameraReset?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  className?: string;
  canvasRef: RefObject<ThreeCanvasRef>;
}

const CompactRealmHeader = () => {
  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();
  const { isCompactView, toggleCompactView } = useStore();

  const playerRealmsAndVillages = useMemo(() => {
    return [...playerRealms, ...playerVillages];
  }, [playerRealms, playerVillages]);

  const { structureEntityId, selectedRealm, setSelectedStructure } = useStore();

  // Auto-select first realm if none is selected
  useEffect(() => {
    if (!selectedRealm && playerRealmsAndVillages.length > 0) {
      setSelectedStructure(playerRealmsAndVillages[0]);
    }
  }, [selectedRealm, playerRealmsAndVillages, setSelectedStructure]);

  const feltCenter = FELT_CENTER();

  const adjustedCoords = useMemo(() => {
    if (!selectedRealm) return null;
    return {
      x: selectedRealm.position.x - feltCenter,
      y: selectedRealm.position.y - feltCenter,
    };
  }, [selectedRealm, feltCenter]);

  const handleCopyCoords = () => {
    if (adjustedCoords) {
      navigator.clipboard.writeText(`${adjustedCoords.x},${adjustedCoords.y}`);
    }
  };

  const isBlitz = getIsBlitz();

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Structure Selector */}
      <div className="flex-1 min-w-0">
        <SelectStructureDrawer
          structures={playerRealmsAndVillages}
          selectedStructureId={structureEntityId}
          onSelectStructure={(entityId) => {
            const realm = playerRealmsAndVillages.find((r) => r.entityId === entityId);
            setSelectedStructure(realm || null);
          }}
        >
          <div className="flex items-center gap-1 text-sm font-medium truncate cursor-pointer hover:text-primary">
            <span className="truncate">
              {selectedRealm ? getStructureName(selectedRealm?.structure, isBlitz).name : "Select Structure"}
            </span>
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          </div>
        </SelectStructureDrawer>
      </div>

      {/* Coordinates and Level */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant="outline" className="text-xs font-mono h-6">
          {adjustedCoords ? `${adjustedCoords.x},${adjustedCoords.y}` : "No coords"}
          <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 p-0" onClick={handleCopyCoords}>
            <Copy className="h-2.5 w-2.5" />
          </Button>
        </Badge>

        {selectedRealm && <span className="text-xs text-muted-foreground">{getLevelName(selectedRealm.level)}</span>}

        {/* Compact View Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleCompactView}
          className="h-6 w-6 p-0"
          title={isCompactView ? "Expand labels" : "Compact labels"}
        >
          {isCompactView ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
};

export function SceneControls({
  currentScene,
  onSceneChange,
  onCameraReset,
  onZoomIn,
  onZoomOut,
  className,
  canvasRef,
}: SceneControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isCompactView } = useStore();

  const currentSceneConfig = DEFAULT_SCENES.find((scene) => scene.id === currentScene);

  // Apply/remove compact class to label renderer element
  useEffect(() => {
    const gameRenderer = canvasRef.current?.getGameRenderer();
    const labelRenderer = gameRenderer?.getLabelRenderer();
    const labelRendererElement = labelRenderer?.domElement;

    if (labelRendererElement) {
      if (isCompactView) {
        labelRendererElement.classList.add("compact-labels");
      } else {
        labelRendererElement.classList.remove("compact-labels");
      }
    }
  }, [isCompactView, canvasRef]);

  return (
    <div className={`fixed top-4 left-4 right-4 z-20 space-y-3 ${className}`}>
      {/* Compact Realm Info Header */}
      <Card className="p-2 bg-background/95 backdrop-blur-md border-border/50">
        <CompactRealmHeader />
      </Card>

      {/* Scene Controls */}
      {false && (
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
                        {scene.description && (
                          <span className="text-xs text-muted-foreground">{scene.description}</span>
                        )}
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
              <p className="text-xs text-muted-foreground">{currentSceneConfig?.description}</p>
            </div>
          )}
        </Card>
      )}

      {/* Touch Gesture Hints */}
      <div className="text-center">
        <div className="inline-flex items-center gap-4 px-3 py-1 bg-background/80 backdrop-blur-sm rounded-full text-xs text-muted-foreground">
          <span>👆 Pan</span>
          <span>🤏 Zoom</span>
        </div>
      </div>
    </div>
  );
}
