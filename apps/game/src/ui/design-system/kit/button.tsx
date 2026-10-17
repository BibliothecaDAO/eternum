import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { type To, useNavigate } from "react-router-dom";

import { type PriceKind, PriceChip } from "./price-chip";

/**
 * Primary is the one verb a screen asks for; secondary sits beside it; outline is the quiet way out (Cancel, Try again).
 * Primary and secondary stand 56 tall, outline 48, so every tap reaches 48. Every word is in the text face, as the base
 * styles give every button.
 */
type ButtonRole = "primary" | "secondary" | "outline";

const ROLES: Record<ButtonRole, string> = {
  primary: "frontier-primary !h-14 !text-base",
  secondary:
    "h-14 rounded-plate border-2 border-kit-line2 bg-kit-ink text-base font-semibold text-kit-cream hover:border-kit-gold",
  outline:
    "h-12 rounded-plate border-2 border-kit-line2 bg-transparent text-base font-semibold text-kit-cream hover:border-kit-gold",
};

export type Price = { of: PriceKind; amount: number | undefined };

type ButtonProps = {
  role: ButtonRole;
  word: string;
  icon?: IconMeaning;
  prices?: readonly Price[];
  /** The step's word while the action is under way; the button waits until it clears. */
  loading?: string;
  disabled?: boolean;
  /** The verb still runs, and costs what the line under it says: a primary turns red. */
  warns?: boolean;
  type?: "button" | "submit";
  /** The host's placement only (width, flex); the look is the role's. */
  className?: string;
  onClick?: () => void;
  /** A verb that leads somewhere: the route it opens, after `onClick` has run. */
  to?: To;
};

/**
 * The kit's button: an icon, one word and the prices it pays. While its action is under way it shows that step's word
 * ("Deploying…") on itself and takes no second tap. Given `to`, the press leads to that route.
 */
export const Button = ({ to, ...button }: ButtonProps) =>
  to === undefined ? <ButtonFace {...button} /> : <RouteButton {...button} to={to} />;

const RouteButton = ({ to, onClick, ...button }: Omit<ButtonProps, "to"> & { to: To }) => {
  const navigate = useNavigate();
  return (
    <ButtonFace
      {...button}
      onClick={() => {
        onClick?.();
        navigate(to);
      }}
    />
  );
};

const ButtonFace = ({
  role,
  word,
  icon,
  prices = [],
  loading,
  disabled = false,
  warns = false,
  type = "button",
  className,
  onClick,
}: Omit<ButtonProps, "to">) => (
  <button
    type={type}
    aria-busy={loading !== undefined}
    disabled={disabled || loading !== undefined}
    data-warns={warns || undefined}
    onClick={onClick}
    className={cn(
      "inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap px-4 transition-colors disabled:cursor-not-allowed",
      ROLES[role],
      className,
    )}
  >
    {loading !== undefined ? (
      <>
        <SemanticIcon name="refresh" size={22} className="animate-spin" />
        <span>{loading}</span>
      </>
    ) : (
      <>
        {icon && <SemanticIcon name={icon} size={22} />}
        <span>{word}</span>
        {prices.map((price) => (
          <PriceChip key={price.of} of={price.of} amount={price.amount} />
        ))}
      </>
    )}
  </button>
);
