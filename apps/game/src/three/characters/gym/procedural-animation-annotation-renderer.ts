import { PerspectiveCamera, Vector3 } from "three";

import type {
  ProceduralAnimationAnnotationPoint,
  ProceduralAnimationAnnotationTone,
  ProceduralAnimationFrameAnnotations,
} from "./procedural-animation-annotations";

interface ProjectedPoint {
  visible: boolean;
  x: number;
  y: number;
}

const TONE_COLORS: Record<ProceduralAnimationAnnotationTone, string> = {
  equipment: "#fbbf24",
  left: "#38bdf8",
  neutral: "#c4b5fd",
  right: "#f472b6",
  stance: "#34d399",
  swing: "#fb923c",
};

export function renderProceduralAnimationAnnotations(
  context: CanvasRenderingContext2D,
  camera: PerspectiveCamera,
  annotations: ProceduralAnimationFrameAnnotations,
  width: number,
  height: number,
): void {
  camera.updateMatrixWorld(true);
  drawSegments(context, camera, annotations, width, height);
  drawAngles(context, camera, annotations, width, height);
  drawMarkers(context, camera, annotations, width, height);
  drawCaptureHeader(context, annotations);
  drawMetrics(context, annotations, width);
  drawMarkerLegend(context, annotations, width, height);
  drawIssues(context, annotations, width, height);
}

function drawSegments(
  context: CanvasRenderingContext2D,
  camera: PerspectiveCamera,
  annotations: ProceduralAnimationFrameAnnotations,
  width: number,
  height: number,
): void {
  context.save();
  context.lineWidth = Math.max(1.5, width / 420);
  annotations.segments.forEach((segment) => {
    const start = projectPoint(segment.start, camera, width, height);
    const end = projectPoint(segment.end, camera, width, height);
    if (!start.visible || !end.visible) return;
    context.strokeStyle = TONE_COLORS[segment.tone];
    context.globalAlpha = 0.82;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  });
  context.restore();
}

function drawAngles(
  context: CanvasRenderingContext2D,
  camera: PerspectiveCamera,
  annotations: ProceduralAnimationFrameAnnotations,
  width: number,
  height: number,
): void {
  annotations.angles.forEach((angle) => {
    const point = projectPoint(angle.position, camera, width, height);
    if (!point.visible) return;
    drawTextPlate(context, angle.value, point.x + 5, point.y - 12, TONE_COLORS[angle.tone]);
  });
}

function drawMarkers(
  context: CanvasRenderingContext2D,
  camera: PerspectiveCamera,
  annotations: ProceduralAnimationFrameAnnotations,
  width: number,
  height: number,
): void {
  const radius = Math.max(5, width / 120);
  annotations.markers.forEach((marker) => {
    const point = projectPoint(marker.position, camera, width, height);
    if (!point.visible) return;
    const color = TONE_COLORS[marker.tone];
    context.save();
    context.fillStyle = "rgba(4, 8, 15, 0.9)";
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#ffffff";
    context.font = `700 ${Math.max(8, width / 80)}px ui-monospace, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(marker.id), point.x, point.y + 0.5);
    context.restore();
    if (marker.value) drawTextPlate(context, marker.value, point.x + radius + 3, point.y - radius - 2, color);
  });
}

function drawCaptureHeader(context: CanvasRenderingContext2D, annotations: ProceduralAnimationFrameAnnotations): void {
  context.save();
  context.fillStyle = "rgba(4, 8, 15, 0.88)";
  context.fillRect(8, 8, 340, 40);
  context.fillStyle = "#f8fafc";
  context.font = "700 12px ui-monospace, monospace";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(annotations.header, 16, 24);
  context.fillStyle = "#94a3b8";
  context.font = "10px ui-monospace, monospace";
  context.fillText(annotations.subheader, 16, 39);
  context.restore();
}

function drawMetrics(
  context: CanvasRenderingContext2D,
  annotations: ProceduralAnimationFrameAnnotations,
  width: number,
): void {
  const metrics = annotations.metrics.slice(0, 16);
  if (metrics.length === 0) return;
  const panelWidth = 168;
  const rowHeight = 14;
  const x = width - panelWidth - 8;
  const y = 8;
  context.save();
  context.fillStyle = "rgba(4, 8, 15, 0.86)";
  context.fillRect(x, y, panelWidth, 9 + metrics.length * rowHeight);
  context.font = "9px ui-monospace, monospace";
  context.textBaseline = "middle";
  metrics.forEach((metric, index) => {
    const rowY = y + 9 + index * rowHeight;
    context.fillStyle = "#64748b";
    context.textAlign = "left";
    context.fillText(metric.label.toUpperCase(), x + 7, rowY);
    context.fillStyle = "#e2e8f0";
    context.textAlign = "right";
    context.fillText(metric.value, x + panelWidth - 7, rowY);
  });
  context.restore();
}

function drawMarkerLegend(
  context: CanvasRenderingContext2D,
  annotations: ProceduralAnimationFrameAnnotations,
  width: number,
  height: number,
): void {
  if (annotations.markers.length === 0) return;
  const columns = Math.max(4, Math.floor((width - 16) / 96));
  const rows = Math.ceil(annotations.markers.length / columns);
  const rowHeight = 13;
  const legendHeight = rows * rowHeight + 8;
  const y = height - legendHeight;
  const cellWidth = (width - 16) / columns;
  context.save();
  context.fillStyle = "rgba(4, 8, 15, 0.9)";
  context.fillRect(0, y, width, legendHeight);
  context.font = "8px ui-monospace, monospace";
  context.textAlign = "left";
  context.textBaseline = "middle";
  annotations.markers.forEach((marker, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 8 + column * cellWidth;
    const textY = y + 8 + row * rowHeight;
    context.fillStyle = TONE_COLORS[marker.tone];
    context.fillText(`${marker.id}`, x, textY);
    context.fillStyle = "#cbd5e1";
    context.fillText(truncate(marker.label, 13), x + 12, textY);
  });
  context.restore();
}

function drawIssues(
  context: CanvasRenderingContext2D,
  annotations: ProceduralAnimationFrameAnnotations,
  width: number,
  height: number,
): void {
  if (annotations.issues.length === 0) return;
  const legendRows = Math.ceil(annotations.markers.length / Math.max(4, Math.floor((width - 16) / 96)));
  const y = height - (legendRows * 13 + 8) - 22;
  context.save();
  context.fillStyle = "rgba(69, 10, 10, 0.94)";
  context.fillRect(0, y, width, 22);
  context.fillStyle = "#fecaca";
  context.font = "700 10px ui-monospace, monospace";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(`ISSUES · ${annotations.issues.join(" · ")}`, 8, y + 11, width - 16);
  context.restore();
}

function drawTextPlate(context: CanvasRenderingContext2D, value: string, x: number, y: number, color: string): void {
  context.save();
  context.font = "700 9px ui-monospace, monospace";
  context.textAlign = "left";
  context.textBaseline = "top";
  const width = context.measureText(value).width + 6;
  context.fillStyle = "rgba(4, 8, 15, 0.88)";
  context.fillRect(x, y, width, 13);
  context.fillStyle = color;
  context.fillText(value, x + 3, y + 2);
  context.restore();
}

function projectPoint(
  point: ProceduralAnimationAnnotationPoint,
  camera: PerspectiveCamera,
  width: number,
  height: number,
): ProjectedPoint {
  const projected = new Vector3(...point).project(camera);
  return {
    visible:
      Number.isFinite(projected.x) &&
      Number.isFinite(projected.y) &&
      Number.isFinite(projected.z) &&
      projected.z >= -1 &&
      projected.z <= 1 &&
      projected.x >= -1.1 &&
      projected.x <= 1.1 &&
      projected.y >= -1.1 &&
      projected.y <= 1.1,
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height,
  };
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
