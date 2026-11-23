import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { mountTroopMotionLab, type TroopMotionRendererHandle, type TroopMotionStats } from "./troop-motion-renderer";
import {
  TROOP_MOTION_ACTIONS,
  TROOP_MOTION_KINDS,
  parseTroopMotionState,
  type TroopMotionAction,
  type TroopMotionCamera,
  type TroopMotionKind,
  type TroopMotionLabel,
  type TroopMotionState,
} from "./troop-motion-types";

interface TroopMotionWindowHandle {
  ready: boolean;
  setState(patch: Partial<TroopMotionState>): void;
  seek(seconds: number): void;
  getStats(): TroopMotionStats | null;
}

declare global {
  interface Window {
    __troopMotionLab?: TroopMotionWindowHandle;
  }
}

export function TroopMotionView() {
  const location = useLocation();
  const isCapture = new URLSearchParams(location.search).get("capture") === "1";
  const initialState = parseTroopMotionState(location.search);
  const [state, setState] = useState<TroopMotionState>(initialState);
  const [stats, setStats] = useState<TroopMotionStats | null>(null);
  const [labels, setLabels] = useState<TroopMotionLabel[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<TroopMotionRendererHandle | null>(null);

  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;
    const controller = new AbortController();
    let mounted = true;
    setError(null);
    window.__troopMotionLab = {
      ready: false,
      setState(patch) {
        setState((prev) => ({ ...prev, ...patch }));
      },
      seek(seconds) {
        rendererRef.current?.seek(seconds);
      },
      getStats() {
        return rendererRef.current?.getStats() ?? null;
      },
    };

    void mountTroopMotionLab({
      container,
      initialState: state,
      signal: controller.signal,
      onStats(next) {
        if (mounted) setStats(next);
      },
      onLabels(next) {
        if (mounted) setLabels(next);
      },
    })
      .then((handle) => {
        if (!mounted || controller.signal.aborted) {
          handle.dispose();
          return;
        }
        rendererRef.current = handle;
        setReady(true);
        if (window.__troopMotionLab) window.__troopMotionLab.ready = true;
      })
      .catch((cause) => {
        if (mounted && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });

    return () => {
      mounted = false;
      controller.abort();
      rendererRef.current?.dispose();
      rendererRef.current = null;
      delete window.__troopMotionLab;
    };
  }, [initialState.shippedBaseUrl]);

  useEffect(() => {
    rendererRef.current?.updateState(state);
  }, [state]);

  const setTroop = (troop: TroopMotionKind) =>
    setState((prev) => ({ ...prev, troop, compareShipped: troop === "knight" ? Boolean(prev.shippedBaseUrl) : true }));
  const setAction = (action: TroopMotionAction) => setState((prev) => ({ ...prev, action }));
  const setCamera = (camera: TroopMotionCamera) => setState((prev) => ({ ...prev, camera }));

  return (
    <div
      data-troop-motion-ready={ready ? "true" : "false"}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#14181a" }}
    >
      <div ref={stageRef} style={{ position: "absolute", inset: 0 }} />

      {labels.map(
        (label) =>
          label.visible && (
            <div
              key={label.id}
              style={{
                position: "absolute",
                left: `${label.x}px`,
                top: `${label.y}px`,
                transform: "translate(-50%, -100%)",
                pointerEvents: "none",
                padding: "3px 9px",
                borderRadius: "999px",
                background: "rgba(18, 16, 13, 0.82)",
                border: "1px solid rgba(226, 198, 146, 0.45)",
                color: "#f4ead4",
                font: "600 12px/1.25 system-ui, -apple-system, sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              {label.text}
            </div>
          ),
      )}

      {!isCapture && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: "8px 10px",
            borderRadius: 10,
            background: "rgba(18, 16, 13, 0.84)",
            border: "1px solid rgba(226, 198, 146, 0.3)",
            color: "#f3ead6",
            font: "500 12px/1.3 system-ui, -apple-system, sans-serif",
            maxWidth: "calc(100% - 24px)",
          }}
        >
          {TROOP_MOTION_KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTroop(item.id)}
              style={{
                padding: "4px 9px",
                borderRadius: 6,
                border: "1px solid rgba(114, 198, 168, 0.45)",
                background: state.troop === item.id ? "#66ddab" : "rgba(255,255,255,0.06)",
                color: state.troop === item.id ? "#0e1d17" : "#f3ead6",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
          {TROOP_MOTION_ACTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAction(item.id)}
              style={{
                padding: "4px 9px",
                borderRadius: 6,
                border: "1px solid rgba(226, 198, 146, 0.35)",
                background: state.action === item.id ? "#d6a44e" : "rgba(255,255,255,0.06)",
                color: state.action === item.id ? "#18140d" : "#f3ead6",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCamera(state.camera === "desktop" ? "phone" : "desktop")}
            style={{
              padding: "4px 9px",
              borderRadius: 6,
              border: "1px solid rgba(226, 198, 146, 0.35)",
              background: "rgba(255,255,255,0.06)",
              color: "#f3ead6",
              cursor: "pointer",
            }}
          >
            Cam: {state.camera}
          </button>
          <button
            type="button"
            onClick={() => rendererRef.current?.resetCamera()}
            style={{
              padding: "4px 9px",
              borderRadius: 6,
              border: "1px solid rgba(226, 198, 146, 0.35)",
              background: "rgba(255,255,255,0.06)",
              color: "#f3ead6",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
          {stats && (
            <span style={{ alignSelf: "center", opacity: 0.85, marginLeft: 4 }}>
              {stats.actionLabel} · {stats.drawCalls} draws · {stats.triangles.toLocaleString()} tris
            </span>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            inset: 16,
            padding: 16,
            background: "rgba(40, 12, 12, 0.92)",
            color: "#ffd8d8",
            borderRadius: 8,
            fontFamily: "monospace",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
