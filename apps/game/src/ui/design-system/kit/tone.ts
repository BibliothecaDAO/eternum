/**
 * The kit's three tones: calm, amber (within the hour: a store fills, the day nears its end) and ember (at the limit,
 * the last hour). The caller decides the tone from the facts; the kit only draws it.
 */
export type Tone = "calm" | "amber" | "ember";

export const TONE_TEXT: Record<Tone, string> = {
  calm: "text-kit-cream",
  amber: "text-kit-hot",
  ember: "text-light-red",
};

export const TONE_FILL: Record<Tone, string> = {
  calm: "bg-kit-gold",
  amber: "bg-kit-hot",
  ember: "bg-light-red",
};

export const TONE_STROKE: Record<Tone, string> = {
  calm: "stroke-kit-amber",
  amber: "stroke-kit-hot",
  ember: "stroke-light-red",
};
