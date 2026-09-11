import { orders } from "@bibliothecadao/types";
import { WeatherLabControls } from "./weather-lab-controls";
import { AtmosphereLabControls } from "./atmosphere-lab-controls";
import { TERRAIN_LAB_BUILDINGS } from "@/three/debug/terrain-lab-buildings";
import { VILLAGE_MODEL_PATH, isRealmModelPath } from "@/three/constants/scene-constants";
import { SETTLEMENT_RELATIONSHIPS, type SettlementRelationship } from "@/three/structures/settlement-appearance";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useSearchParams } from "react-router-dom";

import {
  mountProceduralTerrainDebugRenderer,
  type ProceduralTerrainDebugRendererHandle,
  type ProceduralTerrainDebugStats,
} from "@/three/debug/procedural-terrain-debug-renderer";
import { TERRAIN_BIOME_DESCRIPTORS, TERRAIN_BIOME_ORDER } from "@/three/terrain/terrain-palette";
import { TERRAIN_QUALITY_TIERS, type TerrainQualityTier } from "@/three/terrain/terrain-quality";
import {
  TERRAIN_VERIFICATION_SCENE_IDS,
  type TerrainVerificationSceneId,
} from "@/three/terrain/verification/terrain-verification-fixtures";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useBootDocumentState } from "@/ui/modules/boot-loader";

import { DEFAULT_TERRAIN_LAB_PREVIEW, type TerrainLabPreview } from "@/three/debug/terrain-lab-preview";
import { MODEL_TYPE_TO_FILE } from "@/three/constants/army-constants";

const EMPTY_STATS: ProceduralTerrainDebugStats = {
  preparedFrontierCells: 0,
  wildlife: { count: 0, loaded: 0, pending: 0, failed: [], visible: true, creatures: [] },
  activeMode: "webgpu",
  biomeCount: 0,
  buildingInstances: 0,
  cellCount: 0,
  commitMs: 0,
  drawCalls: 0,
  dustActiveParticles: 0,
  dustCapacity: 0,
  dustEmitterCount: 0,
  dustTriangles: 0,
  fingerprint: "--------",
  firstRenderMs: 0,
  fogMaskBytes: 0,
  fogMaskHeight: 0,
  fogMaskWidth: 0,
  fogOpacity: 0,
  fogTerrainCells: 0,
  frameP50Ms: 0,
  frameP95Ms: 0,
  frameWorstMs: 0,
  frameSampleCount: 0,
  groundTextureBytes: 0,
  groundTextureLayers: 0,
  groundCoverInstances: 0,
  prepareMs: 0,
  propInstances: 0,
  qualityTier: "detail",
  realmInstances: 0,
  revealProgress: 0,
  roadSegments: 0,
  roadCoreDisturbance: 0,
  roadNaturalDisturbance: 0,
  roadVergeSuccession: 0,
  sceneId: "all-biomes",
  settlementSites: 0,
  settlementCoreDisturbance: 0,
  settlementEdgeSuccession: 0,
  settlementOuterMaturity: 0,
  settlementTierCount: 0,
  shroudActiveReveals: 0,
  shroudFrontierInstances: 0,
  shroudInstances: 0,
  shroudTriangles: 0,
  shadingMode: "textured",
  triangles: 0,
  textures: 0,
  vertices: 0,
  waterDepthMax: 0,
  waterDepthMin: 0,
  waterFoamVertices: 0,
  waterInteractionInstances: 0,
  waterInteractionTriangles: 0,
  waterWakeInstances: 0,
  wetlandEdgeStrength: 0,
  wetlandInteriorStrength: 0,
  waterShorelineVertices: 0,
  waterTriangles: 0,
  waterVertices: 0,
};

export const ProceduralTerrainDebugView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const localMode = searchParams.get("layout") === "settlement";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ProceduralTerrainDebugRendererHandle | null>(null);
  const capture = searchParams.get("capture") === "1";
  const forceWebGL = searchParams.get("rendererMode") === "webgpu-force-webgl";
  const texturedGround = searchParams.get("groundMode") !== "flat";
  const sceneId = localMode ? "temperate-grove" : resolveSceneId(searchParams.get("scene"));
  const localRadius = localMode
    ? Math.max(1, Math.min(5, Math.floor(Number(searchParams.get("radius")) || 2)))
    : undefined;
  const [buildingPath, setBuildingPath] = useState(TERRAIN_LAB_BUILDINGS[0].path);
  const [buildingYaw, setBuildingYaw] = useState(0);
  const [cycleProgress, setCycleProgress] = useState(50);
  const [entryEdge, setEntryEdge] = useState(0);
  const [preparingBuilding, setPreparingBuilding] = useState(false);
  const [preparingExploration, setPreparingExploration] = useState(false);
  const qualityTier = resolveQualityTier(searchParams.get("quality"));
  const revealProgress = resolveRevealProgress(searchParams.get("reveal"));
  const [preview, setPreview] = useState<TerrainLabPreview>(DEFAULT_TERRAIN_LAB_PREVIEW);
  const [buildingCount, setBuildingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useBootDocumentState(
    ready || error ? "app-ready" : "app-loading",
    ready ? "procedural_terrain_debug_ready" : undefined,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setReady(false);
    setError(null);
    let active = true;
    const mountFrame = window.requestAnimationFrame(() => {
      void mountProceduralTerrainDebugRenderer({
        canvas,
        captureMode: capture,
        localRadius,
        forceWebGL,
        qualityTier,
        revealProgress,
        sceneId,
        texturedGround,
        onError: (reason) => {
          if (active) setError(String(reason));
        },
        onReady: (nextStats) => {
          if (!active) return;
          setBuildingCount(nextStats.buildingInstances);
        },
      })
        .then((renderer) => {
          if (!active) {
            renderer.dispose();
            return;
          }
          rendererRef.current = renderer;
          setReady(true);
        })
        .catch((reason) => {
          if (!active) return;
          setError(reason instanceof Error ? reason.message : String(reason));
        });
    });

    return () => {
      active = false;
      window.cancelAnimationFrame(mountFrame);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [capture, forceWebGL, qualityTier, revealProgress, sceneId, texturedGround, localRadius]);

  useEffect(() => {
    if (!ready) return;
    setError(null);
    void rendererRef.current?.setPreview(preview).catch((reason) => setError(String(reason)));
  }, [preview, ready]);

  useEffect(() => {
    if (ready) rendererRef.current?.setCycleProgress(cycleProgress);
  }, [cycleProgress, ready]);

  const changeSceneSetting = (key: string, value: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <section
      className={cn(
        "min-h-[var(--lab-viewport-height)] bg-stone-950 text-stone-100",
        capture ? "block" : "flex flex-col gap-4 p-4 xl:grid xl:grid-cols-[380px_1fr]",
      )}
      data-debug-route="procedural-terrain"
      data-ready={ready ? "true" : "false"}
    >
      {!capture && (
        <aside className="flex max-h-[calc(var(--lab-viewport-height)-2rem)] flex-col gap-4 overflow-y-auto border border-white/10 bg-black/60 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/70">Terrain & buildings</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              {localMode ? "Settlement Workshop" : "Living Biomes"}
            </h1>
            <p className="mt-2 text-sm leading-5 text-stone-400">
              {localMode
                ? "Preview a local settlement with the game’s buildable tiles and building models."
                : "A seeded field exercises every biome across connected hexes."}{" "}
              Drag to pan, scroll to zoom, and right-drag to orbit. Offworld Trading Company is our visual reference.
            </p>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            Layout
            <select
              aria-label="Terrain layout"
              className="bg-stone-900 p-2"
              value={localMode ? "settlement" : "world"}
              onChange={(event) => changeSceneSetting("layout", event.target.value)}
            >
              <option value="world">World biomes</option>
              <option value="settlement">Local settlement</option>
            </select>
          </label>
          {localMode && (
            <label className="flex flex-col gap-1 text-sm">
              Buildable radius
              <select
                aria-label="Buildable radius"
                className="bg-stone-900 p-2"
                value={localRadius}
                onChange={(event) => changeSceneSetting("radius", event.target.value)}
              >
                {[1, 2, 3, 4, 5].map((radius) => (
                  <option key={radius} value={radius}>
                    {radius} rings
                  </option>
                ))}
              </select>
            </label>
          )}
          {localMode && <p className="text-xs text-stone-400">Water biomes use sand in the settlement view.</p>}
          <fieldset className="flex flex-col gap-3 border border-white/15 p-3">
            <legend className="px-1 text-sm text-emerald-200">Interaction preview</legend>
            <p className="text-xs text-stone-400">
              Click a tile to select it and place the army. Drag to move the camera.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              Biome
              <select
                aria-label="Preview biome"
                value={preview.biome}
                className="bg-stone-900 p-2"
                onChange={(event) =>
                  setPreview({ ...preview, biome: event.target.value as TerrainLabPreview["biome"] })
                }
              >
                <option value="fixture">Scene biomes</option>
                {TERRAIN_BIOME_ORDER.map((biome) => (
                  <option key={biome} value={biome}>
                    {TERRAIN_BIOME_DESCRIPTORS[biome].label}
                  </option>
                ))}
                {localRadius === undefined && (
                  <optgroup label="Secondary layers">
                    <option value="ethereal">Ethereal / Underground</option>
                  </optgroup>
                )}
              </select>
            </label>
            {preview.biome === "ethereal" && (
              <p className="text-xs text-stone-400">
                Ethereal / Underground — a separate world layer of fractured stone and flowing mineral energy.
              </p>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Fog
              <select
                aria-label="Preview fog"
                value={preview.fog}
                className="bg-stone-900 p-2"
                onChange={(event) => setPreview({ ...preview, fog: event.target.value as TerrainLabPreview["fog"] })}
              >
                <option value="fixture">Scene exploration</option>
                <option value="clear">Clear all tiles</option>
                <option value="frontier">Fog frontier at selected tile</option>
                <option value="covered">Cover all tiles</option>
              </select>
            </label>
            {!localMode && (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  Entry edge
                  <select
                    aria-label="Exploration entry edge"
                    value={entryEdge}
                    className="bg-stone-900 p-2"
                    onChange={(event) => setEntryEdge(Number(event.target.value))}
                  >
                    {["East", "North east", "North west", "West", "South west", "South east"].map((label, index) => (
                      <option key={label} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!ready || preparingExploration}
                  className="border border-emerald-300/35 bg-emerald-300/10 p-2 text-sm text-emerald-100 disabled:opacity-50"
                  onClick={() => {
                    setPreparingExploration(true);
                    void rendererRef.current
                      ?.previewExploration(entryEdge)
                      .catch((reason) => setError(String(reason)))
                      .finally(() => setPreparingExploration(false));
                  }}
                >
                  {preparingExploration ? "Preparing exploration…" : "Preview exploration"}
                </button>
              </>
            )}
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={preview.selection}
                onChange={(event) => setPreview({ ...preview, selection: event.target.checked })}
              />
              Tile selection
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Army model
              <select
                aria-label="Army model"
                value={preview.army}
                className="bg-stone-900 p-2"
                onChange={(event) => setPreview({ ...preview, army: event.target.value as TerrainLabPreview["army"] })}
              >
                <option value="none">None</option>
                {Object.keys(MODEL_TYPE_TO_FILE).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={preview.spin}
                onChange={(event) => setPreview({ ...preview, spin: event.target.checked })}
              />
              Spin army
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Army rotation
              <input
                aria-label="Army rotation"
                type="range"
                min="0"
                max={Math.PI * 2}
                step="0.01"
                value={preview.yaw}
                onChange={(event) => setPreview({ ...preview, yaw: Number(event.target.value), spin: false })}
              />
            </label>
            <button
              type="button"
              onClick={() => rendererRef.current?.focusSelection()}
              className="border border-emerald-300/35 bg-emerald-300/10 p-2 text-sm text-emerald-100"
            >
              Focus selected tile
            </button>
          </fieldset>
          <fieldset className="flex flex-col gap-3 border border-white/15 p-3">
            <legend className="px-1 text-sm text-emerald-200">Buildings and chests · {buildingCount}</legend>
            <label className="flex flex-col gap-1 text-sm">
              Model
              <select
                aria-label="Building model"
                className="bg-stone-900 p-2"
                value={buildingPath}
                onChange={(event) => setBuildingPath(event.target.value)}
              >
                {TERRAIN_LAB_BUILDINGS.map(({ path, label }) => (
                  <option key={path} value={path}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {isRealmModelPath(buildingPath) && (
              <label className="flex flex-col gap-1 text-sm">
                Realm order
                <select
                  aria-label="Realm order"
                  className="bg-stone-900 p-2"
                  value={preview.realmOrderId}
                  onChange={(event) => setPreview({ ...preview, realmOrderId: Number(event.target.value) })}
                >
                  {orders.map((order) => (
                    <option key={order.orderId} value={order.orderId}>
                      {order.fullOrderName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {buildingPath === VILLAGE_MODEL_PATH && (
              <label className="flex flex-col gap-1 text-sm">
                Village relationship
                <select
                  aria-label="Village relationship"
                  className="bg-stone-900 p-2"
                  value={preview.relationship}
                  onChange={(event) =>
                    setPreview({ ...preview, relationship: event.target.value as SettlementRelationship })
                  }
                >
                  {Object.entries(SETTLEMENT_RELATIONSHIPS).map(([relationship, appearance]) => (
                    <option key={relationship} value={relationship}>
                      {appearance.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Building rotation
              <input
                aria-label="Building rotation"
                type="range"
                min={0}
                max={Math.PI * 2}
                step={Math.PI / 6}
                value={buildingYaw}
                onChange={(event) => setBuildingYaw(Number(event.target.value))}
              />
            </label>
            <p className="text-xs text-stone-400">
              Select a tile, then place a model. Placed buildings stay when you select another tile.
            </p>
            <button
              className="border border-emerald-300/25 p-2 text-sm"
              disabled={!ready || preparingBuilding}
              onClick={async () => {
                setPreparingBuilding(true);
                try {
                  await rendererRef.current?.placeBuilding(buildingPath, buildingYaw);
                } catch (reason) {
                  setError(String(reason));
                } finally {
                  setPreparingBuilding(false);
                }
              }}
            >
              {preparingBuilding ? "Preparing model…" : "Place on selected tile"}
            </button>
            <button
              className="border border-white/15 p-2 text-sm"
              disabled={!ready || preparingBuilding}
              onClick={() => void rendererRef.current?.removeBuilding().catch((reason) => setError(String(reason)))}
            >
              Remove from selected tile
            </button>
            <button
              className="border border-white/15 p-2 text-sm"
              disabled={!ready || preparingBuilding}
              onClick={() => void rendererRef.current?.removeBuilding(true).catch((reason) => setError(String(reason)))}
            >
              Clear buildings
            </button>
          </fieldset>

          <WeatherLabControls
            onEvolving={(enabled) => rendererRef.current?.setWeatherEvolving(enabled)}
            onWeather={(type) => rendererRef.current?.setWeather(type)}
            onStrike={() => rendererRef.current?.strike()}
          />
          <AtmosphereLabControls
            onPhase={setCycleProgress}
            onMoon={(enabled) => rendererRef.current?.setMoonEnabled(enabled)}
          />
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
            {preview.biome === "ethereal" ? "Fixed moonlit night" : `Game day cycle: ${cycleProgress}%`}
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={cycleProgress}
              disabled={preview.biome === "ethereal"}
              onChange={(event) => setCycleProgress(Number(event.target.value))}
            />
            <span className="font-normal normal-case text-stone-400">
              {preview.biome === "ethereal"
                ? "This layer keeps its cool moonlight glow throughout the game day."
                : "Uses game lighting and tone mapping. Match the in-game cycle percentage to compare biomes."}
            </span>
          </label>

          {preview.biome !== "ethereal" && (
            <div className="grid grid-cols-4 gap-1" aria-label="Biome atlas legend">
              {TERRAIN_BIOME_ORDER.map((biome) => {
                const descriptor = TERRAIN_BIOME_DESCRIPTORS[biome];
                return (
                  <div key={biome} className="min-h-20 border border-white/10 bg-white/[0.035] p-2">
                    <span
                      className="block h-5 w-full border border-white/10"
                      style={{ background: `linear-gradient(135deg, ${descriptor.primary}, ${descriptor.secondary})` }}
                    />
                    <span className="mt-2 block text-[0.64rem] font-medium leading-3 text-stone-300">
                      {descriptor.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
            Terrain quality
            <select
              value={qualityTier}
              onChange={(event) => changeSceneSetting("quality", event.target.value)}
              className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white"
            >
              {TERRAIN_QUALITY_TIERS.map((value) => (
                <option key={value} value={value}>
                  {formatSceneLabel(value)}
                </option>
              ))}
            </select>
          </label>

          {!localMode && sceneId === "fog-reveal" && (
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
              Exploration
              <select
                value={String(revealProgress)}
                onChange={(event) => changeSceneSetting("reveal", event.target.value)}
                className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white"
              >
                <option value="0">Covered</option>
                <option value="0.25">25%</option>
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="1">Revealed</option>
              </select>
            </label>
          )}

          {!localMode && (
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
              Scene
              <select
                aria-label="Terrain scene"
                value={sceneId}
                onChange={(event) => changeSceneSetting("scene", event.target.value)}
                className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white"
              >
                {TERRAIN_VERIFICATION_SCENE_IDS.map((value) => (
                  <option key={value} value={value}>
                    {formatSceneLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
            Renderer
            <select
              value={forceWebGL ? "webgpu-force-webgl" : "webgpu-auto"}
              onChange={(event) => changeSceneSetting("rendererMode", event.target.value)}
              className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white"
            >
              <option value="webgpu-auto">WebGPU auto</option>
              <option value="webgpu-force-webgl">WebGL2 fallback</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-stone-300">
            Ground shading
            <select
              value={texturedGround ? "textured" : "flat"}
              onChange={(event) => changeSceneSetting("groundMode", event.target.value)}
              className="h-10 border border-white/15 bg-stone-950 px-3 text-sm font-medium normal-case text-white"
            >
              <option value="textured">Textured PBR</option>
              <option value="flat">Flat diagnostic</option>
            </select>
          </label>

          <TerrainLabMetrics
            rendererRef={rendererRef}
            ready={ready}
            localMode={localMode}
            onBuildingCount={setBuildingCount}
          />

          <button
            type="button"
            onClick={() => rendererRef.current?.resetCamera()}
            className="flex h-10 items-center justify-center gap-2 border border-emerald-300/35 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100"
          >
            <RefreshCw className="h-4 w-4" />
            Reset Camera
          </button>
        </aside>
      )}

      <div
        className={cn(
          "relative overflow-hidden bg-[#d8d0ba]",
          capture ? "h-screen w-screen" : "h-[max(600px,calc(var(--lab-viewport-height)-2rem))]",
        )}
      >
        <canvas
          ref={canvasRef}
          id="procedural-terrain-debug-canvas"
          className="h-full w-full touch-none"
          aria-label="Game-scale procedural terrain biome field"
        />
        {error && (
          <div
            role="alert"
            className="absolute inset-x-4 top-4 border border-red-300/40 bg-red-950/90 p-3 text-sm text-red-100"
          >
            {error}
          </div>
        )}
      </div>
    </section>
  );
};

function TerrainLabMetrics({
  rendererRef,
  ready,
  localMode,
  onBuildingCount,
}: {
  rendererRef: RefObject<ProceduralTerrainDebugRendererHandle | null>;
  ready: boolean;
  localMode: boolean;
  onBuildingCount: (count: number) => void;
}) {
  const [stats, setStats] = useState(EMPTY_STATS);
  useEffect(() => {
    if (!ready) return;
    const renderer = rendererRef.current;
    if (!renderer) return;
    // Frame telemetry must not rerender native selects while their menus are open.
    const refresh = () => {
      const next = renderer.getStats();
      setStats(next);
      onBuildingCount(next.buildingInstances);
    };
    refresh();
    const timer = window.setInterval(refresh, 500);
    return () => window.clearInterval(timer);
  }, [ready, rendererRef, onBuildingCount]);

  return (
    <>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <DebugMetric label="Backend" value={stats.activeMode === "webgpu" ? "WebGPU" : "WebGL2"} />
        <DebugMetric label="Scene" value={localMode ? "Local settlement" : formatSceneLabel(stats.sceneId)} />
        <DebugMetric label="Quality" value={formatSceneLabel(stats.qualityTier)} />
        <DebugMetric label="Reveal" value={`${Math.round(stats.revealProgress * 100)}%`} />
        <DebugMetric label="Biomes" value={String(stats.biomeCount || "--")} />
        <DebugMetric label="Hexes" value={stats.cellCount.toLocaleString()} />
        <DebugMetric label="Calls" value={String(stats.drawCalls || "--")} />
        <DebugMetric label="Props" value={stats.propInstances.toLocaleString()} />
        <DebugMetric label="Ground cover" value={stats.groundCoverInstances.toLocaleString()} />
        <DebugMetric label="Realms" value={stats.realmInstances.toLocaleString()} />
        <DebugMetric label="Roads" value={stats.roadSegments.toLocaleString()} />
        <DebugMetric label="Settlements" value={stats.settlementSites.toLocaleString()} />
        <DebugMetric label="Settlement tiers" value={stats.settlementTierCount.toLocaleString()} />
        <DebugMetric label="Road verge" value={stats.roadVergeSuccession.toFixed(2)} />
        <DebugMetric label="Wetland edge" value={stats.wetlandEdgeStrength.toFixed(2)} />
        <DebugMetric label="Water vertices" value={stats.waterVertices.toLocaleString()} />
        <DebugMetric label="Water contour" value={stats.waterShorelineVertices.toLocaleString()} />
        <DebugMetric
          label="Water depth"
          value={`${stats.waterDepthMin.toFixed(3)}–${stats.waterDepthMax.toFixed(3)}`}
        />
        <DebugMetric label="Foam coast" value={stats.waterFoamVertices.toLocaleString()} />
        <DebugMetric label="Water FX" value={stats.waterInteractionInstances.toLocaleString()} />
        <DebugMetric label="Boat wakes" value={stats.waterWakeInstances.toLocaleString()} />
        <DebugMetric
          label="Dust puffs"
          value={`${stats.dustActiveParticles.toLocaleString()}/${stats.dustCapacity.toLocaleString()}`}
        />
        <DebugMetric label="Dust movers" value={stats.dustEmitterCount.toLocaleString()} />
        <DebugMetric label="Fog cells" value={stats.shroudInstances.toLocaleString()} />
        <DebugMetric label="Frontier" value={stats.shroudFrontierInstances.toLocaleString()} />
        <DebugMetric label="Fog terrain" value={stats.fogTerrainCells.toLocaleString()} />
        <DebugMetric
          label="Fog mask"
          value={stats.fogMaskWidth ? `${stats.fogMaskWidth}×${stats.fogMaskHeight}` : "--"}
        />
        <DebugMetric label="Fog KB" value={Math.round(stats.fogMaskBytes / 1024).toLocaleString()} />
        <DebugMetric label="Fog opacity" value={`${Math.round(stats.fogOpacity * 100)}%`} />
        <DebugMetric label="Active reveal" value={stats.shroudActiveReveals.toLocaleString()} />
        <DebugMetric label="Ground" value={`${stats.groundTextureLayers || "--"} layers`} />
        <DebugMetric label="Ground KB" value={Math.round(stats.groundTextureBytes / 1024).toLocaleString()} />
        <DebugMetric label="Frame p50" value={`${stats.frameP50Ms.toFixed(1)} ms`} />
        <DebugMetric label="Frame p95" value={`${stats.frameP95Ms.toFixed(1)} ms`} />
        <DebugMetric label="Frame worst" value={`${stats.frameWorstMs.toFixed(1)} ms`} />
        <DebugMetric label="Textures" value={String(stats.textures || "--")} />
        <DebugMetric label="Triangles" value={stats.triangles.toLocaleString()} />
        <DebugMetric label="Prepare" value={`${stats.prepareMs.toFixed(1)} ms`} />
        <DebugMetric label="Commit" value={`${stats.commitMs.toFixed(1)} ms`} />
        <DebugMetric label="First render" value={`${stats.firstRenderMs.toFixed(1)} ms`} />
      </dl>

      <div className="flex items-center justify-between gap-3 text-[0.68rem] text-stone-500">
        <span>Fingerprint</span>
        <code>{stats.fingerprint}</code>
      </div>
    </>
  );
}

const DebugMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-white/10 bg-white/[0.04] px-2 py-2">
    <dt className="text-[0.6rem] font-semibold uppercase text-stone-500">{label}</dt>
    <dd className="mt-1 truncate font-mono text-xs text-white">{value}</dd>
  </div>
);

function resolveSceneId(value: string | null): TerrainVerificationSceneId {
  return TERRAIN_VERIFICATION_SCENE_IDS.includes(value as TerrainVerificationSceneId)
    ? (value as TerrainVerificationSceneId)
    : "all-biomes";
}

function resolveQualityTier(value: string | null): TerrainQualityTier {
  return TERRAIN_QUALITY_TIERS.includes(value as TerrainQualityTier) ? (value as TerrainQualityTier) : "detail";
}

function resolveRevealProgress(value: string | null): number {
  const progress = value === null ? 0 : Number(value);
  return Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
}

function formatSceneLabel(value: TerrainQualityTier | TerrainVerificationSceneId): string {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
