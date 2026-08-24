import { Activity, Dices, Gauge, Pause, Play, RotateCcw, Skull, StepForward, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from "react";
import { Link } from "react-router-dom";

import {
  applyProceduralCharacterBenchmarkConfigPatch,
  createDefaultProceduralCharacterBenchmarkConfig,
  createProceduralCharacterWalkingPerformanceConfig,
  createProceduralWorldGymConfig,
  type ProceduralCharacterBenchmarkConfig,
} from "@/three/characters/benchmark/procedural-character-benchmark-config";
import {
  mountProceduralCharacterBenchmarkRenderer,
  type ProceduralCharacterBenchmarkEnvironment,
  type ProceduralCharacterBenchmarkRendererHandle,
  type ProceduralCharacterBenchmarkStats,
} from "@/three/characters/benchmark/procedural-character-benchmark-renderer";
import { ProceduralCharacterPerformanceEvaluator } from "@/three/characters/benchmark/procedural-character-performance-evaluation";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useBootDocumentState } from "@/ui/modules/boot-loader";

const INITIAL_STATS: ProceduralCharacterBenchmarkStats = {
  actorCount: 0,
  animationUpdateLaneCount: 1,
  averageFrameMs: 0,
  collisionBodyCount: 0,
  collisionCandidatePairCount: 0,
  collisionDroppedPairCount: 0,
  collisionMaximumOffset: 0,
  collisionResolvedPairCount: 0,
  drawCalls: 0,
  environmentMode: "hex",
  fps: 0,
  geometryCount: 0,
  hexCount: 100,
  loadingActors: true,
  meleeActiveImpactCount: 0,
  meleeContactCount: 0,
  meleeDroppedCount: 0,
  maximumAnimatedMountBoneStretchRatio: 1,
  maximumLoadingMountHoofReach: 0,
  maximumRagdollMountBoneStretchRatio: 1,
  p95FrameMs: 0,
  physicsBodyCount: 0,
  physicsConstraintCount: 0,
  physicsFailures: [],
  pixelRatio: 1,
  performance: new ProceduralCharacterPerformanceEvaluator().getSnapshot(),
  projectileActiveCount: 0,
  projectileDroppedCount: 0,
  projectileHitCount: 0,
  projectileStuckCount: 0,
  ragdollCount: 0,
  rendererMode: "initializing",
  resetCount: 0,
  respawnCount: 0,
  runningCount: 0,
  simulationElapsedSeconds: 0,
  simulationSteps: 0,
  textureCount: 0,
  terrainBiomeCount: 0,
  terrainCellCount: 0,
  terrainGroundedActorCount: 0,
  terrainMaximumRootError: 0,
  terrainPropCount: 0,
  terrainSurfaceMissCount: 0,
  terrainTriangles: 0,
  totalDeaths: 0,
  triangles: 0,
  visibleHexCount: 0,
  wasmHeapMiB: 0,
};
const integerFormatter = new Intl.NumberFormat("en-US");
const compactIntegerFormatter = new Intl.NumberFormat("en-US", { notation: "compact" });

interface ProceduralCharacterBenchmarkDebugBridge {
  getConfig(): ProceduralCharacterBenchmarkConfig;
  getStats(): ProceduralCharacterBenchmarkStats;
  applyConfigPatch(patch: Partial<ProceduralCharacterBenchmarkConfig>): void;
  applyWalkingPerformanceProfile(): void;
  killBurst(): void;
  reset(): void;
  startPerformanceEvaluation(): Promise<void>;
}

declare global {
  interface Window {
    __proceduralCharacterBenchmark?: ProceduralCharacterBenchmarkDebugBridge;
    __proceduralWorldGym?: ProceduralCharacterBenchmarkDebugBridge;
  }
}

type BenchmarkExperienceMode = "characters" | "world";

export const ProceduralCharacterBenchmarkView = () => <ProceduralCharacterBenchmarkExperience mode="characters" />;

export const ProceduralWorldGymView = () => <ProceduralCharacterBenchmarkExperience mode="world" />;

const ProceduralCharacterBenchmarkExperience = ({ mode }: { mode: BenchmarkExperienceMode }) => {
  const worldGym = mode === "world";
  useBootDocumentState("app-ready", worldGym ? "procedural_world_gym_ready" : "procedural_character_benchmark_ready");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ProceduralCharacterBenchmarkRendererHandle | null>(null);
  const [config, setConfig] = useState(
    worldGym ? createProceduralWorldGymConfig : createDefaultProceduralCharacterBenchmarkConfig,
  );
  const configRef = useRef(config);
  const statsRef = useRef(INITIAL_STATS);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [rendererError, setRendererError] = useState<string | null>(null);

  useEffect(
    () =>
      mountBenchmarkRenderer(
        containerRef,
        rendererRef,
        configRef,
        statsRef,
        worldGym ? "procedural-biomes" : "hex",
        setReady,
        setStats,
        setRendererError,
      ),
    [worldGym],
  );

  useEffect(() => {
    configRef.current = config;
    const update = rendererRef.current?.updateConfig(config);
    if (update) void update.catch((error) => setRendererError(resolveRendererErrorMessage(error)));
  }, [config]);

  const patchConfig = useCallback((patch: Partial<ProceduralCharacterBenchmarkConfig>) => {
    setConfig((current) => applyProceduralCharacterBenchmarkConfigPatch(current, patch));
  }, []);

  const reset = useCallback(() => {
    setRendererError(null);
    setPaused(false);
    rendererRef.current?.setPaused(false);
    rendererRef.current?.reset();
  }, []);

  const killBurst = useCallback(() => {
    setRendererError(null);
    rendererRef.current?.killBurst();
  }, []);

  const applyWalkingPerformanceProfile = useCallback(() => {
    setConfig(createProceduralCharacterWalkingPerformanceConfig());
  }, []);

  const startPerformanceEvaluation = useCallback(
    () => rendererRef.current?.startPerformanceEvaluation() ?? Promise.resolve(),
    [],
  );

  useEffect(
    () =>
      exposeBenchmarkDebugBridge(
        configRef,
        statsRef,
        patchConfig,
        applyWalkingPerformanceProfile,
        startPerformanceEvaluation,
        reset,
        killBurst,
        worldGym,
      ),
    [applyWalkingPerformanceProfile, killBurst, patchConfig, reset, startPerformanceEvaluation, worldGym],
  );

  const togglePaused = useCallback(() => {
    setPaused((current) => {
      rendererRef.current?.setPaused(!current);
      return !current;
    });
  }, []);

  return (
    <section
      className="flex min-h-screen flex-col overflow-hidden bg-[#070b12] text-slate-100 lg:h-screen"
      data-actor-count={stats.actorCount}
      data-collision-body-count={stats.collisionBodyCount}
      data-benchmark-ready={ready && !stats.loadingActors ? "true" : "false"}
      data-performance-status={stats.performance.status}
      data-debug-route={worldGym ? "procedural-world-gym" : "procedural-character-benchmark"}
      data-terrain-biome-count={stats.terrainBiomeCount}
      data-terrain-grounded-actors={stats.terrainGroundedActorCount}
      data-terrain-ready={worldGym && stats.terrainCellCount > 0 ? "true" : "false"}
      data-simulation-paused={paused ? "true" : "false"}
      data-total-deaths={stats.totalDeaths}
      data-projectile-count={stats.projectileActiveCount}
    >
      <BenchmarkHeader
        canKill={config.maxActiveRagdolls > 0}
        paused={paused}
        ready={ready}
        stats={stats}
        onKillBurst={killBurst}
        onMeasure={() => void startPerformanceEvaluation()}
        onReset={reset}
        onStep={() => rendererRef.current?.stepOnce()}
        onTogglePaused={togglePaused}
        worldGym={worldGym}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[330px_minmax(0,1fr)]">
        <BenchmarkControls
          config={config}
          onApplyWalkingPerformanceProfile={applyWalkingPerformanceProfile}
          onPatchConfig={patchConfig}
          onResetCamera={() => rendererRef.current?.resetCamera()}
          worldGym={worldGym}
        />
        <BenchmarkViewport
          config={config}
          containerRef={containerRef}
          ready={ready}
          rendererError={rendererError}
          stats={stats}
          worldGym={worldGym}
        />
      </div>
    </section>
  );
};

function mountBenchmarkRenderer(
  containerRef: RefObject<HTMLDivElement>,
  rendererRef: MutableRefObject<ProceduralCharacterBenchmarkRendererHandle | null>,
  configRef: MutableRefObject<ProceduralCharacterBenchmarkConfig>,
  statsRef: MutableRefObject<ProceduralCharacterBenchmarkStats>,
  environment: ProceduralCharacterBenchmarkEnvironment,
  setReady: (ready: boolean) => void,
  setStats: (stats: ProceduralCharacterBenchmarkStats) => void,
  setRendererError: (message: string) => void,
): () => void {
  const container = containerRef.current;
  if (!container) return () => undefined;
  let cancelled = false;

  void mountProceduralCharacterBenchmarkRenderer({
    config: configRef.current,
    container,
    environment,
    onStats: (nextStats) => {
      statsRef.current = nextStats;
      setStats(nextStats);
    },
  })
    .then((handle) => {
      if (cancelled) {
        handle.dispose();
        return;
      }
      rendererRef.current = handle;
      setReady(true);
    })
    .catch((error) => {
      if (!cancelled) setRendererError(resolveRendererErrorMessage(error));
    });

  return () => {
    cancelled = true;
    rendererRef.current?.dispose();
    rendererRef.current = null;
    window.__proceduralCharacterBenchmark = undefined;
    window.__proceduralWorldGym = undefined;
  };
}

function exposeBenchmarkDebugBridge(
  configRef: MutableRefObject<ProceduralCharacterBenchmarkConfig>,
  statsRef: MutableRefObject<ProceduralCharacterBenchmarkStats>,
  patchConfig: (patch: Partial<ProceduralCharacterBenchmarkConfig>) => void,
  applyWalkingPerformanceProfile: () => void,
  startPerformanceEvaluation: () => Promise<void>,
  reset: () => void,
  killBurst: () => void,
  worldGym: boolean,
): () => void {
  const bridge: ProceduralCharacterBenchmarkDebugBridge = {
    applyConfigPatch: patchConfig,
    applyWalkingPerformanceProfile,
    getConfig: () => ({ ...configRef.current }),
    getStats: () => ({ ...statsRef.current, physicsFailures: [...statsRef.current.physicsFailures] }),
    killBurst,
    reset,
    startPerformanceEvaluation,
  };
  if (worldGym) window.__proceduralWorldGym = bridge;
  else window.__proceduralCharacterBenchmark = bridge;
  return () => {
    if (worldGym) window.__proceduralWorldGym = undefined;
    else window.__proceduralCharacterBenchmark = undefined;
  };
}

const BenchmarkHeader = ({
  canKill,
  paused,
  ready,
  stats,
  onKillBurst,
  onMeasure,
  onReset,
  onStep,
  onTogglePaused,
  worldGym,
}: {
  canKill: boolean;
  paused: boolean;
  ready: boolean;
  stats: ProceduralCharacterBenchmarkStats;
  onKillBurst(): void;
  onMeasure(): void;
  onReset(): void;
  onStep(): void;
  onTogglePaused(): void;
  worldGym: boolean;
}) => (
  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0a1019]/95 px-4 py-3 backdrop-blur-xl lg:px-6">
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
        <Gauge className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-cyan-200/60">
          {worldGym ? "Integrated world laboratory" : "Crowd laboratory"}
        </p>
        <h1 className="truncate text-lg font-semibold text-white sm:text-xl">
          {worldGym ? "Procedural World Gym" : "Procedural Character Benchmark"}
        </h1>
      </div>
      <BenchmarkBadge label={stats.rendererMode} tone="cyan" />
      <BenchmarkBadge label={`${stats.actorCount}/100 actors`} tone={stats.actorCount === 100 ? "emerald" : "amber"} />
      {worldGym && <BenchmarkBadge label={`${stats.terrainBiomeCount} biomes`} tone="emerald" />}
      <BenchmarkBadge label={`${stats.ragdollCount} ragdolls`} tone="violet" />
      <BenchmarkBadge
        label={`60 FPS ${stats.performance.status}`}
        tone={stats.performance.status === "pass" ? "emerald" : stats.performance.status === "fail" ? "amber" : "cyan"}
      />
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <BenchmarkAction
        icon={<Skull />}
        label="Kill burst"
        onClick={onKillBurst}
        disabled={!ready || !canKill}
        primary
      />
      <BenchmarkAction icon={<Gauge />} label="Measure" onClick={onMeasure} disabled={!ready} />
      <BenchmarkAction
        icon={paused ? <Play /> : <Pause />}
        label={paused ? "Resume" : "Pause"}
        onClick={onTogglePaused}
        disabled={!ready}
      />
      <BenchmarkAction icon={<StepForward />} label="Step" onClick={onStep} disabled={!ready || !paused} />
      <BenchmarkAction icon={<RotateCcw />} label="Reset" onClick={onReset} disabled={!ready} />
      <Link
        to={worldGym ? "/debug/procedural-character-benchmark" : "/debug/procedural-world-gym"}
        className="grid h-9 place-items-center border border-white/10 px-3 text-xs font-semibold uppercase tracking-wider text-slate-300 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
      >
        {worldGym ? "Hex lab" : "World gym"}
      </Link>
      <Link
        to="/debug/procedural-characters"
        className="grid h-9 place-items-center border border-white/10 px-3 text-xs font-semibold uppercase tracking-wider text-slate-300 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
      >
        Animation
      </Link>
      <Link
        to="/"
        className="grid h-9 place-items-center border border-white/10 px-3 text-xs font-semibold uppercase tracking-wider text-slate-300 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
      >
        Exit
      </Link>
    </div>
  </header>
);

const BenchmarkControls = ({
  config,
  onApplyWalkingPerformanceProfile,
  onPatchConfig,
  onResetCamera,
  worldGym,
}: {
  config: ProceduralCharacterBenchmarkConfig;
  onApplyWalkingPerformanceProfile(): void;
  onPatchConfig(patch: Partial<ProceduralCharacterBenchmarkConfig>): void;
  onResetCamera(): void;
  worldGym: boolean;
}) => (
  <aside className="order-2 max-h-[48vh] overflow-y-auto border-t border-white/10 bg-[#0b111b] lg:order-1 lg:max-h-none lg:border-t-0 lg:border-r">
    <div className="space-y-3 p-4">
      <div className="border border-cyan-300/15 bg-cyan-300/[0.045] p-3 text-xs leading-relaxed text-slate-300">
        {worldGym
          ? "The production terrain and army runtimes now share one renderer and lifecycle. One hundred mixed units walk across sixteen generated biomes while grounding, props, frame cost, collisions, and GPU resources remain observable."
          : "The production runtime now mixes Archers, Knights, Crossbowmen, horses, and mounted Paladins. One pooled arrow owner and one shared Jolt world keep volleys, gait, rider, crowd, and death costs comparable."}
      </div>
      <ControlSection title="Population" icon={<Users />} defaultOpen>
        <button
          type="button"
          onClick={onApplyWalkingPerformanceProfile}
          className="flex h-9 w-full items-center justify-center gap-2 border border-emerald-300/30 bg-emerald-300/[0.08] text-xs font-semibold uppercase tracking-wider text-emerald-100 transition hover:bg-emerald-300/[0.14]"
        >
          <Gauge className="h-3.5 w-3.5" /> 60 FPS walking profile
        </button>
        <ToggleControl
          label="Presentation collisions"
          checked={config.collisions}
          onChange={(collisions) => onPatchConfig({ collisions })}
        />
        <ToggleControl
          label="Archer volleys"
          checked={config.archerVolleys}
          onChange={(archerVolleys) => onPatchConfig({ archerVolleys })}
        />
        <ToggleControl
          label="Melee attacks"
          checked={config.meleeAttacks}
          onChange={(meleeAttacks) => onPatchConfig({ meleeAttacks })}
        />
        <SegmentedControl
          label="Actors"
          columns={4}
          value={String(config.actorCount)}
          options={[25, 50, 75, 100].map((value) => ({ label: String(value), value: String(value) }))}
          onChange={(value) => onPatchConfig({ actorCount: Number(value) })}
        />
        <SegmentedControl
          label="Unit mix"
          columns={3}
          value={config.unitMix}
          options={[
            { value: "balanced", label: "All" },
            { value: "archers", label: "Bows" },
            { value: "foot", label: "Foot" },
            { value: "melee", label: "Melee" },
            { value: "horses", label: "Horse" },
            { value: "mounted", label: "Mount" },
          ]}
          onChange={(unitMix) => onPatchConfig({ unitMix: unitMix as ProceduralCharacterBenchmarkConfig["unitMix"] })}
        />
        <RangeControl
          label="Character scale"
          value={config.characterScale}
          min={0.2}
          max={0.8}
          step={0.01}
          onChange={(characterScale) => onPatchConfig({ characterScale })}
        />
        <NumberControl
          label="Deterministic seed"
          value={config.seed}
          min={0}
          max={2_147_483_647}
          step={1}
          onChange={(seed) => onPatchConfig({ seed })}
        />
        <button
          type="button"
          onClick={() => onPatchConfig({ seed: Math.floor(Math.random() * 2_147_483_647) })}
          className="flex h-9 w-full items-center justify-center gap-2 border border-white/10 bg-white/[0.035] text-xs font-semibold uppercase tracking-wider text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Dices className="h-3.5 w-3.5" /> New seed
        </button>
      </ControlSection>
      <ControlSection title="Motion" icon={<Activity />} defaultOpen>
        <SegmentedControl
          label="Locomotion"
          columns={2}
          value={config.locomotionMode}
          options={[
            { value: "walk", label: "Walk" },
            { value: "run", label: "Run" },
          ]}
          onChange={(locomotionMode) =>
            onPatchConfig({ locomotionMode: locomotionMode as ProceduralCharacterBenchmarkConfig["locomotionMode"] })
          }
        />
        <RangeControl
          label="Animation update lanes"
          value={config.animationUpdateLanes}
          min={1}
          max={4}
          step={1}
          onChange={(animationUpdateLanes) => onPatchConfig({ animationUpdateLanes })}
        />
        <RangeControl
          label="Simulation speed"
          value={config.simulationSpeed}
          min={0.1}
          max={3}
          step={0.05}
          onChange={(simulationSpeed) => onPatchConfig({ simulationSpeed })}
        />
        <RangeControl
          label="Travel speed"
          value={config.movementSpeed}
          min={0.1}
          max={3}
          step={0.05}
          onChange={(movementSpeed) => onPatchConfig({ movementSpeed })}
        />
        <RangeControl
          label="Animation speed"
          value={config.animationSpeed}
          min={0}
          max={3}
          step={0.05}
          onChange={(animationSpeed) => onPatchConfig({ animationSpeed })}
        />
        <RangeControl
          label="Stride"
          value={config.stride}
          min={0}
          max={1.4}
          step={0.02}
          onChange={(stride) => onPatchConfig({ stride })}
        />
        <RangeControl
          label="Step height"
          value={config.stepHeight}
          min={0}
          max={0.8}
          step={0.02}
          onChange={(stepHeight) => onPatchConfig({ stepHeight })}
        />
      </ControlSection>
      <ControlSection title="Death cycle" icon={<Skull />} defaultOpen>
        <RangeControl
          label="Deaths / second"
          value={config.deathsPerSecond}
          min={0}
          max={10}
          step={0.25}
          onChange={(deathsPerSecond) => onPatchConfig({ deathsPerSecond })}
        />
        <RangeControl
          label="Max Jolt ragdolls"
          value={config.maxActiveRagdolls}
          min={0}
          max={20}
          step={1}
          onChange={(maxActiveRagdolls) => onPatchConfig({ maxActiveRagdolls })}
        />
        <RangeControl
          label="Corpse lifetime"
          value={config.corpseSeconds}
          min={0.5}
          max={12}
          step={0.25}
          suffix="s"
          onChange={(corpseSeconds) => onPatchConfig({ corpseSeconds })}
        />
      </ControlSection>
      <ControlSection title="Render" icon={<Gauge />}>
        <RangeControl
          label="Pixel ratio"
          value={config.pixelRatio}
          min={0.75}
          max={1.5}
          step={0.05}
          onChange={(pixelRatio) => onPatchConfig({ pixelRatio })}
        />
        <ToggleControl
          label="Auto orbit"
          checked={config.autoRotate}
          onChange={(autoRotate) => onPatchConfig({ autoRotate })}
        />
        <ToggleControl
          label="Real shadows"
          checked={config.shadows}
          onChange={(shadows) => onPatchConfig({ shadows })}
        />
        <button
          type="button"
          onClick={onResetCamera}
          className="flex h-9 w-full items-center justify-center gap-2 border border-white/10 bg-white/[0.035] text-xs font-semibold uppercase tracking-wider text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset camera
        </button>
      </ControlSection>
    </div>
  </aside>
);

const BenchmarkViewport = ({
  config,
  containerRef,
  ready,
  rendererError,
  stats,
  worldGym,
}: {
  config: ProceduralCharacterBenchmarkConfig;
  containerRef: RefObject<HTMLDivElement>;
  ready: boolean;
  rendererError: string | null;
  stats: ProceduralCharacterBenchmarkStats;
  worldGym: boolean;
}) => (
  <main className="relative order-1 min-h-[52vh] overflow-hidden lg:order-2 lg:min-h-0">
    <div ref={containerRef} className="absolute inset-0" />
    {(!ready || stats.loadingActors) && !rendererError && (
      <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[#070b12]/88 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-200" />
          <div>
            <p className="text-sm font-semibold text-white">
              {worldGym ? "Growing biomes and articulated crowd" : "Building articulated crowd"}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-400">
              {stats.actorCount} / {config.actorCount} actors
            </p>
          </div>
        </div>
      </div>
    )}
    {rendererError && (
      <div className="absolute inset-x-4 bottom-4 z-30 border border-red-300/35 bg-red-950/90 p-4 text-sm text-red-100 backdrop-blur">
        <p className="font-semibold">
          {worldGym ? "Unable to start the procedural world gym." : "Unable to start the character benchmark."}
        </p>
        <p className="mt-1 text-red-200/75">{rendererError}</p>
      </div>
    )}
    <div className="pointer-events-none absolute top-4 right-4 left-4 z-20 flex flex-wrap items-start justify-between gap-3">
      <div className="border border-white/10 bg-[#090e17]/82 px-3 py-2 backdrop-blur-md">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Simulation</p>
        <p className="mt-1 text-sm text-white">
          {worldGym
            ? `${stats.terrainBiomeCount} biomes · ${stats.terrainCellCount} terrain cells · ${stats.terrainPropCount} props · ${stats.terrainGroundedActorCount}/${stats.runningCount} grounded · `
            : ""}
          {stats.visibleHexCount}/{stats.hexCount} hexes visible · {stats.runningCount} running · {stats.ragdollCount}{" "}
          ragdolls · seed {config.seed}
          {stats.projectileActiveCount > 0
            ? ` · ${stats.projectileActiveCount} arrows · ${stats.projectileHitCount} hits`
            : ""}
          {stats.meleeContactCount > 0
            ? ` · ${stats.meleeActiveImpactCount} melee FX · ${stats.meleeContactCount} contacts`
            : ""}
          {config.collisions
            ? ` · ${stats.collisionResolvedPairCount} body contacts · ${stats.collisionMaximumOffset}m max offset`
            : " · collisions off"}
          {` · ${stats.performance.sampleCount}/${stats.performance.sampleTarget} perf frames · ${stats.performance.status}`}
        </p>
      </div>
      {stats.physicsFailures.length > 0 && (
        <div className="max-w-sm border border-red-300/30 bg-red-950/80 px-3 py-2 text-xs text-red-100 backdrop-blur-md">
          {stats.physicsFailures.join(" · ")}
        </div>
      )}
    </div>
    <BenchmarkMetrics stats={stats} worldGym={worldGym} />
  </main>
);

const BenchmarkMetrics = ({ stats, worldGym }: { stats: ProceduralCharacterBenchmarkStats; worldGym: boolean }) => (
  <div className="pointer-events-none absolute right-4 bottom-4 left-4 z-20 grid max-h-28 grid-cols-4 gap-2 overflow-hidden min-[380px]:grid-cols-6 sm:max-h-none xl:left-auto xl:w-[900px] xl:grid-cols-[repeat(10,minmax(0,1fr))]">
    <Metric label="FPS" value={stats.fps || "--"} />
    <Metric label="Avg" value={stats.averageFrameMs ? `${stats.averageFrameMs}ms` : "--"} />
    <Metric label="P95" value={stats.p95FrameMs ? `${stats.p95FrameMs}ms` : "--"} />
    <Metric label="1% low" value={stats.performance.onePercentLowFps || "--"} />
    <Metric label="CPU P95" value={formatMilliseconds(stats.performance.totalCpuMs.p95)} />
    <Metric label="Coll P95" value={formatMilliseconds(stats.performance.collisionCpuMs.p95)} />
    <Metric label="GPU P95" value={formatMilliseconds(stats.performance.gpuFrameMs?.p95)} />
    <Metric label="60Hz work" value={stats.performance.headroomPass ? "PASS" : "--"} />
    <Metric label="Calls" value={formatInteger(stats.drawCalls)} />
    <Metric label="Tris" value={formatInteger(stats.triangles)} />
    {worldGym && <Metric label="Biomes" value={stats.terrainBiomeCount} />}
    {worldGym && <Metric label="Terrain" value={stats.terrainCellCount} />}
    {worldGym && <Metric label="Props" value={formatInteger(stats.terrainPropCount)} />}
    {worldGym && <Metric label="Grounded" value={`${stats.terrainGroundedActorCount}/${stats.runningCount}`} />}
    {worldGym && <Metric label="Ground err" value={`${stats.terrainMaximumRootError}m`} />}
    {worldGym && <Metric label="Surface miss" value={stats.terrainSurfaceMissCount} />}
    <Metric label="Actors" value={stats.actorCount} />
    <Metric label="Lanes" value={stats.animationUpdateLaneCount} />
    <Metric label="DPR" value={stats.pixelRatio} />
    <Metric label="Deaths" value={stats.totalDeaths} />
    <Metric label="Respawns" value={stats.respawnCount} />
    <Metric label="Bodies" value={stats.physicsBodyCount} />
    <Metric label="Joints" value={stats.physicsConstraintCount} />
    <Metric label="Arrows" value={stats.projectileActiveCount} />
    <Metric label="Hits" value={stats.projectileHitCount} />
    <Metric label="Melee" value={stats.meleeActiveImpactCount} />
    <Metric label="Contacts" value={stats.meleeContactCount} />
    <Metric label="Coll bodies" value={stats.collisionBodyCount} />
    <Metric label="Body pairs" value={stats.collisionResolvedPairCount} />
    <Metric label="Dropped" value={stats.collisionDroppedPairCount} />
    <Metric label="Mount stretch" value={`${stats.maximumAnimatedMountBoneStretchRatio}×`} />
    <Metric label="Mount load reach" value={`${stats.maximumLoadingMountHoofReach}×`} />
    <Metric label="Ragdoll stretch" value={`${stats.maximumRagdollMountBoneStretchRatio}×`} />
    <Metric label="GPU" value={`${stats.geometryCount}/${stats.textureCount}`} />
    <Metric label="Heap" value={stats.wasmHeapMiB ? `${stats.wasmHeapMiB}MB` : "--"} />
  </div>
);

const ControlSection = ({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) => (
  <details open={defaultOpen} className="border border-white/10 bg-black/20">
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-cyan-300">
      {icon}
      {title}
    </summary>
    <div className="space-y-3 border-t border-white/[0.07] p-3">{children}</div>
  </details>
);

const RangeControl = ({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange(value: number): void;
}) => (
  <label className="block">
    <span className="mb-1.5 flex items-center justify-between gap-3 text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">
      {label}
      <span className="font-mono text-slate-200">
        {formatControlValue(value, step)}
        {suffix}
      </span>
    </span>
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-1.5 w-full cursor-pointer accent-cyan-400"
    />
  </label>
);

const NumberControl = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">{label}</span>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-9 w-full border border-white/10 bg-[#080d15] px-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-300/60"
    />
  </label>
);

const SegmentedControl = ({
  label,
  value,
  options,
  columns,
  onChange,
}: {
  columns: 2 | 3 | 4;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange(value: string): void;
}) => (
  <fieldset>
    <legend className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">{label}</legend>
    <div className={cn("grid gap-1", columns === 4 ? "grid-cols-4" : columns === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "h-8 border text-xs font-semibold transition",
            value === option.value
              ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
              : "border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.06] hover:text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  </fieldset>
);

const ToggleControl = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(value: boolean): void;
}) => (
  <label className="flex cursor-pointer items-center justify-between gap-3 py-0.5">
    <span className="text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 accent-cyan-400"
    />
  </label>
);

const BenchmarkAction = ({
  icon,
  label,
  onClick,
  disabled = false,
  primary = false,
}: {
  icon: ReactNode;
  label: string;
  onClick(): void;
  disabled?: boolean;
  primary?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex h-9 items-center gap-2 border px-3 text-xs font-semibold uppercase tracking-wider transition [&_svg]:h-3.5 [&_svg]:w-3.5",
      primary
        ? "border-red-300/45 bg-red-400/15 text-red-100 hover:bg-red-400/25"
        : "border-white/10 bg-white/[0.025] text-slate-300 hover:bg-white/[0.08] hover:text-white",
      disabled && "cursor-not-allowed opacity-35",
    )}
  >
    {icon}
    {label}
  </button>
);

const BenchmarkBadge = ({ label, tone }: { label: string; tone: "amber" | "cyan" | "emerald" | "violet" }) => {
  const tones = {
    amber: "border-amber-300/25 bg-amber-300/[0.08] text-amber-200",
    cyan: "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-200",
    emerald: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200",
    violet: "border-violet-300/25 bg-violet-300/[0.08] text-violet-200",
  };
  return (
    <span className={cn("hidden border px-2 py-1 font-mono text-[0.62rem] uppercase sm:inline", tones[tone])}>
      {label}
    </span>
  );
};

const Metric = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="border border-white/10 bg-[#090e17]/82 px-2 py-1.5 text-right backdrop-blur-md">
    <p className="text-[0.56rem] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-0.5 font-mono text-xs text-slate-100">{value}</p>
  </div>
);

function formatControlValue(value: number, step: number): number {
  if (step >= 1) return Math.round(value);
  const precision = Math.max(0, Math.ceil(-Math.log10(step)));
  return Number(value.toFixed(precision));
}

function formatInteger(value: number): string {
  return (value >= 1_000_000 ? compactIntegerFormatter : integerFormatter).format(value);
}

function formatMilliseconds(value: number | undefined): string {
  return value && value > 0 ? `${value}ms` : "--";
}

function resolveRendererErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown benchmark renderer error.";
}
