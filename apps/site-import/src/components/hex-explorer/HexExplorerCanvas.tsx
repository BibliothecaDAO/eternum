import { useCallback, useEffect, useRef } from "react";
import type { AgentData, FeatureHexData, HexDirection, PixelCoord } from "./types";
import { hexToPixel, hexDistance, hexNeighbor } from "./hex-utils";
import { createInitialState, initializeState } from "./game-state";
import { createGameLoop } from "./game-loop";
import { useHexExplorerInput } from "./useHexExplorerInput";

interface HexExplorerCanvasProps {
  width: number;
  height: number;
  isActive: boolean;
  onFeatureHexActivate: (feature: FeatureHexData | null) => void;
  onAgentNearby: (agent: AgentData | null, screenPos: PixelCoord | null) => void;
  onFirstInput: () => void;
}

export function HexExplorerCanvas({
  width,
  height,
  isActive,
  onFeatureHexActivate,
  onAgentNearby,
  onFirstInput,
}: HexExplorerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(createInitialState());

  // One-time initialization
  useEffect(() => {
    initializeState(stateRef.current);
  }, []);

  // Adjust hex size based on viewport
  useEffect(() => {
    stateRef.current.hexSize = width < 640 ? 30 : width < 1024 ? 38 : 44;
  }, [width]);

  // ── Movement handler ──────────────────────────────────────────────
  const handleMove = useCallback(
    (direction: HexDirection) => {
      const s = stateRef.current;
      if (s.isMoving || s.isDead) return;

      if (!s.hasReceivedInput) {
        s.hasReceivedInput = true;
        onFirstInput();
      }

      const target = hexNeighbor(s.playerHex, direction);
      if (hexDistance({ q: 0, r: 0 }, target) > s.gridRadius) return;

      s.playerTargetHex = target;
      s.playerTargetPixel = hexToPixel(target, s.hexSize);
      s.isMoving = true;
      s.moveStartTime = performance.now();
    },
    [onFirstInput]
  );

  // ── Click-to-move ─────────────────────────────────────────────────
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const s = stateRef.current;
      if (s.isMoving || s.isDead) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const offsetX = width / 2 - s.cameraX;
      const offsetY = height / 2 - s.cameraY;
      const px = s.playerPixel.x + offsetX;
      const py = s.playerPixel.y + offsetY;

      const dx = clickX - px;
      const dy = clickY - py;
      if (dx * dx + dy * dy < 100) return;

      const angle = Math.atan2(dy, dx);
      const a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

      let dir: HexDirection;
      if (a < Math.PI / 6 || a >= (11 * Math.PI) / 6) {
        dir = 0;
      } else if (a < Math.PI / 2) {
        dir = 5;
      } else if (a < (5 * Math.PI) / 6) {
        dir = 4;
      } else if (a < (7 * Math.PI) / 6) {
        dir = 3;
      } else if (a < (3 * Math.PI) / 2) {
        dir = 2;
      } else {
        dir = 1;
      }

      if (!s.hasReceivedInput) {
        s.hasReceivedInput = true;
        onFirstInput();
      }

      handleMove(dir);
    },
    [width, height, handleMove, onFirstInput]
  );

  // ── Input hook ────────────────────────────────────────────────────
  useHexExplorerInput(isActive, handleMove);

  // ── Game loop lifecycle ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    return createGameLoop(canvas, stateRef.current, width, height, {
      onFeatureHexActivate,
      onAgentNearby,
    });
  }, [width, height, onFeatureHexActivate, onAgentNearby]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: "block", cursor: "pointer" }}
      onClick={handleCanvasClick}
      aria-hidden="true"
    />
  );
}
