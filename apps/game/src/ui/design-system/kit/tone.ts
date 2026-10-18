/**
 * The kit's three tones: calm, amber (within the hour: a store fills, the day nears its end) and ember (at the limit,
 * the last hour). The caller decides the tone from the facts; the kit only draws it.
 */
export type Tone = "calm" | "amber" | "ember";

export const TONE_TEXT: Record<Tone, string> = {
  calm: "text-kit-cream",
  amber: "text-kit-hot",
  ember: "text-kit-ember",
};

export const TONE_FILL: Record<Tone, string> = {
  calm: "bg-kit-gold",
  amber: "bg-kit-hot",
  ember: "bg-kit-ember",
};

export const TONE_STROKE: Record<Tone, string> = {
  calm: "stroke-kit-amber",
  amber: "stroke-kit-hot",
  ember: "stroke-kit-ember",
};

/** A tone as the HUD sheet's elements take it: calm is none, amber the warn tone, ember the bad. */
export const HUD_TONE: Record<Tone, "warn" | "bad" | undefined> = {
  calm: undefined,
  amber: "warn",
  ember: "bad",
};

/** A tone as the HUD sheet's text: calm in ink, amber in warn, ember in bad. */
export const HUD_TONE_TEXT: Record<Tone, string> = {
  calm: "text-hud-ink",
  amber: "text-hud-warn",
  ember: "text-hud-bad",
};
