import { cn } from "@/ui/design-system/atoms/lib/utils";

import { type IconCode, KitIcon } from "./kit-icon";
import { type PriceKind, PriceChip } from "./price-chip";

/**
 * Primary is the one verb a screen asks for; secondary sits beside it; outline is the quiet way out (Cancel, Try again).
 * Primary and secondary stand 56 tall, outline 48, so every tap reaches 48.
 */
type ButtonRole = "primary" | "secondary" | "outline";

const ROLES: Record<ButtonRole, string> = {
  primary: "frontier-primary !h-14 !text-[17px]",
  secondary:
    "h-14 rounded-2xl border-2 border-[color:var(--frontier-line2)] bg-[color:var(--frontier-ink)] text-[17px] font-semibold text-[color:var(--frontier-parchment)] hover:border-[color:var(--frontier-gold)]",
  outline:
    "h-12 rounded-2xl border-2 border-[color:var(--frontier-line2)] bg-transparent text-[15px] font-semibold text-[color:var(--frontier-parchment)] hover:border-[color:var(--frontier-gold)]",
};

export type Price = { of: PriceKind; amount: number | undefined };

/**
 * The kit's button: an icon, one word and the prices it pays. While its action is under way it shows that step's word
 * ("Deploying…") on itself and takes no second tap.
 */
export const Button = ({
  role,
  word,
  icon,
  prices = [],
  loading,
  disabled = false,
  type = "button",
  className,
  onClick,
}: {
  role: ButtonRole;
  word: string;
  icon?: IconCode;
  prices?: Price[];
  /** The step's word while the action is under way; the button waits until it clears. */
  loading?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  /** The host's placement only (width, flex); the look is the role's. */
  className?: string;
  onClick?: () => void;
}) => (
  <button
    type={type}
    aria-busy={loading !== undefined}
    disabled={disabled || loading !== undefined}
    onClick={onClick}
    className={cn(
      "inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap px-4 transition-colors disabled:cursor-not-allowed",
      ROLES[role],
      className,
    )}
  >
    {loading !== undefined ? (
      <>
        <KitIcon code="Sp" size={22} className="animate-spin" />
        <span>{loading}</span>
      </>
    ) : (
      <>
        {icon && <KitIcon code={icon} size={22} />}
        <span>{word}</span>
        {prices.map((price) => (
          <PriceChip key={price.of} of={price.of} amount={price.amount} />
        ))}
      </>
    )}
  </button>
);
