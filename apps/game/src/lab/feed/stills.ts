/**
 * The Feed's stills, one list for the pick page, the capture and their test: today's Feed and each option's, on a desktop
 * rail and a phone, and an option's rail closed. Each is a screenshot of its frame (draw.tsx), kept in
 * asset-sources/lab/feed and served at /lab/feed in the dev build only (build/lab-artwork.ts).
 */
export const FRAMES = ["today", "a", "b", "c"] as const;
export type StillFrame = (typeof FRAMES)[number];
export type StillDevice = "desktop" | "phone";

interface Still {
  name: string;
  /** The frame's address under /lab, as the capture opens it. */
  draw: string;
  /** The page the capture sizes its window to: the frame's own size. */
  size: { width: number; height: number };
}

const SIZES: Record<StillDevice, Still["size"]> = {
  desktop: { width: 512, height: 820 },
  phone: { width: 406, height: 860 },
};

const still = (frame: StillFrame, device: StillDevice, closed = false): Still => ({
  name: `${frame}-${device}${closed ? "-closed" : ""}`,
  draw: `/lab/feed/draw?frame=${frame}&device=${device}${closed ? "&closed=1" : ""}&capture=1`,
  size: SIZES[device],
});

export const STILLS: Still[] = [
  ...FRAMES.flatMap((frame) => [still(frame, "desktop"), still(frame, "phone")]),
  still("a", "desktop", true),
];

/** Where a still is served. */
export const stillUrl = (name: string) => `/lab/feed/${name}.png`;
