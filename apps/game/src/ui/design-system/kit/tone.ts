/**
 * The kit's three tones: calm, amber (within the hour: a store fills, the day nears its end) and ember (at the limit,
 * the last hour). The caller decides the tone from the facts; the kit only draws it.
 */
export type Tone = "calm" | "amber" | "ember";

export const TONE_TEXT: Record<Tone, string> = {
  calm: "text-[color:var(--frontier-parchment)]",
  amber: "text-[color:var(--frontier-hot)]",
  ember: "text-light-red",
};

export const TONE_FILL: Record<Tone, string> = {
  calm: "bg-[color:var(--frontier-gold)]",
  amber: "bg-[color:var(--frontier-hot)]",
  ember: "bg-light-red",
};

export const TONE_STROKE: Record<Tone, string> = {
  calm: "stroke-[color:var(--frontier-amber)]",
  amber: "stroke-[color:var(--frontier-hot)]",
  ember: "stroke-light-red",
};
