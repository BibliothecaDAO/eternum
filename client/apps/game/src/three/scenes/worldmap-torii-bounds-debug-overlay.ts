export const TORII_BOUNDS_DEBUG_OVERLAY_ID = "worldmap-torii-bounds-debug-overlay";

export type ToriiBoundsDebugRange = {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
};

export type ToriiBoundsDebugUpdateCounts = Record<string, number>;

export type ToriiBoundsDebugOverlaySnapshot = {
  currentChunk?: string | null;
  currentAreaKey?: string | null;
  requestedAreaKey?: string | null;
  subscribedAreaKey?: string | null;
  localBounds?: ToriiBoundsDebugRange | null;
  subscriptionBounds?: ToriiBoundsDebugRange | null;
  modelCount?: number | null;
  lastOutcome?: string | null;
  updateCounts?: ToriiBoundsDebugUpdateCounts | null;
};

type ToriiBoundsDebugOverlayRow = {
  label: string;
  value: string;
};

const OVERLAY_STYLE: Partial<CSSStyleDeclaration> = {
  position: "fixed",
  right: "12px",
  bottom: "12px",
  zIndex: "2147483647",
  width: "300px",
  maxWidth: "calc(100vw - 24px)",
  padding: "10px 12px",
  border: "1px solid rgba(103, 232, 249, 0.55)",
  borderRadius: "6px",
  background: "rgba(2, 6, 23, 0.88)",
  color: "#dff7ff",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "11px",
  lineHeight: "1.35",
  pointerEvents: "none",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.32)",
};

const TITLE_STYLE: Partial<CSSStyleDeclaration> = {
  marginBottom: "6px",
  color: "#67e8f9",
  fontWeight: "700",
};

const ROW_STYLE: Partial<CSSStyleDeclaration> = {
  display: "grid",
  gridTemplateColumns: "98px minmax(0, 1fr)",
  columnGap: "8px",
};

const LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  color: "rgba(223, 247, 255, 0.62)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const VALUE_STYLE: Partial<CSSStyleDeclaration> = {
  color: "#f8fafc",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function applyStyle(element: HTMLElement, style: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, style);
}

function formatMaybe(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function formatRange(range: ToriiBoundsDebugRange | null | undefined): string {
  if (!range) {
    return "-";
  }
  return `c ${range.minCol}..${range.maxCol} / r ${range.minRow}..${range.maxRow}`;
}

function sumUpdateCounts(updateCounts: ToriiBoundsDebugUpdateCounts | null | undefined): number {
  if (!updateCounts) {
    return 0;
  }
  return Object.values(updateCounts).reduce((sum, value) => sum + Math.max(0, Math.floor(value)), 0);
}

function resolveSubscriptionStatus(snapshot: ToriiBoundsDebugOverlaySnapshot): string {
  if (!snapshot.currentAreaKey || !snapshot.subscribedAreaKey) {
    return "waiting";
  }
  return snapshot.currentAreaKey === snapshot.subscribedAreaKey ? "synced" : "pending";
}

export function buildToriiBoundsDebugOverlayRows(
  snapshot: ToriiBoundsDebugOverlaySnapshot,
): ToriiBoundsDebugOverlayRow[] {
  return [
    { label: "Status", value: resolveSubscriptionStatus(snapshot) },
    { label: "Chunk", value: formatMaybe(snapshot.currentChunk) },
    { label: "Current Area", value: formatMaybe(snapshot.currentAreaKey) },
    { label: "Requested Area", value: formatMaybe(snapshot.requestedAreaKey) },
    { label: "Subscribed Area", value: formatMaybe(snapshot.subscribedAreaKey) },
    { label: "Outcome", value: formatMaybe(snapshot.lastOutcome) },
    { label: "Local Bounds", value: formatRange(snapshot.localBounds) },
    { label: "Felt Bounds", value: formatRange(snapshot.subscriptionBounds) },
    { label: "Models", value: formatMaybe(snapshot.modelCount) },
    { label: "Updates", value: `${sumUpdateCounts(snapshot.updateCounts)} / 5s` },
  ];
}

function resolveDocument(inputDocument?: Document): Document | null {
  if (inputDocument) {
    return inputDocument;
  }
  if (typeof document === "undefined") {
    return null;
  }
  return document;
}

function createOverlayElement(ownerDocument: Document): HTMLElement {
  const overlay = ownerDocument.createElement("div");
  overlay.id = TORII_BOUNDS_DEBUG_OVERLAY_ID;
  applyStyle(overlay, OVERLAY_STYLE);
  return overlay;
}

function appendOverlayTitle(overlay: HTMLElement): void {
  const title = overlay.ownerDocument.createElement("div");
  title.textContent = "Torii Bounds";
  applyStyle(title, TITLE_STYLE);
  overlay.appendChild(title);
}

function appendOverlayRow(overlay: HTMLElement, row: ToriiBoundsDebugOverlayRow): void {
  const rowElement = overlay.ownerDocument.createElement("div");
  const labelElement = overlay.ownerDocument.createElement("span");
  const valueElement = overlay.ownerDocument.createElement("span");

  labelElement.textContent = row.label;
  valueElement.textContent = row.value;
  applyStyle(rowElement, ROW_STYLE);
  applyStyle(labelElement, LABEL_STYLE);
  applyStyle(valueElement, VALUE_STYLE);

  rowElement.append(labelElement, valueElement);
  overlay.appendChild(rowElement);
}

export function upsertToriiBoundsDebugOverlay(
  snapshot: ToriiBoundsDebugOverlaySnapshot,
  ownerDocument?: Document,
): void {
  const activeDocument = resolveDocument(ownerDocument);
  if (!activeDocument?.body) {
    return;
  }

  const overlay = activeDocument.getElementById(TORII_BOUNDS_DEBUG_OVERLAY_ID) ?? createOverlayElement(activeDocument);

  overlay.replaceChildren();
  appendOverlayTitle(overlay);
  buildToriiBoundsDebugOverlayRows(snapshot).forEach((row) => appendOverlayRow(overlay, row));

  if (!overlay.parentElement) {
    activeDocument.body.appendChild(overlay);
  }
}

export function removeToriiBoundsDebugOverlay(ownerDocument?: Document): void {
  const activeDocument = resolveDocument(ownerDocument);
  activeDocument?.getElementById(TORII_BOUNDS_DEBUG_OVERLAY_ID)?.remove();
}
