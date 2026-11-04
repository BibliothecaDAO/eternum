import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  mountProceduralTerrainDebugRenderer,
  type ProceduralTerrainDebugRendererHandle,
} from "@/three/debug/procedural-terrain-debug-renderer";
import { depthName, SPIRE_WORDS } from "@/ui/design-system/kit/words";
import { EtherealDepthStage, readDepthLook } from "./stage";
import looks from "@/three/terrain/ethereal-depths.json";
import "./view.css";

export function EtherealDepthLabView() {
  const [query, setQuery] = useSearchParams();
  const choice = readDepthLook(query);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let runtime: ProceduralTerrainDebugRendererHandle | null = null;
    setReady(false);
    setError(null);
    const frame = requestAnimationFrame(() => {
      const stage = new EtherealDepthStage(choice.set === "current" ? null : choice.depth, labels.current!);
      void mountProceduralTerrainDebugRenderer({
        canvas: canvas.current!,
        stage,
        captureMode: true,
        gameMode: "frontier",
        forceWebGL: true,
        qualityTier: "detail",
        revealProgress: 0,
        sceneId: "all-biomes",
        texturedGround: true,
        onReady: () => {},
        onError: (reason) => {
          if (active) setError(String(reason));
        },
      })
        .then((handle) => {
          if (!active) {
            handle.dispose();
            return;
          }
          runtime = handle;
          handle.setClock({ scale: 0, fixedStep: true });
          setReady(true);
        })
        .catch((reason) => {
          if (active) setError(String(reason));
        });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      runtime?.dispose();
    };
  }, [choice.depth, choice.set]);
  return (
    <main className="depth-study" data-depth-study data-ready={ready}>
      <canvas ref={canvas} aria-label="Ethereal terrain with an army and Spire for scale" />
      <div className="depth-study-labels" ref={labels} aria-label="Scale references">
        <span data-scale-label>{SPIRE_WORDS.title}</span>
        <span data-scale-label>Army · 1,200</span>
      </div>
      <header className="depth-study-caption">
        <p>{choice.set === "current" ? "Original · shared basalt" : "Violet descent · approved"}</p>
        <h1>
          {depthName(choice.depth)} · {choice.set === "current" ? "Basalt" : looks[choice.depth].title}
        </h1>
        <p>{error ?? (ready ? "Terrain lab · fixed camera · actual model scale" : "Preparing terrain…")}</p>
      </header>
      <nav className="depth-study-controls" aria-label="Depth studies">
        <label>
          Set{" "}
          <select
            aria-label="Look set"
            disabled={!ready}
            value={choice.set}
            onChange={(e) =>
              setQuery((previous) => {
                const next = new URLSearchParams(previous);
                next.set("set", e.target.value);
                return next;
              })
            }
          >
            <option value="current">Current</option>
            <option value="violet">Violet descent</option>
          </select>
        </label>
        <label>
          Depth{" "}
          <select
            aria-label="Depth"
            disabled={!ready}
            value={choice.depth}
            onChange={(e) =>
              setQuery((previous) => {
                const next = new URLSearchParams(previous);
                next.set("depth", e.target.value);
                return next;
              })
            }
          >
            {([1, 2, 3] as const).map((depth) => (
              <option key={depth} value={depth}>
                {depthName(depth)}
              </option>
            ))}
          </select>
        </label>
      </nav>
    </main>
  );
}
