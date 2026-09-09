/**
 * A touch-first device (phone, tablet without a mouse). Hover-only UI opts out here: a tap fires mouseenter with no
 * matching leave, so anything driven by hover would stick.
 */
export const isCoarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;
