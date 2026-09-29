import type { BuildEffect } from "./build-options";

/** A building effect as a sheet shows it: the icon of what it gives, and how much (an hour, for what it makes). */
export const effectGain = (effect: BuildEffect): { icon: string; value: number; perHour: boolean } => {
  if (effect.kind === "produces")
    return { icon: `/images/resources/${effect.resource}.png`, value: effect.perHour, perHour: true };
  if (effect.kind === "capacity") return { icon: "/image-icons/resources.png", value: effect.amount, perHour: false };
  return { icon: "/image-icons/ui-person.png", value: effect.amount, perHour: false };
};
