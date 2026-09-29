/** Each Ethereal depth's portal, the one picture every Frontier surface shows of it; the surface (0) has none. */
export const DEPTH_ART = [
  "",
  "/images/frontier/depths/ethereal-1.svg",
  "/images/frontier/depths/ethereal-2.svg",
  "/images/frontier/depths/ethereal-3.svg",
] as const;

/** A depth's portal, null on the surface; a depth the game does not have is loud. */
export const depthArt = (depth: number): string | null => {
  if (depth === 0) return null;
  const art = DEPTH_ART[depth];
  if (!art) throw new Error(`No depth ${depth}`);
  return art;
};
