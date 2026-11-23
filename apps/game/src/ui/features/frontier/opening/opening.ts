import type { IconMeaning } from "@/ui/design-system/icon";

/**
 * The interface that opens as you play (the frozen design, "The interface opens as you play"): each moment, the painting
 * its one line wears, and the parts of the HUD that wait on it. Every other part shows from launch. The moments that open
 * nothing yet (the spire's odds, a layer down, the City, the shop) join this table in the change
 * that brings their part.
 */
export const OPENING = {
  launch: { icon: "realm", parts: [] },
  barracks: { icon: "barracks", parts: ["troops-store", "building-list"] },
  guard: { icon: "camp", parts: [] },
  oath: { icon: "shrine", parts: [] },
  essence: { icon: "essence", parts: ["essence-store", "research", "today"] },
  shop: { icon: "fragment", parts: ["fragments-chip"] },
  relic: { icon: "relics", parts: ["relic-slots"] },
  "well-lore": { icon: "well", parts: [] },
  "shrine-lore": { icon: "shrine", parts: [] },
  city: { icon: "scout-lodge", parts: [] },
  spire: { icon: "spire", parts: [] },
  deep: { icon: "depth-3", parts: ["glory"] },
  bane: { icon: "flame", parts: ["bane-row"] },
  // The Aspect's page opens with whichever comes first: the Deep, a bane on the Aspect or its first stage built.
  aspects: { icon: "hyperstructure", parts: ["aspects"] },
} as const satisfies Record<string, { icon: IconMeaning; parts: readonly string[] }>;

export type OpeningMoment = keyof typeof OPENING;
type EventMoment = Extract<OpeningMoment, "guard">;
export type StateMoment = Exclude<OpeningMoment, "launch" | EventMoment>;
export type OpeningPart = (typeof OPENING)[OpeningMoment]["parts"][number];

/** The moments in the order a player meets them: the table's own. */
export const OPENING_MOMENTS = Object.keys(OPENING) as OpeningMoment[];

/** What the HUD shows: every part (outside the game's HUD, watching, or Show everything), or those of the moments reached. */
export type Opened = "all" | ReadonlySet<OpeningMoment>;

/** Whether the HUD shows a part: the part waits on the one moment whose row lists it. */
export const partShown = (opened: Opened, part: OpeningPart): boolean =>
  opened === "all" ||
  OPENING_MOMENTS.some((moment) => opened.has(moment) && OPENING[moment].parts.some((each) => each === part));
