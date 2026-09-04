import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Hash,
  Layers3,
  RefreshCw,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  createProceduralAnimationCaptureReport,
  type ProceduralAnimationCaptureOptions,
  type ProceduralAnimationCaptureResult,
  type ProceduralAnimationCaptureOverlay,
  type ProceduralAnimationCaptureSampling,
  type ProceduralAnimationFrameCapture,
  type ProceduralAnimationViewCapture,
} from "@/three/characters/gym/procedural-animation-capture";
import { evaluateProceduralAnimationCapture } from "@/three/characters/gym/procedural-animation-evaluation";
import { resolveQuaternionAngularDistanceDegrees } from "@/three/characters/procedural-character-diagnostics";
import { cn } from "@/ui/design-system/atoms/lib/utils";

interface ProceduralAnimationInspectorProps {
  busy: boolean;
  result: ProceduralAnimationCaptureResult;
  selectedFrame: ProceduralAnimationFrameCapture;
  onCapture(
    sampling: ProceduralAnimationCaptureSampling,
    overlay?: ProceduralAnimationCaptureOverlay,
    options?: Omit<ProceduralAnimationCaptureOptions, "overlay">,
  ): void;
  onClose(): void;
  onSelectFrame(frameIndex: number): void;
}

export const ProceduralAnimationInspector = ({
  busy,
  result,
  selectedFrame,
  onCapture,
  onClose,
  onSelectFrame,
}: ProceduralAnimationInspectorProps) => {
  const selectedPosition = result.frames.findIndex(({ frameIndex }) => frameIndex === selectedFrame.frameIndex);
  const previous = result.frames[Math.max(0, selectedPosition - 1)];
  const next = result.frames[Math.min(result.frames.length - 1, selectedPosition + 1)];
  const imageCount = result.frames.reduce((count, frame) => count + frame.views.length, 0);
  const evaluation = evaluateProceduralAnimationCapture(result);
  const repeatCaptureOptions = {
    rootMotionSpeed: result.plan.rootMotionSpeed,
    sequence: result.plan.sequence,
  } as const;
  return (
    <section
      className="pointer-events-auto absolute right-3 bottom-3 left-3 z-30 border border-violet-300/25 bg-[#080d16]/95 shadow-2xl backdrop-blur-xl"
      data-animation-inspector="true"
      data-capture-frame={selectedFrame.frameIndex}
      data-capture-issues={selectedFrame.issues.length}
      data-capture-overlay={result.plan.overlay}
      data-objective-gate={evaluation.automatedHardGatePassed ? "passed" : "failed"}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-violet-200" />
          <div>
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-violet-200/55">
              Deterministic pose bench
            </p>
            <p className="text-xs font-semibold text-white">
              {result.plan.sequence} · {result.frames.length} poses · {imageCount} views · {result.plan.overlay} ·{" "}
              {evaluation.automatedHardGatePassed ? "objective pass" : "objective fail"}
              {result.plan.rootMotionSpeed > 0 ? ` · root ${result.plan.rootMotionSpeed.toFixed(2)} u/s` : ""}
              {result.plan.truncated ? " · capped" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <InspectorButton
            icon={<Layers3 />}
            label="5-view atlas"
            disabled={busy}
            onClick={() => onCapture("phase-atlas", "diagnostic", repeatCaptureOptions)}
          />
          <InspectorButton
            icon={<RefreshCw />}
            label="Every frame"
            disabled={busy}
            onClick={() => onCapture("all-frames", "clean", repeatCaptureOptions)}
          />
          <InspectorButton
            active={result.plan.overlay === "diagnostic"}
            icon={<Hash />}
            label={result.plan.overlay === "diagnostic" ? "Labels on" : "Labels off"}
            disabled={busy}
            onClick={() =>
              onCapture(
                result.plan.sampling,
                result.plan.overlay === "diagnostic" ? "clean" : "diagnostic",
                repeatCaptureOptions,
              )
            }
          />
          <InspectorButton icon={<Download />} label="JSON" onClick={() => downloadCaptureReport(result)} />
          <InspectorButton
            icon={<Download />}
            label="Contact sheet"
            disabled={busy || !result.frames.some(({ views }) => views.some(({ imageDataUrl }) => imageDataUrl))}
            onClick={() => void downloadCaptureContactSheet(result)}
          />
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close animation inspector"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {evaluation.measurements.locomotion && <LocomotionDiagnostics locomotion={evaluation.measurements.locomotion} />}

      <div className="flex items-stretch border-b border-white/10">
        <button
          type="button"
          aria-label="Previous captured frame"
          disabled={busy || selectedPosition <= 0}
          onClick={() => previous && onSelectFrame(previous.frameIndex)}
          className="grid w-9 shrink-0 place-items-center border-r border-white/10 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto p-2" data-animation-frame-strip="true">
          {result.frames.map((frame) => (
            <FrameThumbnail
              key={frame.frameIndex}
              frame={frame}
              selected={frame.frameIndex === selectedFrame.frameIndex}
              disabled={busy}
              onSelect={() => onSelectFrame(frame.frameIndex)}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Next captured frame"
          disabled={busy || selectedPosition >= result.frames.length - 1}
          onClick={() => next && onSelectFrame(next.frameIndex)}
          className="grid w-9 shrink-0 place-items-center border-l border-white/10 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {selectedFrame.views.length > 1 && <FrameViewCoverage frame={selectedFrame} />}
      <FrameDiagnostics frame={selectedFrame} previousFrame={previous} />
    </section>
  );
};

const LocomotionDiagnostics = ({
  locomotion,
}: {
  locomotion: NonNullable<ReturnType<typeof evaluateProceduralAnimationCapture>["measurements"]["locomotion"]>;
}) => (
  <div
    className="grid grid-cols-4 gap-px border-b border-white/10 bg-white/10 px-px sm:grid-cols-8"
    data-locomotion-evaluation="true"
  >
    <DiagnosticMetric label="Cycles" value={locomotion.capturedCycleCount.toFixed(2)} />
    <DiagnosticMetric label="Root travel" value={formatDistance(locomotion.rootTravelDistance)} />
    <DiagnosticMetric
      label="Contact L/R"
      value={`${formatPercent(locomotion.contactFraction.left)} / ${formatPercent(locomotion.contactFraction.right)}`}
    />
    <DiagnosticMetric label="Double support" value={formatPercent(locomotion.doubleSupportFraction)} />
    <DiagnosticMetric label="Flight" value={formatPercent(locomotion.flightFraction)} />
    <DiagnosticMetric
      label="Swing clearance"
      value={`${formatDistance(locomotion.swingClearance.left)} / ${formatDistance(locomotion.swingClearance.right)}`}
    />
    <DiagnosticMetric
      label="Swing apex"
      value={`${formatPercent(locomotion.swingApexProgress.left)} / ${formatPercent(locomotion.swingApexProgress.right)}`}
    />
    <DiagnosticMetric label="Plant drift" value={formatDistance(locomotion.maximumStableStanceDrift)} />
    <DiagnosticMetric label="Step width / leg" value={formatRatio(locomotion.stepWidthRatio)} />
    <DiagnosticMetric label="Knee frontal P90" value={formatDegrees(locomotion.stanceKneeFrontalDeviationP90Degrees)} />
    <DiagnosticMetric label="Knee outward P90" value={formatRatio(locomotion.stanceKneeOutwardDeviationP90Ratio)} />
    <DiagnosticMetric
      label="Toe out L/R"
      value={`${formatDegrees(locomotion.stanceFootProgressionDegrees.left)} / ${formatDegrees(locomotion.stanceFootProgressionDegrees.right)}`}
    />
    <DiagnosticMetric label="Foot step" value={formatFootAngularPeak(locomotion.footAngularStepPeak)} />
    <DiagnosticMetric
      label="Stance foot step"
      value={formatFootAngularPeak(locomotion.stableStanceFootAngularStepPeak)}
    />
    <DiagnosticMetric
      label="Foot travel L/R"
      value={`${formatDegrees(locomotion.footAngularTravelDegrees.left)} / ${formatDegrees(locomotion.footAngularTravelDegrees.right)}`}
    />
  </div>
);

const FrameThumbnail = ({
  frame,
  selected,
  disabled,
  onSelect,
}: {
  disabled: boolean;
  frame: ProceduralAnimationFrameCapture;
  onSelect(): void;
  selected: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onSelect}
    className={cn(
      "w-28 shrink-0 overflow-hidden border bg-black/35 text-left transition",
      selected ? "border-violet-300/80 ring-1 ring-violet-300/30" : "border-white/10 hover:border-white/30",
    )}
  >
    <div className="relative aspect-[4/3] overflow-hidden bg-black/60">
      {frame.imageDataUrl ? (
        <img src={frame.imageDataUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <div className="grid h-full place-items-center text-[0.58rem] uppercase text-slate-600">semantic only</div>
      )}
      <span
        className={cn(
          "absolute top-1 right-1 grid h-5 min-w-5 place-items-center border px-1 text-[0.55rem] font-bold",
          frame.issues.length > 0
            ? "border-amber-300/35 bg-amber-950/85 text-amber-200"
            : "border-emerald-300/25 bg-emerald-950/80 text-emerald-200",
        )}
      >
        {frame.issues.length || <CheckCircle2 className="h-3 w-3" />}
      </span>
    </div>
    <div className="px-2 py-1.5">
      <p className="font-mono text-[0.62rem] text-white">F{frame.frameIndex}</p>
      <p className="truncate text-[0.56rem] uppercase tracking-wider text-slate-500">{frame.runtimePhase}</p>
    </div>
  </button>
);

const FrameViewCoverage = ({ frame }: { frame: ProceduralAnimationFrameCapture }) => (
  <div className="border-b border-white/10 px-3 py-2" data-animation-view-strip="true">
    <p className="mb-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-violet-200/45">
      Spatial coverage · one pose, five diagnostic angles
    </p>
    <div className="flex gap-2 overflow-x-auto pb-1">
      {frame.views.map((view) => (
        <figure
          key={view.id}
          className="w-32 shrink-0 overflow-hidden border border-white/10 bg-black/35"
          data-capture-view={view.id}
          data-view-nonblank={view.imageNonBlank ? "true" : "false"}
        >
          <div className="aspect-[4/3] bg-black/60">
            {view.imageDataUrl ? (
              <a
                href={view.imageDataUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open full-resolution diagnostic capture"
                title="Open full-resolution diagnostic capture"
              >
                <img
                  src={view.imageDataUrl}
                  alt={`${view.label} view of frame ${frame.frameIndex}`}
                  className="h-full w-full object-contain"
                />
              </a>
            ) : (
              <div className="grid h-full place-items-center text-[0.55rem] uppercase text-slate-600">unavailable</div>
            )}
          </div>
          <figcaption className="truncate px-2 py-1.5 text-[0.56rem] uppercase tracking-wider text-slate-400">
            {view.label}
          </figcaption>
        </figure>
      ))}
    </div>
  </div>
);

const FrameDiagnostics = ({
  frame,
  previousFrame,
}: {
  frame: ProceduralAnimationFrameCapture;
  previousFrame: ProceduralAnimationFrameCapture;
}) => {
  const humanoid = frame.diagnostics.humanoid;
  const bow = frame.diagnostics.bow;
  return (
    <div className="grid grid-cols-2 gap-2 px-3 py-2 md:grid-cols-[auto_repeat(8,minmax(0,1fr))]">
      <div className="col-span-2 min-w-32 md:col-span-1">
        <p className="font-mono text-xs font-semibold text-white">
          F{frame.frameIndex} · {frame.elapsedSeconds.toFixed(3)}s
        </p>
        <p className="text-[0.58rem] uppercase tracking-wider text-slate-500">
          expected {frame.expectedPhase} · runtime {frame.runtimePhase}
        </p>
      </div>
      <DiagnosticMetric label="L elbow" value={formatDegrees(humanoid?.arms.left.elbowDegrees)} />
      <DiagnosticMetric label="R elbow" value={formatDegrees(humanoid?.arms.right.elbowDegrees)} />
      <DiagnosticMetric label="L head gap" value={formatDistance(humanoid?.arms.left.handHeadClearance)} />
      <DiagnosticMetric label="R head gap" value={formatDistance(humanoid?.arms.right.handHeadClearance)} />
      <DiagnosticMetric label="Arrow gap" value={formatDistance(bow?.arrowHeadClearance)} />
      <DiagnosticMetric label="Nock / jaw" value={formatDistance(bow?.nockJawDistance)} />
      <DiagnosticMetric label="L foot Δ" value={formatDegrees(resolveFootStep(frame, previousFrame, "left"))} />
      <DiagnosticMetric label="R foot Δ" value={formatDegrees(resolveFootStep(frame, previousFrame, "right"))} />
      <div className="col-span-2 md:col-span-9">
        {frame.issues.length > 0 ? (
          <p className="flex items-center gap-1.5 text-[0.62rem] text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {frame.issues.join(" · ")}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[0.62rem] text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> No pose assertions failed in this frame
          </p>
        )}
      </div>
    </div>
  );
};

function resolveFootStep(
  frame: ProceduralAnimationFrameCapture,
  previousFrame: ProceduralAnimationFrameCapture,
  side: "left" | "right",
): number | null {
  const current = frame.diagnostics.humanoid?.feet[side].rotation;
  const previous = previousFrame.diagnostics.humanoid?.feet[side].rotation;
  if (!current || !previous || frame.frameIndex === previousFrame.frameIndex) return null;
  return resolveQuaternionAngularDistanceDegrees(current, previous);
}

function formatFootAngularPeak(
  peak: NonNullable<
    ReturnType<typeof evaluateProceduralAnimationCapture>["measurements"]["locomotion"]
  >["footAngularStepPeak"],
): string {
  return peak ? `${formatDegrees(peak.angleDegrees)} · ${peak.side[0].toUpperCase()} F${peak.frameIndex}` : "--";
}

const DiagnosticMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-white/[0.07] bg-white/[0.025] px-2 py-1">
    <p className="text-[0.52rem] uppercase tracking-wider text-slate-600">{label}</p>
    <p className="mt-0.5 font-mono text-[0.68rem] text-slate-200">{value}</p>
  </div>
);

const InspectorButton = ({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick(): void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "flex h-8 items-center gap-1.5 border px-2 text-[0.6rem] font-semibold uppercase tracking-wider transition hover:bg-white/[0.07] hover:text-white disabled:opacity-30 [&_svg]:h-3 [&_svg]:w-3",
      active ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-slate-300",
    )}
    data-active={active ? "true" : "false"}
  >
    {icon}
    {label}
  </button>
);

function formatDegrees(value: number | null | undefined): string {
  return value === null || value === undefined ? "--" : `${value.toFixed(1)}°`;
}

function formatDistance(value: number | null | undefined): string {
  return value === null || value === undefined ? "--" : value.toFixed(3);
}

function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? "--" : `${Math.round(value * 100)}%`;
}

function formatRatio(value: number | null | undefined): string {
  return value === null || value === undefined ? "--" : value.toFixed(3);
}

function downloadCaptureReport(result: ProceduralAnimationCaptureResult): void {
  downloadBlob(
    new Blob([`${JSON.stringify(createProceduralAnimationCaptureReport(result), null, 2)}\n`], {
      type: "application/json",
    }),
    `${result.plan.sequence}-pose-report.json`,
  );
}

async function downloadCaptureContactSheet(result: ProceduralAnimationCaptureResult): Promise<void> {
  const captures = resolveContactSheetCaptures(result);
  if (captures.length === 0) return;
  const isSpatialAtlas = result.plan.views.length > 1;
  const columns = isSpatialAtlas ? result.plan.views.length : captures.length > 40 ? 8 : 4;
  const cellWidth = isSpatialAtlas ? 220 : captures.length > 40 ? 160 : 220;
  const cellHeight = isSpatialAtlas ? 195 : captures.length > 40 ? 150 : 205;
  const headerHeight = isSpatialAtlas ? 30 : 0;
  const rows = Math.ceil(captures.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = columns * cellWidth;
  canvas.height = headerHeight + rows * cellHeight;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#070b13";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (isSpatialAtlas) drawContactSheetViewHeaders(context, result, cellWidth);
  const images = await Promise.all(captures.map(({ imageDataUrl }) => loadImage(imageDataUrl)));
  images.forEach((image, index) => {
    const capture = captures[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * cellWidth;
    const y = headerHeight + row * cellHeight;
    const labelHeight = 25;
    const imageHeight = cellHeight - labelHeight;
    const scale = Math.min((cellWidth - 4) / image.width, (imageHeight - 4) / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, x + (cellWidth - width) / 2, y + (imageHeight - height) / 2, width, height);
    context.fillStyle = capture.issues.length > 0 ? "#fbbf24" : "#cbd5e1";
    context.font = "12px monospace";
    const label = isSpatialAtlas
      ? `F${capture.frameIndex} ${capture.runtimePhase}`
      : `F${capture.frameIndex} ${capture.runtimePhase} · ${capture.viewLabel}`;
    context.fillText(label, x + 6, y + cellHeight - 8);
  });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob) downloadBlob(blob, `${result.plan.sequence}-contact-sheet.png`);
}

function drawContactSheetViewHeaders(
  context: CanvasRenderingContext2D,
  result: ProceduralAnimationCaptureResult,
  cellWidth: number,
): void {
  context.fillStyle = "#c4b5fd";
  context.font = "bold 12px monospace";
  result.plan.views.forEach((view, index) => {
    context.fillText(resolveShortViewLabel(view.id), index * cellWidth + 6, 20);
  });
}

function resolveShortViewLabel(viewId: ProceduralAnimationViewCapture["id"]): string {
  if (viewId === "right-profile") return "RIGHT PROFILE";
  if (viewId === "left-profile") return "LEFT PROFILE";
  if (viewId === "elevated-three-quarter") return "ELEVATED 3/4";
  if (viewId === "front-three-quarter") return "FRONT 3/4";
  return viewId.toUpperCase();
}

interface ContactSheetCapture {
  frameIndex: number;
  imageDataUrl: string;
  issues: readonly string[];
  runtimePhase: string;
  viewLabel: string;
}

function resolveContactSheetCaptures(result: ProceduralAnimationCaptureResult): ContactSheetCapture[] {
  return result.frames.flatMap((frame) =>
    frame.views.flatMap((view) => {
      if (!view.imageDataUrl) return [];
      return [createContactSheetCapture(frame, view, view.imageDataUrl)];
    }),
  );
}

function createContactSheetCapture(
  frame: ProceduralAnimationFrameCapture,
  view: ProceduralAnimationViewCapture,
  imageDataUrl: string,
): ContactSheetCapture {
  return {
    frameIndex: frame.frameIndex,
    imageDataUrl,
    issues: frame.issues,
    runtimePhase: frame.runtimePhase,
    viewLabel: view.label,
  };
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode captured animation frame"));
    image.src = source;
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
