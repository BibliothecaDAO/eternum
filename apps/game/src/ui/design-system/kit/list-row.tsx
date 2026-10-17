import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import type { ReactNode } from "react";
import { Link, type To } from "react-router-dom";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { paintingSources, type Painting } from "./paintings";

const HEIGHTS = { 12: "min-h-12", 14: "min-h-14", "52px": "h-[52px]" } as const;
const GAPS = { 2: "gap-2", 3: "gap-3" } as const;

/** The line under each row: between rows (none under the last), or under every row, the last too (the season list). */
const RULES = { between: "border-b border-kit-line last:border-b-0", under: "border-b border-kit-line" } as const;

/** The player's own row on a board, framed in gold on the ground: the season list's heavier edge, a rating's finer. */
const OWN = {
  framed: "rounded-control border-2 border-kit-gold bg-kit-ground",
  lit: "rounded-control border border-kit-gold bg-kit-ground",
} as const;

type RowAction =
  /** The row leads to a page of the app. */
  | { to: To; state?: unknown; href?: never; onClick?: never }
  /** The row opens another site in a new tab. */
  | { href: string; to?: never; state?: never; onClick?: never }
  /** The row runs a step. */
  | { onClick: () => void; to?: never; state?: never; href?: never }
  /** The row only shows; a control in it may act. */
  | { to?: never; state?: never; href?: never; onClick?: never };

/**
 * One row of a list: what leads it (a painting, a rank, an icon), its title with a line under it or the host's own
 * cells, and what ends it (a figure, a verb, the chevron of a row that opens). The whole row taps when it leads
 * somewhere. In a list (`as="li"`) the item carries the rule and the row inside it the tap.
 */
export const ListRow = ({
  as: Outer = "div",
  height,
  gap,
  rule = "between",
  own,
  current,
  lead,
  title,
  line,
  spaced = false,
  trailing,
  chevron = false,
  className,
  children,
  ...rest
}: RowAction & {
  /** The row's own element when it does not tap, or the list item around the tap when it does. */
  as?: "li" | "div";
  height?: keyof typeof HEIGHTS;
  gap?: keyof typeof GAPS;
  rule?: keyof typeof RULES;
  own?: keyof typeof OWN;
  /** The reader's own row, said to assistive tech. */
  current?: boolean;
  lead?: ReactNode;
  /** The row's name in bold, cut to one line; `line` under it in the host's own words. */
  title?: ReactNode;
  line?: ReactNode;
  /** Air between the title and its line. */
  spaced?: boolean;
  trailing?: ReactNode;
  chevron?: boolean;
  className?: string;
  children?: ReactNode;
  /** A hook the page and its proofs name the row by (`data-play-item`). */
  [hook: `data-${string}`]: string | undefined;
}) => {
  const { to, state, href, onClick, ...data } = rest as RowAction & Record<`data-${string}`, string | undefined>;
  const layout = cn("flex items-center", height && HEIGHTS[height], gap && GAPS[gap]);
  const frame = cn(RULES[rule], own && OWN[own]);
  const face = (
    <>
      {lead}
      {title !== undefined && (
        <span className={cn("flex min-w-0 flex-1 flex-col", spaced && "gap-1.5")}>
          <span className="truncate font-ui text-base font-bold text-kit-cream">{title}</span>
          {line}
        </span>
      )}
      {children}
      {trailing}
      {chevron && <SemanticIcon name="chevron-right" size={18} />}
    </>
  );
  const tapped = to !== undefined || href !== undefined || onClick !== undefined;
  // Alone, the tap is the row and carries its rule; in a list item, the item carries the rule.
  const classes = cn(layout, !(tapped && Outer === "li") && frame, className);
  const aria = { "aria-current": current || undefined };
  const tap =
    to !== undefined ? (
      <Link to={to} state={state} className={classes} {...aria} {...data}>
        {face}
      </Link>
    ) : href !== undefined ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes} {...aria} {...data}>
        {face}
      </a>
    ) : onClick !== undefined ? (
      <button type="button" onClick={onClick} className={classes} {...aria} {...data}>
        {face}
      </button>
    ) : null;
  if (tap === null)
    return (
      <Outer className={classes} {...aria} {...data}>
        {face}
      </Outer>
    );
  return Outer === "li" ? <li className={frame}>{tap}</li> : tap;
};

/** A row's painting, small: a game's age. */
export const RowThumb = ({ painting, size }: { painting: Painting; size: 10 | 12 }) => (
  <img
    {...paintingSources(painting)}
    sizes="48px"
    alt=""
    className={cn("shrink-0 rounded-thumb object-cover", size === 10 ? "size-10" : "size-12")}
  />
);
