import { PopoverPanel } from "@/ui/design-system/molecules/popover";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProceduralUnitConfig } from "@/three/characters/procedural-unit-config";
import type {
  ProceduralAnimationCaptureResult,
  ProceduralAnimationCaptureSampling,
} from "@/three/characters/gym/procedural-animation-capture";
import {
  KNIGHT_REVIEW_ANIMATIONS,
  type KnightAnimationId,
  compareKnightAnimationRuns,
  createKnightAnimationScenario,
  firstCaptureDifference,
  readKnightAnimationScenario,
  reviewRunFailures,
  type KnightAnimationReviewRun,
  type KnightAnimationScenario,
} from "@/three/characters/gym/knight-animation-review";

interface Props {
  config: ProceduralUnitConfig;
  ready: boolean;
  renderer: string;
  onLoad(scenario: KnightAnimationScenario): void;
  onBusy(busy: boolean): void;
  onCapture(
    sampling: ProceduralAnimationCaptureSampling,
    scenario: KnightAnimationScenario,
  ): Promise<ProceduralAnimationCaptureResult>;
  onCaptureFinished(): void;
}

const buttonClass = "rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40";

export function KnightAnimationReviewPanel({
  config,
  ready,
  renderer,
  onLoad,
  onBusy,
  onCapture,
  onCaptureFinished,
}: Props) {
  const [animationId, setAnimationId] = useState<KnightAnimationId>("knight-walk");
  const [baselines, setBaselines] = useState<Partial<Record<KnightAnimationId, KnightAnimationReviewRun>>>({});
  const [candidates, setCandidates] = useState<Partial<Record<KnightAnimationId, KnightAnimationReviewRun>>>({});
  const baseline = baselines[animationId] ?? null;
  const candidate = candidates[animationId] ?? null;
  const setBaseline = (run: KnightAnimationReviewRun) =>
    setBaselines((current) => ({ ...current, [run.scenario.id]: run }));
  const setCandidate = (run: KnightAnimationReviewRun) =>
    setCandidates((current) => ({ ...current, [run.scenario.id]: run }));

  function loadAnimation(id: KnightAnimationId) {
    setAnimationId(id);
    setShowComparison(false);
    onLoad(createKnightAnimationScenario(id));
    setMessage("Knight animation loaded. Capture a baseline before tuning.");
  }
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Load the fixed model, capture a baseline, then tune and capture a candidate.",
  );
  const [showComparison, setShowComparison] = useState(false);
  const scenarioInput = useRef<HTMLInputElement>(null);
  const baselineInput = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const comparison = useMemo(
    () => (baseline && candidate ? compareKnightAnimationRuns(baseline, candidate) : null),
    [baseline, candidate],
  );

  function currentScenario() {
    return readKnightAnimationScenario({ ...createKnightAnimationScenario(animationId), config });
  }

  function saveScenario() {
    try {
      downloadJson(currentScenario(), `${animationId}-scenario.json`);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function importScenario(file?: File) {
    if (!file) return;
    try {
      const scenario = readKnightAnimationScenario(await readJsonFile(file));
      setAnimationId(scenario.id);
      onLoad(scenario);
      setMessage("Saved scenario loaded. Capture from reset to compare it.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function importBaseline(file?: File) {
    if (!file) return;
    try {
      const run = (await readJsonFile(file)) as KnightAnimationReviewRun;
      readKnightAnimationScenario(run.scenario);
      if (
        !run.id ||
        !run.environment?.assetHash ||
        !run.environment.renderer ||
        !run.environment.viewport ||
        !run.environment.userAgent
      )
        throw new Error("Missing baseline identity");
      const failures = reviewRunFailures(run);
      if (failures.length) throw new Error(`Baseline evidence failed: ${failures[0]}`);
      setAnimationId(run.scenario.id);
      onLoad(run.scenario);
      setBaseline(run);
      setMessage("Baseline imported. Capture a candidate in the same environment.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function capture(role: "baseline" | "candidate") {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const scenario = currentScenario();
      const environment = await captureEnvironment(renderer);
      setMessage("Capturing every frame from reset…");
      const temporal = await onCapture("all-frames", scenario);
      setMessage("Repeating from reset to check determinism…");
      const repeat = await onCapture("all-frames", scenario);
      const firstDifference = firstCaptureDifference(temporal, repeat);
      setMessage("Capturing the diagnostic atlas…");
      const atlas = await onCapture("phase-atlas", scenario);
      const run: KnightAnimationReviewRun = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        scenario,
        environment,
        temporal,
        atlas,
        repeat: { passed: firstDifference === null, firstDifference },
      };
      if (
        JSON.stringify(temporal.config) !== JSON.stringify(scenario.config) ||
        JSON.stringify(atlas.config) !== JSON.stringify(scenario.config)
      )
        throw new Error("Configuration changed during capture; rerun the scenario");
      const failures = reviewRunFailures(run);
      if (role === "baseline" && failures.length) {
        setCandidate(run);
        setMessage(`Baseline withheld: ${failures[0]}. Failed evidence is available as the candidate.`);
      } else {
        if (role === "baseline") setBaseline(run);
        else setCandidate(run);
        setMessage(
          failures.length
            ? `${role}: ${failures[0]}`
            : `${role}: complete evidence; repeat agrees within 0.000001. Visual review still required.`,
        );
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      running.current = false;
      setBusy(false);
      onBusy(false);
      onCaptureFinished();
    }
  }

  return (
    <section
      className="border-b border-white/10 bg-slate-950 px-4 py-2"
      data-knight-review="true"
      data-review-animation={animationId}
      data-review-busy={busy}
      data-review-baseline={baseline?.id ?? ""}
      data-review-candidate={candidate?.id ?? ""}
      data-review-repeat={candidate?.repeat.passed ?? baseline?.repeat.passed ?? "pending"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong className="mr-2 text-sm">Knight animation review</strong>
        <select
          className="rounded bg-slate-800 px-2 py-1.5 text-xs"
          aria-label="Knight review animation"
          value={animationId}
          disabled={!ready || busy}
          onChange={(event) => loadAnimation(event.target.value as KnightAnimationId)}
        >
          {KNIGHT_REVIEW_ANIMATIONS.map((animation) => (
            <option key={animation.id} value={animation.id}>
              {animation.label}
            </option>
          ))}
        </select>
        <button className={buttonClass} disabled={!ready || busy} onClick={() => loadAnimation(animationId)}>
          Reset animation
        </button>
        <button className={buttonClass} disabled={!ready || busy} onClick={saveScenario}>
          Save scenario
        </button>
        <button className={buttonClass} disabled={!ready || busy} onClick={() => scenarioInput.current?.click()}>
          Load scenario
        </button>
        <button className={buttonClass} disabled={!ready || busy} onClick={() => void capture("baseline")}>
          Capture baseline
        </button>
        <button
          className={buttonClass}
          disabled={!ready || busy || !baseline}
          onClick={() => void capture("candidate")}
        >
          Capture candidate
        </button>
        <button
          className={buttonClass}
          disabled={busy || !baseline}
          onClick={() => baseline && downloadJson(baseline, `${baseline.scenario.id}-baseline.json`)}
        >
          Save baseline
        </button>
        <button className={buttonClass} disabled={busy} onClick={() => baselineInput.current?.click()}>
          Load baseline
        </button>
        <button
          className={buttonClass}
          disabled={busy || !candidate}
          onClick={() => candidate && downloadJson(candidate, `${candidate.scenario.id}-candidate.json`)}
        >
          Save candidate
        </button>
        <button className={buttonClass} disabled={!comparison || busy} onClick={() => setShowComparison(true)}>
          Compare
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400" role="status">
        {message}
      </p>
      <input
        ref={scenarioInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Import knight animation scenario"
        onChange={(event) => {
          void importScenario(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={baselineInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Import knight animation baseline"
        onChange={(event) => {
          void importBaseline(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {showComparison && baseline && candidate && (
        <Comparison baseline={baseline} candidate={candidate} onClose={() => setShowComparison(false)} />
      )}
    </section>
  );
}

function Comparison({
  baseline,
  candidate,
  onClose,
}: {
  baseline: KnightAnimationReviewRun;
  candidate: KnightAnimationReviewRun;
  onClose(): void;
}) {
  const [position, setPosition] = useState(0);
  const positionRef = useRef(position);
  positionRef.current = position;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [atlas, setAtlas] = useState(false);
  const [viewIndex, setViewIndex] = useState(0);
  const comparison = useMemo(() => compareKnightAnimationRuns(baseline, candidate), [baseline, candidate]);
  const left = atlas ? baseline.atlas : baseline.temporal;
  const right = atlas ? candidate.atlas : candidate.temporal;
  const count = Math.max(left.frames.length, right.frames.length);
  const index = Math.min(position, count - 1);
  const firstFailure = right.frames.findIndex(
    (frame) => frame.issues.length > 0 || frame.views.some((view) => !view.imageNonBlank),
  );
  useEffect(() => {
    if (!playing || atlas || !comparison.compatible) return;
    const startPosition = positionRef.current;
    let startedAt: number | undefined;
    let animationFrame: number;
    const advancePlayback = (now: number) => {
      startedAt ??= now;
      const elapsedFrames = Math.floor(((now - startedAt) * speed) / (left.plan.fixedStepSeconds * 1000));
      setPosition((startPosition + elapsedFrames) % count);
      animationFrame = window.requestAnimationFrame(advancePlayback);
    };
    animationFrame = window.requestAnimationFrame(advancePlayback);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [playing, atlas, comparison.compatible, count, left.plan.fixedStepSeconds, speed]);
  return (
    <PopoverPanel
      id="knight-animation-comparison"
      ariaLabel="Knight animation comparison"
      anchor="top-center"
      onDismiss={onClose}
      className="h-[calc(100dvh-80px)] w-[calc(100vw-32px)] overflow-auto border-slate-600 bg-slate-950 text-slate-100"
    >
      <div data-review-comparison={comparison.compatible ? "compatible" : "incompatible"}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg">Baseline / candidate</h2>
          <button autoFocus className={buttonClass} onClick={onClose}>
            Close comparison
          </button>
        </div>
        <p className="my-2 text-sm">
          {comparison.compatible
            ? "Matched capture conditions"
            : `Incompatible: ${comparison.incompatible}. Recapture under matched conditions.`}
        </p>
        <p className="text-xs text-slate-400">
          {comparison.changedParameters.join(" · ") || "No configuration changes"}
        </p>
        <p className="my-2 text-xs">
          {comparison.failures[0] ??
            "Candidate objective gates pass; assess weight, timing and readability before promotion."}{" "}
          {comparison.timingChanged
            ? "Timing changed: playback uses real elapsed time; the shorter capture holds its final pose. Atlas views match named phases."
            : comparison.firstPoseDifference
              ? `First pose change: ${comparison.firstPoseDifference}`
              : ""}
        </p>
        {comparison.compatible && (
          <>
            <div className="my-3 flex flex-wrap gap-2">
              <button className={buttonClass} disabled={atlas} onClick={() => setPlaying(!playing)}>
                {playing ? "Pause comparison" : "Play comparison"}
              </button>
              <select
                className="bg-slate-800 text-sm"
                aria-label="Playback speed"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              >
                <option value={1}>1× speed</option>
                <option value={0.25}>¼ speed</option>
              </select>
              <button
                className={buttonClass}
                onClick={() => {
                  setAtlas(!atlas);
                  setPosition(0);
                  setViewIndex(0);
                  setPlaying(false);
                }}
              >
                {atlas ? "Temporal playback" : "Diagnostic atlas"}
              </button>
              {atlas && (
                <select
                  className="bg-slate-800 text-sm"
                  aria-label="Comparison camera"
                  value={viewIndex}
                  onChange={(event) => setViewIndex(Number(event.target.value))}
                >
                  {left.plan.views.map((view, i) => (
                    <option value={i} key={view.id}>
                      {view.label}
                    </option>
                  ))}
                </select>
              )}
              <button
                className={buttonClass}
                disabled={firstFailure < 0}
                onClick={() => {
                  setPlaying(false);
                  setPosition(firstFailure);
                }}
              >
                First failing frame
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[left, right].map((capture, side) => {
                const frame = capture.frames[Math.min(index, capture.frames.length - 1)];
                const view = frame.views[viewIndex];
                return (
                  <figure key={side}>
                    <img
                      className="max-h-[60vh] w-full object-contain"
                      src={view.imageDataUrl ?? undefined}
                      alt={`${side === 0 ? "Baseline" : "Candidate"} ${view.label} frame ${frame.frameIndex}`}
                    />
                    <figcaption className="text-center text-sm">
                      {side === 0 ? "Baseline" : "Candidate"} · F{frame.frameIndex} · {frame.runtimePhase} ·{" "}
                      {frame.elapsedSeconds.toFixed(3)}s {index >= capture.frames.length ? " · ended" : ""}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
            <input
              className="my-4 w-full"
              type="range"
              aria-label="Comparison frame"
              min={0}
              max={count - 1}
              value={index}
              onChange={(event) => {
                setPlaying(false);
                setPosition(Number(event.target.value));
              }}
            />
          </>
        )}
      </div>
    </PopoverPanel>
  );
}

async function captureEnvironment(renderer: string): Promise<KnightAnimationReviewRun["environment"]> {
  const response = await fetch("/models/characters/quaternius/base-male.glb");
  if (!response.ok) throw new Error("Cannot fingerprint the character asset");
  const hash = await crypto.subtle.digest("SHA-256", await response.arrayBuffer());
  const canvas = document.querySelector('[data-debug-route="procedural-characters"] canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Character canvas is not ready");
  return {
    renderer,
    viewport: `${canvas.width}x${canvas.height}`,
    assetHash: Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    userAgent: navigator.userAgent,
  };
}

async function readJsonFile(file: File): Promise<unknown> {
  if (file.size > 100 * 1024 * 1024) throw new Error("Review file exceeds 100 MB");
  return JSON.parse(await file.text());
}

function downloadJson(value: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Review failed";
}
