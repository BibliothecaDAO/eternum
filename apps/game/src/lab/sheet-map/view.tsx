import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MAP_SHEET, mapAgeAccent } from "@/tokens";
import { BiomeType } from "@bibliothecadao/types";
import { requireBiomeColor } from "@/three/managers/biome-colors";
import { HexMarker } from "@/ui/design-system/hex-marker";
import { mountProceduralTerrainDebugRenderer } from "@/three/debug/procedural-terrain-debug-renderer";
import { MAP_CHAPTERS, MAP_COLUMNS, type MapChapter } from "./fixture";
import "./view.css";

/** The renderer half of the HUD sheet's Map context. Closed sections allocate no world. */
export function MapContextWorld() {
  const [open, setOpen] = useState(false);
  const [query] = useSearchParams();
  return (
    <div data-map-context-world className="map-context-world">
      <div className="map-context-world-heading">
        <div>
          <h3>3D map overlays</h3>
          <p>Forty states on shipped terrain, beside Today in all three ages.</p>
        </div>
        <button type="button" onClick={() => setOpen(!open)}>
          {open ? "Close 3D comparison" : "Open 3D comparison"}
        </button>
      </div>
      {open ? <WorldComparison key={`${query.get("chapter") ?? "hexes"}:${query.get("rendererMode")}`} /> : null}
    </div>
  );
}

/** Compare appearances on four native terrain fixtures; no production scene reads the proposal. */
function WorldComparison() {
  const [query, setQuery] = useSearchParams();
  const requested = query.get("chapter") ?? "hexes";
  const chapter: MapChapter = Object.hasOwn(MAP_CHAPTERS, requested) ? (requested as MapChapter) : "hexes";
  const canvas = useRef<HTMLCanvasElement>(null),
    overlay = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const forceWebGL = query.get("rendererMode") === "webgpu-force-webgl";
  useEffect(() => {
    let active = true,
      release = () => {};
    setReady(false);
    setError("");
    const element = canvas.current!;
    element.width = element.clientWidth;
    element.height = element.clientHeight;
    const frame = requestAnimationFrame(() => {
      void mountProceduralTerrainDebugRenderer({
        canvas: element,
        captureMode: true,
        mapSheet: { chapter, overlay: overlay.current! },
        gameMode: "blitz",
        forceWebGL,
        qualityTier: "detail",
        revealProgress: 0,
        sceneId: "all-biomes",
        texturedGround: true,
        onReady: () => {},
        onError: (reason) => {
          if (active) setError(reason instanceof Error ? (reason.stack ?? reason.message) : String(reason));
        },
      })
        .then((handle) => {
          if (!active) return handle.dispose();
          release = () => handle.dispose();
          setReady(true);
        })
        .catch((reason) => {
          if (active) setError(reason instanceof Error ? (reason.stack ?? reason.message) : String(reason));
        });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      release();
    };
  }, [chapter, forceWebGL]);
  return (
    <main className="map-sheet-lab" data-map-sheet data-ready={ready} data-chapter={chapter}>
      <header className="map-sheet-controls">
        <div>
          <h3>Map context · 3D</h3>
          <p>Same terrain, same light. Today beside three ages. Lab proposal.</p>
        </div>
        <nav aria-label="Overlay family">
          {(Object.keys(MAP_CHAPTERS) as MapChapter[]).map((key) => (
            <button
              key={key}
              aria-pressed={chapter === key}
              onClick={() =>
                setQuery((previous) => {
                  const next = new URLSearchParams(previous);
                  next.set("chapter", key);
                  return next;
                })
              }
            >
              {key === "hexes"
                ? "Hex states"
                : key === "routes"
                  ? "Paths & orders"
                  : key === "ownership"
                    ? "Ownership"
                    : key === "strategic"
                      ? "Strategic markers"
                      : "Sites & fog"}
            </button>
          ))}
        </nav>
        <span role="status">{error || (ready ? "Ready · shipped scenery" : "Loading native terrain…")}</span>
      </header>
      <div className="map-sheet-headings">
        {MAP_COLUMNS.map((age) => (
          <div key={age} style={{ borderColor: age === "today" ? MAP_SHEET.ink : mapAgeAccent(age) }}>
            <strong>{age === "today" ? "Today" : age[0].toUpperCase() + age.slice(1)}</strong>
            <small>
              {age === "today"
                ? "Release · unchanged"
                : age === "blitz"
                  ? "Torch amber"
                  : age === "frontier"
                    ? "Spire violet"
                    : "Restoration gold"}
            </small>
          </div>
        ))}
      </div>
      <div className="map-sheet-stage">
        <canvas ref={canvas} aria-label="Four overlay sheets on the native world renderer" />
        <div ref={overlay} className="map-sheet-labels" />
      </div>
      <footer>
        {chapter === "ownership" ? (
          <div className="map-sheet-minimaps">
            {MAP_COLUMNS.map((age) => (
              <div
                key={age}
                className={age === "today" ? "" : "map-sheet-proposed-minimap"}
                style={Object.fromEntries(
                  Object.entries(MAP_SHEET.ownership).map(([owner, color]) => [`--map-${owner}`, color]),
                )}
              >
                <svg viewBox="0 0 320 75" aria-label={`${age} ownership minimap badges`}>
                  {(["you", "ally", "enemy", "neutral"] as const).map((owner, i) => (
                    <HexMarker key={owner} name="map-realm-1" owner={owner} x={26 + i * 55} y={25} radius={16} />
                  ))}
                  {Object.values(BiomeType).map((biome, i) => (
                    <rect
                      key={biome}
                      x={9 + i * 15.8}
                      y={52}
                      width={14}
                      height={14}
                      fill={requireBiomeColor(biome).getStyle()}
                      fillOpacity={0.5}
                      stroke="#1f130a"
                      strokeWidth={0.6}
                    >
                      <title>{biome} · unchanged terrain colour</title>
                    </rect>
                  ))}
                </svg>
                <small>{age === "today" ? "Shipped badge palette" : "HUD ownership · same painted badges"}</small>
              </div>
            ))}
          </div>
        ) : null}
        <p>
          {chapter === "hexes"
            ? "Today: range is the action layer; forbidden tiles have no highlight. Proposal: age for intent, coral for danger, teal for transfer; symbols keep actions distinct."
            : chapter === "routes"
              ? "Today: 1 px stock paths; no route arrowheads or separate order-anchor graphic on this release. Proposal: cased ribbons, endpoint chevrons, explicit refused anchor."
              : chapter === "strategic"
                ? "Same production instanced marker pools and painted art in every column. Proposal changes only the tint to the HUD ownership roles; sizes, alpha cutout and tier glyphs remain shipped."
                : chapter === "ownership"
                  ? "Today: holdings share the pink hover ring; other relations have no ground ring. Proposal: ownership agrees with the HUD in every age. Unowned stays neutral without a centre glyph."
                  : "Painted site icons belong to the shared plate. Ground anchors shown here; proposed neutral rings add no new icon family. Fog coverage and motion remain shipped; only the edge cue uses the age."}
        </p>
      </footer>
    </main>
  );
}
