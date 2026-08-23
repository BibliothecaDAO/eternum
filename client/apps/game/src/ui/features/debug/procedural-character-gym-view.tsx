import {
  Camera,
  Check,
  FlaskConical,
  Footprints,
  Pause,
  Play,
  RotateCcw,
  Shield,
  StepForward,
  Swords,
  Target,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from "react";
import { Link } from "react-router-dom";

import {
  applyProceduralUnitConfigPatch,
  createDefaultProceduralUnitConfig,
  resolveProceduralCharacterPreset,
  type ProceduralCharacterPresetId,
  type ProceduralUnitConfig,
  type ProceduralUnitConfigPatch,
} from "@/three/characters";
import {
  mountProceduralCharacterGymRenderer,
  type ProceduralCharacterGymRendererHandle,
  type ProceduralCharacterGymStats,
} from "@/three/characters/gym/procedural-character-gym-renderer";
import {
  createProceduralAnimationCaptureReport,
  type ProceduralAnimationCaptureOverlay,
  type ProceduralAnimationCaptureOptions,
  type ProceduralAnimationCaptureResult,
  type ProceduralAnimationCaptureSampling,
  type ProceduralAnimationCaptureSequence,
  type ProceduralAnimationCaptureViewId,
  type ProceduralAnimationFrameCapture,
} from "@/three/characters/gym/procedural-animation-capture";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useBootDocumentState } from "@/ui/modules/boot-loader";

import { CharacterGymControls } from "./procedural-character-gym-controls";
import { ProceduralAnimationInspector } from "./procedural-animation-inspector";

const INITIAL_STATS: ProceduralCharacterGymStats = {
  activeBodies: 0,
  assetLabel: "Loading asset",
  authoredClipCount: 0,
  boneCount: 0,
  bodyCount: 0,
  constraintCount: 0,
  drawCalls: 0,
  fps: 0,
  frameMs: 0,
  geometryCount: 0,
  leftPalmInwardDot: 0,
  minimumBendAlignment: 1,
  meleeContactCount: 0,
  meleeOffhandId: "round-shield",
  meleeOffhandSource: "procedural",
  meleePhase: "idle",
  meleeWeaponId: "iron-longsword",
  meleeWeaponSource: "procedural",
  mode: "animated",
  physicsSteps: 0,
  previewArrowVisible: false,
  projectileActiveCount: 0,
  projectileCapacity: 0,
  projectileDroppedCount: 0,
  projectileHitCount: 0,
  projectileStuckCount: 0,
  rangedPhase: "idle",
  rangedReleaseCount: 0,
  rendererMode: "initializing",
  rightPalmInwardDot: 0,
  smokeFailures: [],
  smokePhase: "idle",
  skinnedMeshCount: 0,
  stanceFootCount: 0,
  stanceHoofCount: 0,
  stringContinuityError: 0,
  triangles: 0,
  textureCount: 0,
  wasmHeapMiB: 0,
};

interface CharacterGymDebugBridge {
  attackMelee(): boolean;
  cancelArrow(): void;
  cancelMelee(): void;
  fireArrow(): boolean;
  captureFrames(
    sampling?: ProceduralAnimationCaptureSampling,
    overlay?: ProceduralAnimationCaptureOverlay,
    options?: Omit<ProceduralAnimationCaptureOptions, "overlay">,
  ): Promise<ProceduralAnimationCaptureResult>;
  getConfig(): ProceduralUnitConfig;
  getAimStats(): ProceduralCharacterGymStats | null;
  getStats(): ProceduralCharacterGymStats;
  getFrameCaptureReport(): unknown;
  getCapturedFrameImage(frameIndex: number, viewId?: ProceduralAnimationCaptureViewId): string | null;
  reset(): void;
  runSmoke(): void;
  seekFrame(
    frameIndex: number,
    sequence?: ProceduralAnimationCaptureSequence,
    rootMotionSpeed?: number,
  ): Promise<ProceduralAnimationFrameCapture>;
  updateConfig(patch: ProceduralUnitConfigPatch): void;
}

declare global {
  interface Window {
    __proceduralCharacterGym?: CharacterGymDebugBridge;
  }
}

export const ProceduralCharacterGymView = () => {
  useBootDocumentState("app-ready", "procedural_character_gym_ready");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ProceduralCharacterGymRendererHandle | null>(null);
  const [config, setConfig] = useState(createInitialGymConfig);
  const configRef = useRef<ProceduralUnitConfig>(config);
  const statsRef = useRef<ProceduralCharacterGymStats>(INITIAL_STATS);
  const aimStatsRef = useRef<ProceduralCharacterGymStats | null>(null);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [paused, setPaused] = useState(false);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<ProceduralCharacterPresetId | "custom">("balanced");
  const captureResultRef = useRef<ProceduralAnimationCaptureResult | null>(null);
  const [captureResult, setCaptureResult] = useState<ProceduralAnimationCaptureResult | null>(null);
  const [selectedCaptureFrame, setSelectedCaptureFrame] = useState<ProceduralAnimationFrameCapture | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);

  useEffect(
    () =>
      mountGymRenderer(
        containerRef,
        rendererRef,
        configRef,
        statsRef,
        aimStatsRef,
        setReady,
        setStats,
        setRendererError,
      ),
    [],
  );

  useEffect(() => {
    configRef.current = config;
    rendererRef.current?.updateConfig(config);
  }, [config]);

  const reset = useCallback(() => {
    aimStatsRef.current = null;
    setRendererError(null);
    rendererRef.current?.reset();
    setPaused(false);
    rendererRef.current?.setPaused(false);
    captureResultRef.current = null;
    setCaptureResult(null);
    setSelectedCaptureFrame(null);
  }, []);

  const runSmoke = useCallback(() => {
    aimStatsRef.current = null;
    setRendererError(null);
    setPaused(false);
    rendererRef.current?.setPaused(false);
    rendererRef.current?.runSmoke();
    captureResultRef.current = null;
    setCaptureResult(null);
    setSelectedCaptureFrame(null);
  }, []);

  const fireArrow = useCallback(() => rendererRef.current?.fireArrow() ?? false, []);
  const cancelArrow = useCallback(() => rendererRef.current?.cancelArrow(), []);
  const attackMelee = useCallback(() => rendererRef.current?.attackMelee() ?? false, []);
  const cancelMelee = useCallback(() => rendererRef.current?.cancelMelee(), []);
  const captureFrames = useCallback(
    async (
      sampling: ProceduralAnimationCaptureSampling = "phase-atlas",
      overlay?: ProceduralAnimationCaptureOverlay,
      options?: Omit<ProceduralAnimationCaptureOptions, "overlay">,
    ) => {
      const renderer = rendererRef.current;
      if (!renderer) throw new Error("Animation renderer is not ready");
      setRendererError(null);
      setCaptureBusy(true);
      setPaused(true);
      renderer.setPaused(true);
      try {
        const result = await renderer.captureAnimationFrames(sampling, { ...options, overlay });
        const selected = selectDefaultCaptureFrame(result);
        captureResultRef.current = result;
        setCaptureResult(result);
        setSelectedCaptureFrame(selected ?? null);
        return result;
      } catch (error) {
        setRendererError(resolveRendererErrorMessage(error));
        throw error;
      } finally {
        setCaptureBusy(false);
      }
    },
    [],
  );
  const seekFrame = useCallback(
    async (frameIndex: number, sequence?: ProceduralAnimationCaptureSequence, rootMotionSpeed?: number) => {
      const renderer = rendererRef.current;
      const resolvedSequence = sequence ?? captureResultRef.current?.plan.sequence;
      if (!renderer || !resolvedSequence) throw new Error("No animation capture is available to scrub");
      setCaptureBusy(true);
      setPaused(true);
      renderer.setPaused(true);
      try {
        const frame = await renderer.seekAnimationFrame(
          frameIndex,
          resolvedSequence,
          rootMotionSpeed ?? captureResultRef.current?.plan.rootMotionSpeed,
        );
        const capturedFrame = captureResultRef.current?.frames.find((candidate) => candidate.frameIndex === frameIndex);
        setSelectedCaptureFrame(capturedFrame ?? frame);
        return frame;
      } finally {
        setCaptureBusy(false);
      }
    },
    [],
  );
  const closeCapture = useCallback(() => {
    captureResultRef.current = null;
    setCaptureResult(null);
    setSelectedCaptureFrame(null);
  }, []);
  const patchConfig = useCallback((patch: ProceduralUnitConfigPatch) => {
    setSelectedPreset("custom");
    setConfig((current) => applyProceduralUnitConfigPatch(current, patch));
    captureResultRef.current = null;
    setCaptureResult(null);
    setSelectedCaptureFrame(null);
  }, []);

  useEffect(
    () =>
      exposeCharacterGymDebugBridge(
        configRef,
        statsRef,
        aimStatsRef,
        reset,
        runSmoke,
        fireArrow,
        cancelArrow,
        attackMelee,
        cancelMelee,
        captureFrames,
        seekFrame,
        captureResultRef,
        patchConfig,
      ),
    [attackMelee, cancelArrow, cancelMelee, captureFrames, fireArrow, patchConfig, reset, runSmoke, seekFrame],
  );

  const applyPreset = useCallback((presetId: ProceduralCharacterPresetId) => {
    setSelectedPreset(presetId);
    setConfig((current) =>
      applyProceduralUnitConfigPatch(current, { humanoid: resolveProceduralCharacterPreset(presetId) }),
    );
    rendererRef.current?.reset();
    captureResultRef.current = null;
    setCaptureResult(null);
    setSelectedCaptureFrame(null);
  }, []);

  const togglePaused = useCallback(() => {
    setPaused((current) => {
      rendererRef.current?.setPaused(!current);
      return !current;
    });
  }, []);

  const copyConfig = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(configRef.current, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_400);
    } catch {
      setCopied(false);
    }
  }, []);

  const runPhysicsAction = useCallback((action: "applyImpulse" | "startRagdoll") => {
    setRendererError(null);
    const promise = rendererRef.current?.[action]();
    if (promise) void promise.catch((error) => setRendererError(resolveRendererErrorMessage(error)));
  }, []);

  return (
    <section
      className="flex min-h-screen flex-col overflow-hidden bg-[#070b13] text-slate-100 lg:h-screen"
      data-debug-route="procedural-characters"
      data-gym-ready={ready ? "true" : "false"}
      data-smoke-phase={stats.smokePhase}
      data-projectile-hits={stats.projectileHitCount}
      data-ranged-phase={stats.rangedPhase}
      data-melee-contacts={stats.meleeContactCount}
      data-melee-phase={stats.meleePhase}
      data-capture-busy={captureBusy ? "true" : "false"}
      data-capture-count={captureResult?.frames.length ?? 0}
      data-capture-frame={selectedCaptureFrame?.frameIndex ?? -1}
      data-capture-image-count={captureResult?.frames.reduce((count, frame) => count + frame.views.length, 0) ?? 0}
      data-capture-overlay={captureResult?.plan.overlay ?? "none"}
      data-capture-view-count={captureResult?.plan.views.length ?? 0}
    >
      <CharacterGymHeader
        stats={stats}
        archer={config.kind === "archer"}
        locomotion={
          config.kind !== "horse" &&
          config.kind !== "paladin" &&
          (config.humanoid.animationMode === "walk" || config.humanoid.animationMode === "run")
        }
        melee={config.kind === "knight" || config.kind === "paladin"}
        paused={paused}
        ready={ready}
        captureBusy={captureBusy}
        onDrop={() => runPhysicsAction("startRagdoll")}
        onCancelArrow={cancelArrow}
        onCancelMelee={cancelMelee}
        onFireArrow={fireArrow}
        onMeleeAttack={attackMelee}
        onCaptureFrames={() => void captureFrames("phase-atlas", "diagnostic")}
        onCaptureGait={() => void captureFrames("phase-atlas", "diagnostic", { sequence: "locomotion-cycle" })}
        onReset={reset}
        onRunSmoke={runSmoke}
        onStep={() => rendererRef.current?.stepOnce()}
        onStrike={() => runPhysicsAction("applyImpulse")}
        onTogglePaused={togglePaused}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[370px_minmax(0,1fr)]">
        <CharacterGymControls
          config={config}
          copied={copied}
          selectedPreset={selectedPreset}
          onApplyPreset={applyPreset}
          onCopyConfig={copyConfig}
          onPatchConfig={patchConfig}
          onResetCamera={() => rendererRef.current?.resetCamera()}
        />
        <CharacterGymViewport
          config={config}
          captureBusy={captureBusy}
          captureResult={captureResult}
          containerRef={containerRef}
          ready={ready}
          rendererError={rendererError}
          stats={stats}
          selectedCaptureFrame={selectedCaptureFrame}
          onCapture={(sampling, overlay, options) => void captureFrames(sampling, overlay, options)}
          onCloseCapture={closeCapture}
          onSelectCaptureFrame={(frameIndex) => void seekFrame(frameIndex)}
        />
      </div>
    </section>
  );
};

function mountGymRenderer(
  containerRef: RefObject<HTMLDivElement>,
  rendererRef: MutableRefObject<ProceduralCharacterGymRendererHandle | null>,
  configRef: MutableRefObject<ProceduralUnitConfig>,
  statsRef: MutableRefObject<ProceduralCharacterGymStats>,
  aimStatsRef: MutableRefObject<ProceduralCharacterGymStats | null>,
  setReady: (ready: boolean) => void,
  setStats: (stats: ProceduralCharacterGymStats) => void,
  setRendererError: (message: string) => void,
): () => void {
  const container = containerRef.current;
  if (!container) return () => undefined;
  let cancelled = false;

  void mountProceduralCharacterGymRenderer({
    config: configRef.current,
    container,
    onStats: (nextStats) => {
      statsRef.current = nextStats;
      if (nextStats.rangedPhase === "aim" && nextStats.previewArrowVisible) aimStatsRef.current = nextStats;
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
  };
}

function exposeCharacterGymDebugBridge(
  configRef: MutableRefObject<ProceduralUnitConfig>,
  statsRef: MutableRefObject<ProceduralCharacterGymStats>,
  aimStatsRef: MutableRefObject<ProceduralCharacterGymStats | null>,
  reset: () => void,
  runSmoke: () => void,
  fireArrow: () => boolean,
  cancelArrow: () => void,
  attackMelee: () => boolean,
  cancelMelee: () => void,
  captureFrames: (
    sampling?: ProceduralAnimationCaptureSampling,
    overlay?: ProceduralAnimationCaptureOverlay,
    options?: Omit<ProceduralAnimationCaptureOptions, "overlay">,
  ) => Promise<ProceduralAnimationCaptureResult>,
  seekFrame: (
    frameIndex: number,
    sequence?: ProceduralAnimationCaptureSequence,
    rootMotionSpeed?: number,
  ) => Promise<ProceduralAnimationFrameCapture>,
  captureResultRef: MutableRefObject<ProceduralAnimationCaptureResult | null>,
  updateConfig: (patch: ProceduralUnitConfigPatch) => void,
): () => void {
  window.__proceduralCharacterGym = {
    attackMelee,
    captureFrames,
    cancelArrow,
    cancelMelee,
    fireArrow,
    getConfig: () => ({ ...configRef.current }),
    getAimStats: () => (aimStatsRef.current ? { ...aimStatsRef.current } : null),
    getFrameCaptureReport: () => createProceduralAnimationCaptureReport(captureResultRef.current),
    getCapturedFrameImage: (frameIndex, viewId) => {
      const frame = captureResultRef.current?.frames.find((candidate) => candidate.frameIndex === frameIndex);
      if (!frame || !viewId) return frame?.imageDataUrl ?? null;
      return frame.views.find((view) => view.id === viewId)?.imageDataUrl ?? null;
    },
    getStats: () => ({ ...statsRef.current, smokeFailures: [...statsRef.current.smokeFailures] }),
    reset,
    runSmoke,
    seekFrame,
    updateConfig,
  };
  return () => {
    window.__proceduralCharacterGym = undefined;
  };
}

interface CharacterGymHeaderProps {
  archer: boolean;
  captureBusy: boolean;
  locomotion: boolean;
  melee: boolean;
  stats: ProceduralCharacterGymStats;
  paused: boolean;
  ready: boolean;
  onDrop(): void;
  onCancelArrow(): void;
  onCancelMelee(): void;
  onCaptureFrames(): void;
  onCaptureGait(): void;
  onFireArrow(): boolean;
  onMeleeAttack(): boolean;
  onReset(): void;
  onRunSmoke(): void;
  onStep(): void;
  onStrike(): void;
  onTogglePaused(): void;
}

const CharacterGymHeader = ({
  archer,
  captureBusy,
  locomotion,
  melee,
  stats,
  paused,
  ready,
  onDrop,
  onCancelArrow,
  onCancelMelee,
  onCaptureFrames,
  onCaptureGait,
  onFireArrow,
  onMeleeAttack,
  onReset,
  onRunSmoke,
  onStep,
  onStrike,
  onTogglePaused,
}: CharacterGymHeaderProps) => (
  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0a0f18]/95 px-4 py-3 backdrop-blur-xl lg:px-6">
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center border border-violet-300/30 bg-violet-400/10 text-violet-200">
        <FlaskConical className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-violet-200/60">
          Renderer laboratory
        </p>
        <h1 className="truncate text-lg font-semibold text-white sm:text-xl">Procedural Character Gym</h1>
      </div>
      <RuntimeBadge label={stats.rendererMode} tone={stats.rendererMode === "webgpu" ? "cyan" : "amber"} />
      <RuntimeBadge label={stats.assetLabel} tone="cyan" />
      <RuntimeBadge label={`Jolt ${stats.mode}`} tone={stats.mode === "ragdoll" ? "violet" : "slate"} />
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {archer && <ActionButton icon={<Target />} label="Fire" onClick={onFireArrow} primary disabled={!ready} />}
      {archer && <ActionButton icon={<X />} label="Cancel draw" onClick={onCancelArrow} disabled={!ready} />}
      {melee && <ActionButton icon={<Swords />} label="Attack" onClick={onMeleeAttack} primary disabled={!ready} />}
      {melee && <ActionButton icon={<X />} label="Cancel attack" onClick={onCancelMelee} disabled={!ready} />}
      <ActionButton
        icon={<Camera />}
        label={captureBusy ? "Capturing" : "Frames"}
        onClick={onCaptureFrames}
        disabled={!ready || captureBusy || stats.mode === "ragdoll"}
      />
      {locomotion && (
        <ActionButton
          icon={<Footprints />}
          label="Gait"
          onClick={onCaptureGait}
          disabled={!ready || captureBusy || stats.mode === "ragdoll"}
        />
      )}
      <ActionButton icon={<FlaskConical />} label="Run smoke" onClick={onRunSmoke} primary disabled={!ready} />
      <ActionButton icon={<Shield />} label="Drop" onClick={onDrop} disabled={!ready || stats.mode === "ragdoll"} />
      <ActionButton icon={<Zap />} label="Strike" onClick={onStrike} disabled={!ready} />
      <ActionButton
        icon={paused ? <Play /> : <Pause />}
        label={paused ? "Resume" : "Pause"}
        onClick={onTogglePaused}
        disabled={!ready}
      />
      <ActionButton icon={<StepForward />} label="Step" onClick={onStep} disabled={!ready || !paused} />
      <ActionButton icon={<RotateCcw />} label="Reset" onClick={onReset} disabled={!ready} />
      <Link
        to="/"
        className="grid h-9 place-items-center border border-white/10 px-3 text-xs font-semibold uppercase tracking-wider text-slate-300 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
      >
        Exit
      </Link>
    </div>
  </header>
);

const CharacterGymViewport = ({
  config,
  captureBusy,
  captureResult,
  containerRef,
  ready,
  rendererError,
  stats,
  selectedCaptureFrame,
  onCapture,
  onCloseCapture,
  onSelectCaptureFrame,
}: {
  config: ProceduralUnitConfig;
  captureBusy: boolean;
  captureResult: ProceduralAnimationCaptureResult | null;
  containerRef: RefObject<HTMLDivElement>;
  onCapture(
    sampling: ProceduralAnimationCaptureSampling,
    overlay?: ProceduralAnimationCaptureOverlay,
    options?: Omit<ProceduralAnimationCaptureOptions, "overlay">,
  ): void;
  onCloseCapture(): void;
  onSelectCaptureFrame(frameIndex: number): void;
  ready: boolean;
  rendererError: string | null;
  stats: ProceduralCharacterGymStats;
  selectedCaptureFrame: ProceduralAnimationFrameCapture | null;
}) => (
  <main
    className={cn(
      "relative order-1 overflow-hidden lg:order-2 lg:min-h-0",
      captureResult ? "min-h-[710px]" : "min-h-[52vh]",
    )}
  >
    <div ref={containerRef} className="absolute inset-0" />
    {!ready && !rendererError && <CharacterGymLoadingState />}
    {rendererError && <CharacterGymError message={rendererError} />}
    <div className="pointer-events-none absolute top-4 right-4 left-4 flex flex-wrap items-start justify-between gap-3">
      <div className="border border-white/10 bg-[#090e17]/80 px-3 py-2 backdrop-blur-md">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Live scenario</p>
        <p className="mt-1 text-sm text-white">
          {stats.assetLabel} · {config.kind} · T{config.humanoid.tier} · seed {config.humanoid.seed} ·{" "}
          {config.kind === "horse" || config.kind === "paladin" ? config.horse.gait : config.humanoid.animationMode}
          {config.kind === "archer" ? ` · ${stats.rangedPhase}` : ""}
          {config.kind === "knight" || config.kind === "paladin"
            ? ` · ${stats.meleeWeaponId} (${stats.meleeWeaponSource}) · ${stats.meleePhase}`
            : ""}
        </p>
      </div>
      <SmokeStatus stats={stats} />
    </div>
    {captureResult && selectedCaptureFrame && (
      <ProceduralAnimationInspector
        busy={captureBusy}
        result={captureResult}
        selectedFrame={selectedCaptureFrame}
        onCapture={onCapture}
        onClose={onCloseCapture}
        onSelectFrame={onSelectCaptureFrame}
      />
    )}
    <CharacterGymMetrics inspectorOpen={Boolean(captureResult)} stats={stats} />
  </main>
);

const CharacterGymLoadingState = () => (
  <div className="absolute inset-0 grid place-items-center bg-[#070b13]">
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300/20 border-t-violet-200" />
      <div>
        <p className="text-sm font-semibold text-white">Loading renderer, Quaternius riders, horse, and Jolt WASM</p>
        <p className="mt-1 text-xs text-slate-500">The CC0 mounted-unit assets load only inside character routes.</p>
      </div>
    </div>
  </div>
);

const CharacterGymError = ({ message }: { message: string }) => (
  <div className="absolute inset-x-4 bottom-4 border border-red-300/35 bg-red-950/90 p-4 text-sm text-red-100 backdrop-blur">
    <p className="font-semibold">Unable to start the procedural character gym.</p>
    <p className="mt-1 text-red-200/75">{message}</p>
  </div>
);

const CharacterGymMetrics = ({
  inspectorOpen,
  stats,
}: {
  inspectorOpen: boolean;
  stats: ProceduralCharacterGymStats;
}) => (
  <div
    className={cn(
      "pointer-events-none absolute right-4 bottom-4 left-4 grid grid-cols-3 gap-2 sm:left-auto sm:w-[790px] sm:grid-cols-12",
      inspectorOpen && "hidden 2xl:grid 2xl:bottom-[245px]",
    )}
  >
    <Metric label="FPS" value={stats.fps || "--"} />
    <Metric label="Frame" value={stats.frameMs ? `${stats.frameMs}ms` : "--"} />
    <Metric label="Calls" value={stats.drawCalls || "--"} />
    <Metric label="Tris" value={stats.triangles || "--"} />
    <Metric label="Bodies" value={`${stats.activeBodies}/${stats.bodyCount}`} />
    <Metric label="Joints" value={stats.constraintCount || "--"} />
    <Metric label="Bones" value={stats.boneCount || "--"} />
    <Metric
      label="Contacts"
      value={stats.meleeContactCount || stats.stanceHoofCount || stats.stanceFootCount || "--"}
    />
    <Metric label="Arrows" value={`${stats.projectileActiveCount}/${stats.projectileCapacity || "--"}`} />
    <Metric label="Hits" value={stats.projectileHitCount || "--"} />
    <Metric label="GPU" value={`${stats.geometryCount}/${stats.textureCount}`} />
    <Metric label="Heap" value={stats.wasmHeapMiB ? `${stats.wasmHeapMiB}MB` : "--"} />
  </div>
);

const ActionButton = ({
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
        ? "border-violet-300/50 bg-violet-400/15 text-violet-100 hover:bg-violet-400/25"
        : "border-white/10 bg-white/[0.025] text-slate-300 hover:bg-white/[0.08] hover:text-white",
      disabled && "cursor-not-allowed opacity-35",
    )}
  >
    {icon}
    {label}
  </button>
);

const RuntimeBadge = ({ label, tone }: { label: string; tone: "amber" | "cyan" | "slate" | "violet" }) => {
  const tones = {
    amber: "border-amber-300/25 bg-amber-300/[0.08] text-amber-200",
    cyan: "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-200",
    slate: "border-white/10 bg-white/[0.04] text-slate-400",
    violet: "border-violet-300/25 bg-violet-300/[0.08] text-violet-200",
  };
  return (
    <span className={cn("hidden border px-2 py-1 font-mono text-[0.62rem] uppercase sm:inline", tones[tone])}>
      {label}
    </span>
  );
};

const Metric = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="border border-white/10 bg-[#090e17]/80 px-2 py-1.5 text-right backdrop-blur-md">
    <p className="text-[0.56rem] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-0.5 font-mono text-xs text-slate-100">{value}</p>
  </div>
);

const SmokeStatus = ({ stats }: { stats: ProceduralCharacterGymStats }) => {
  if (stats.smokePhase === "idle") return null;
  const passed = stats.smokePhase === "passed";
  const failed = stats.smokePhase === "failed";
  return (
    <div
      className={cn(
        "border px-3 py-2 text-right backdrop-blur-md",
        passed && "border-emerald-300/30 bg-emerald-950/70 text-emerald-100",
        failed && "border-red-300/30 bg-red-950/70 text-red-100",
        !passed && !failed && "border-violet-300/25 bg-[#110d20]/80 text-violet-100",
      )}
    >
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] opacity-60">Smoke sequence</p>
      <p className="mt-1 flex items-center justify-end gap-1.5 text-xs font-semibold uppercase">
        {passed && <Check className="h-3.5 w-3.5" />}
        {stats.smokePhase}
      </p>
      {stats.smokeFailures.length > 0 && (
        <p className="mt-1 max-w-xs text-[0.65rem]">{stats.smokeFailures.join(" · ")}</p>
      )}
    </div>
  );
};

function resolveRendererErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown renderer initialization error.";
}

function selectDefaultCaptureFrame(
  result: ProceduralAnimationCaptureResult,
): ProceduralAnimationFrameCapture | undefined {
  const issue = result.frames.find(({ issues }) => issues.length > 0);
  if (issue) return issue;
  const preferredPhase =
    result.plan.sequence === "archer-shot" ? "aim" : result.plan.sequence === "melee-attack" ? "contact" : "gait";
  const preferredFrames = result.frames.filter(({ runtimePhase }) => runtimePhase === preferredPhase);
  return preferredFrames[Math.floor(preferredFrames.length / 2)] ?? result.frames.at(-1);
}

function createInitialGymConfig(): ProceduralUnitConfig {
  return applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
    kind: "archer",
    humanoid: { animationMode: "idle", tier: 3 },
    horse: { tier: 3 },
  });
}
