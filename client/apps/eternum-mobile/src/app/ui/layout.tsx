import { ROUTES } from "@/shared/consts/routes";
import { useSyncPlayerStructures } from "@/shared/hooks/use-sync-player-structures";
import { useStore } from "@/shared/store";
import { Footer } from "@/widgets/footer";
import { Header } from "@/widgets/header";
import { usePlayerStructures } from "@bibliothecadao/react";
import { Outlet, useMatches } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ThreeCanvas, type ThreeCanvasRef } from "@/pages/worldmap/ui/three-canvas";

// Context for sharing the persistent ThreeCanvas across routes
export const PersistentCanvasContext = createContext<{
  canvasRef: React.RefObject<ThreeCanvasRef>;
  isCanvasReady: boolean;
  isWorldmapVisible: boolean;
} | null>(null);

export const usePersistentCanvas = () => {
  const context = useContext(PersistentCanvasContext);
  if (!context) {
    throw new Error("usePersistentCanvas must be used within PersistentCanvasContext");
  }
  return context;
};

export function Layout() {
  const playerStructures = usePlayerStructures();
  const matches = useMatches();
  const currentPath = matches.at(-1)?.pathname;
  const canvasRef = useRef<ThreeCanvasRef>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const { selectedRealm } = useStore();

  // sync player structures
  useSyncPlayerStructures();

  useEffect(() => {
    console.log("playerStructures", playerStructures);
  }, [playerStructures]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (canvasRef.current) {
        const renderer = canvasRef.current.getGameRenderer();
        renderer?.dispose();
      }
    };
  }, []);

  const isHomePage = currentPath === ROUTES.HOME;
  const isWorldmapPage = currentPath === ROUTES.WORLDMAP;

  const handleCanvasReady = useCallback(() => {
    setIsCanvasReady(true);
  }, []);

  // Move camera to selected realm when canvas is ready and we're on worldmap
  useEffect(() => {
    const moveCameraToRealm = async () => {
      if (selectedRealm && canvasRef.current && isWorldmapPage && isCanvasReady) {
        await canvasRef.current.waitForWorldmapInitialization();
        await canvasRef.current.moveCameraToStructure(selectedRealm.position);
      }
    };

    moveCameraToRealm();
  }, [selectedRealm, isWorldmapPage, isCanvasReady]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    canvasRef,
    isCanvasReady,
    isWorldmapVisible: isWorldmapPage
  }), [isCanvasReady, isWorldmapPage]);

  return (
    <PersistentCanvasContext.Provider value={contextValue}>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className={`flex-1 pb-20 ${!isHomePage ? "pt-0" : ""} relative`}>
          {/* Persistent Three.js Canvas - always rendered but optimized for visibility */}
          <div 
            className={`absolute inset-0 ${isWorldmapPage ? 'z-0' : 'z-[-1] pointer-events-none opacity-0'}`}
            style={{ display: isWorldmapPage ? 'block' : 'none' }}
          >
            <ThreeCanvas
              ref={canvasRef}
              onReady={handleCanvasReady}
              className="w-full h-full"
              isPaused={!isWorldmapPage}
            />
          </div>
          
          {/* Page content */}
          <div className={`relative ${isWorldmapPage ? 'z-10' : 'z-0'}`}>
            <Outlet />
          </div>
        </main>
        <Footer />
      </div>
    </PersistentCanvasContext.Provider>
  );
}
