export type HoverLabelShowStatus = "shown" | "missing" | "unchanged" | "reattached";

export interface HoverLabelShowResult {
  status: HoverLabelShowStatus;
}

export function didShowHoverLabel(result: HoverLabelShowResult): boolean {
  return result.status !== "missing";
}

export function didChangeHoverLabelRenderState(result: HoverLabelShowResult): boolean {
  return result.status === "shown" || result.status === "reattached";
}

export function normalizeHoverLabelShowResult(result: HoverLabelShowResult | boolean | void): HoverLabelShowResult {
  if (result === false) {
    return { status: "missing" };
  }

  if (result === undefined || result === true) {
    return { status: "shown" };
  }

  return result;
}
