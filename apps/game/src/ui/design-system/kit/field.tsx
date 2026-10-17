import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

/**
 * md is a field inside a panel (the lobby's chat), on the ground; lg is a step's one field (sign-in's email, a new
 * account's name), on the plate. md's right side is 2px tighter so its trailing key mark sits 12px in, where the chat's
 * has always stood.
 */
const SIZES = {
  md: "h-12 rounded-control border-kit-line2 bg-kit-ground pl-3 pr-2.5",
  lg: "h-14 rounded-plate border-kit-line bg-kit-plate px-4",
} as const;

/**
 * The kit's text field: the bordered box is the label, so a tap anywhere in it focuses the input. Its border turns peach
 * while it has focus; a field the player is told about holds its verdict instead: peach and ticked when valid, red when
 * refused.
 */
export const Field = ({
  size,
  icon,
  valid = false,
  invalid,
  trailing,
  className,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size: keyof typeof SIZES;
  /** The meaning before the input (the mail of an email field). */
  icon?: IconMeaning;
  valid?: boolean;
  /** Refused: the border turns red and the input says so (`aria-invalid`). */
  invalid?: boolean;
  /** After the input: a key mark, a step's own control. */
  trailing?: ReactNode;
  /** The input's own text (face, size, weight); the box is the size's. */
  className?: string;
}) => (
  <label
    className={cn(
      "flex items-center gap-2 border-2",
      SIZES[size],
      invalid ? "border-kit-red" : valid ? "border-kit-peach" : "focus-within:border-kit-peach",
    )}
  >
    {icon && <SemanticIcon name={icon} size={24} />}
    <input
      {...input}
      aria-invalid={invalid}
      className={cn(
        "min-w-0 flex-1 bg-transparent text-base text-kit-cream outline-none placeholder:text-kit-muted",
        className,
      )}
    />
    {valid && <SemanticIcon name="check" size={24} />}
    {trailing}
  </label>
);
