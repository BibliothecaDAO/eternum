import { GameRenderer } from "@/shared/lib/three/game-renderer";
import { useDojo } from "@bibliothecadao/react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

interface ThreeCanvasProps {
  onSceneChange?: (sceneId: string) => void;
  onReady?: () => void;
  className?: string;
  isPaused?: boolean;
}

export interface ThreeCanvasRef {
  switchScene: (sceneId: string) => void;
  getCurrentScene: () => string;
  getAvailableScenes: () => string[];
  moveCameraToStructure: (structurePosition: { x: number; y: number }) => Promise<void>;
  getGameRenderer: () => GameRenderer | null;
  isWorldmapReady: () => boolean;
  waitForWorldmapInitialization: () => Promise<void>;
  pauseRendering: () => void;
  resumeRendering: () => void;
  showLabels: () => void;
  hideLabels: () => void;
}

export const ThreeCanvas = forwardRef<ThreeCanvasRef, ThreeCanvasProps>(
  ({ onSceneChange, onReady, className, isPaused = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<GameRenderer | null>(null);
    const isInitializedRef = useRef(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const dojo = useDojo();

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || isInitializedRef.current) return;

      try {
        setIsLoading(true);
        setError(null);

        console.log("Creating GameRenderer instance");

        // Mark as initialized to prevent double initialization
        isInitializedRef.current = true;

        // Initialize GameRenderer
        const renderer = new GameRenderer(canvas, dojo);
        rendererRef.current = renderer;

        // Start render loop
        renderer.startRenderLoop();

        // Handle resize
        const handleResize = () => {
          renderer.resize();
        };

        window.addEventListener("resize", handleResize);

        // Initial resize
        handleResize();

        setIsLoading(false);
        onReady?.();

        // Cleanup function
        return () => {
          console.log("Cleaning up GameRenderer");
          window.removeEventListener("resize", handleResize);
          if (rendererRef.current) {
            rendererRef.current.stopRenderLoop();
            rendererRef.current.dispose();
            rendererRef.current = null;
          }
          isInitializedRef.current = false;
        };
      } catch (err) {
        console.error("Failed to initialize Three.js canvas:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize 3D view");
        setIsLoading(false);
        isInitializedRef.current = false;
      }
    }, []); // Empty dependency array - run once

    const switchScene = (sceneId: string) => {
      if (rendererRef.current) {
        rendererRef.current.switchScene(sceneId);
        onSceneChange?.(sceneId);
      }
    };

    const getCurrentScene = () => {
      return rendererRef.current?.getCurrentScene() || "worldmap";
    };

    const getAvailableScenes = () => {
      return rendererRef.current?.getAvailableScenes() || [];
    };

    const moveCameraToStructure = async (structurePosition: { x: number; y: number }) => {
      if (rendererRef.current) {
        await rendererRef.current.moveCameraToStructure(structurePosition);
      }
    };

    const isWorldmapReady = () => {
      return rendererRef.current?.isWorldmapReady() ?? false;
    };

    const waitForWorldmapInitialization = async () => {
      if (rendererRef.current) {
        await rendererRef.current.waitForWorldmapInitialization();
      }
    };

    const getGameRenderer = () => {
      return rendererRef.current;
    };

    const pauseRendering = () => {
      if (rendererRef.current) {
        rendererRef.current.stopRenderLoop();
        rendererRef.current.hideLabels();
      }
    };

    const resumeRendering = () => {
      if (rendererRef.current) {
        rendererRef.current.startRenderLoop();
        rendererRef.current.showLabels();
      }
    };

    const showLabels = () => {
      if (rendererRef.current) {
        rendererRef.current.showLabels();
      }
    };

    const hideLabels = () => {
      if (rendererRef.current) {
        rendererRef.current.hideLabels();
      }
    };

    // Handle pausing/resuming rendering based on visibility
    useEffect(() => {
      if (rendererRef.current) {
        if (isPaused) {
          pauseRendering();
        } else {
          resumeRendering();
        }
      }
    }, [isPaused]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      switchScene,
      getCurrentScene,
      getAvailableScenes,
      moveCameraToStructure,
      getGameRenderer,
      isWorldmapReady,
      waitForWorldmapInitialization,
      pauseRendering,
      resumeRendering,
      showLabels,
      hideLabels,
    }));

    if (error) {
      return (
        <div className={`flex items-center justify-center bg-muted/20 rounded-lg ${className}`}>
          <div className="text-center p-6">
            <p className="text-destructive text-sm mb-2">Failed to load 3D view</p>
            <p className="text-muted-foreground text-xs">{error}</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`relative ${className}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading 3D view...</p>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="w-full h-full touch-none" style={{ touchAction: "none" }} />
      </div>
    );
  },
);

ThreeCanvas.displayName = "ThreeCanvas";
