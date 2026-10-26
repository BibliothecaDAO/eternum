/**
 * The Build panel's stills, one list for the pick page and its test: today's way to build and each draft, on a desktop
 * and a phone, before the press (where Build is) and after it (the panel and where the pick lands). Screenshots of the
 * lab's game (day-end, the realm given labor) drawn by the capture branch `capture/build-panel`, taken once
 * (evidence/frontier-build-panel-1/build-panel-shots*.js in the lanes folder), kept in asset-sources/lab/build-panel and
 * served at /lab/build-panel in the dev build only (build/lab-artwork.ts).
 */
export const LOOKS = ["today", "a", "b", "c"] as const;
export type PanelLook = (typeof LOOKS)[number];
export const STEPS = ["entry", "open"] as const;
export type StillStep = (typeof STEPS)[number];
export type StillDevice = "desktop" | "phone";

export const stillName = (look: PanelLook, device: StillDevice, step: StillStep) => `${look}-${device}-${step}`;

/** Where a still is served. */
export const stillUrl = (name: string) => `/lab/build-panel/${name}.webp`;
