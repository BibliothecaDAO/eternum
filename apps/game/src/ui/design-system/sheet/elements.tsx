import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import "./sheet.css";

/**
 * The style sheet's elements: every button, field, tooltip, panel, tab, chip, ring, row and window the client draws,
 * each built only from the sheet's tokens (tokens.css) by its classes (sheet.css). A screen takes these and gives them
 * words and values, never a look of its own. /lab/kit shows each in every state.
 */

type ButtonKind = "primary" | "secondary" | "quiet";

/** A button: primary is a screen's one verb, secondary sits beside it, quiet is a way out. */
export const Button = ({
  kind,
  size = "md",
  icon,
  children,
  ...rest
}: {
  kind: ButtonKind;
  size?: "md" | "sm";
  icon?: IconMeaning;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...rest} className="ui-button" data-kind={kind} data-size={size}>
    {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
    {children}
  </button>
);

/** A button that is only its painting, named for assistive technology and the app's tooltip. */
export const IconButton = ({
  icon,
  label,
  kind = "secondary",
  ...rest
}: { icon: IconMeaning; label: string; kind?: ButtonKind } & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" aria-label={label} {...rest} className="ui-button" data-kind={kind} data-icon-only>
    <Icon name={icon} size={20} />
  </button>
);

/**
 * How many: the field, "of N" beside it, and its quick buttons (+500 adds, Max fills), all at one height. The quick
 * buttons stop when the field is full; that is their disabled state, not another look.
 */
export const AmountField = ({
  value,
  of,
  step,
  onChange,
  disabled = false,
  state,
}: {
  value: number;
  of: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** The lab's forced state for the field. */
  state?: string;
}) => {
  const full = value >= of;
  return (
    <div className="ui-amount">
      <label className="ui-field" data-state={state}>
        <span className="sr-only">Amount</span>
        <input
          inputMode="numeric"
          value={value.toLocaleString("en-US")}
          disabled={disabled}
          onChange={(event) => onChange(Math.min(of, Number(event.target.value.replace(/\D/g, "")) || 0))}
        />
      </label>
      <span className="ui-amount__of">of {of.toLocaleString("en-US")}</span>
      <Button kind="secondary" disabled={disabled || full} onClick={() => onChange(Math.min(of, value + step))}>
        +{step.toLocaleString("en-US")}
      </Button>
      <Button kind="secondary" disabled={disabled || full} onClick={() => onChange(of)}>
        Max
      </Button>
    </div>
  );
};

/**
 * The app's one tooltip: a line, and when the thing cannot be done, why and when it can; how to do it as a cue. The map's
 * order line is one ("Deploy an army here" / "Right-click").
 */
export const Tip = ({ line, why, how }: { line: string; why?: string; how?: string }) => (
  <span className="ui-tip" role="tooltip">
    <span className="ui-tip__line">{line}</span>
    {why && <span className="ui-tip__why">{why}</span>}
    {how && <span className="ui-tip__how">{how}</span>}
  </span>
);

/** The HUD's one panel (the InfoBubble look): a header band naming it, a cue at its end, then its body. */
export const Panel = ({
  title,
  cue,
  children,
  ...rest
}: { title?: ReactNode; cue?: ReactNode; children: ReactNode } & HTMLAttributes<HTMLElement>) => (
  <section {...rest} className="ui ui-panel">
    {title !== undefined && (
      <header className="ui-panel__head">
        <span>{title}</span>
        {cue !== undefined && <span className="ui-panel__cue">{cue}</span>}
      </header>
    )}
    <div className="ui-panel__body">{children}</div>
  </section>
);

/** A strip of choices; the chosen one in gold. */
export const Tabs = <K extends string>({
  tabs,
  value,
  onChange,
  states = {},
}: {
  tabs: readonly { key: K; label: string; count?: number; disabled?: boolean }[];
  value: K;
  onChange: (key: K) => void;
  /** The lab's forced state per tab. */
  states?: Partial<Record<K, string>>;
}) => (
  <div className="ui-tabs" role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.key}
        type="button"
        role="tab"
        className="ui-tab"
        aria-selected={tab.key === value}
        disabled={tab.disabled}
        data-state={states[tab.key]}
        onClick={() => onChange(tab.key)}
      >
        {tab.label}
        {tab.count !== undefined && <Chip>{tab.count}</Chip>}
      </button>
    ))}
  </div>
);

/** A small tag: a count in gold, or a state in its tone. */
export const Chip = ({ tone, children }: { tone?: "good" | "bad" | "warn"; children: ReactNode }) => (
  <span className="ui-chip" data-tone={tone}>
    {children}
  </span>
);

/** A troop tier: T1 blue, T2 green, T3 purple. */
export const TierChip = ({ tier }: { tier: 1 | 2 | 3 }) => (
  <span className="ui-chip" data-tier={tier}>
    T{tier}
  </span>
);

/**
 * A painting in a round well with its numbers on the rim: buildings top left, the amount on the foot, the time left on
 * the right, and how far production has come as an arc.
 */
export const Ring = ({
  icon,
  label,
  corner,
  foot,
  side,
  progress,
}: {
  icon: IconMeaning;
  label: string;
  corner?: ReactNode;
  foot?: ReactNode;
  side?: ReactNode;
  progress?: number;
}) => (
  <span className="ui-ring" role="img" aria-label={label}>
    {progress !== undefined && (
      <span
        className="ui-ring__arc"
        style={{ "--ui-ring": `${Math.round(Math.min(1, Math.max(0, progress)) * 360)}deg` } as React.CSSProperties}
      />
    )}
    <span className="ui-ring__face">
      <Icon name={icon} size={30} />
    </span>
    {corner !== undefined && (
      <span className="ui-ring__badge" data-at="corner">
        {corner}
      </span>
    )}
    {foot !== undefined && (
      <span className="ui-ring__badge" data-at="foot">
        {foot}
      </span>
    )}
    {side !== undefined && (
      <span className="ui-ring__badge" data-at="side">
        {side}
      </span>
    )}
  </span>
);

/** One thing of a list: what it is, what it says, its value; the chosen one carries a gold bar. */
export const Row = ({
  lead,
  title,
  detail,
  trail,
  selected = false,
  state,
}: {
  lead?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  trail?: ReactNode;
  selected?: boolean;
  state?: string;
}) => (
  <div className="ui-row" role="option" aria-selected={selected} data-state={state}>
    {lead}
    <span className="flex min-w-0 flex-col">
      <span className="ui-row__title">{title}</span>
      {detail !== undefined && <span className="ui-row__detail">{detail}</span>}
    </span>
    {trail !== undefined && <span className="ui-row__trail">{trail}</span>}
  </div>
);

/** What happened, said once: its time, a mark in its tone, the words (a name or a gain in gold). A notice is one too. */
export const EventRow = ({
  time,
  tone,
  children,
}: {
  time: string;
  tone?: "good" | "bad" | "warn";
  children: ReactNode;
}) => (
  <div className="ui-event" data-tone={tone}>
    <span className="ui-event__time">{time}</span>
    <span className="ui-event__mark" aria-hidden="true" />
    <span className="ui-event__text">{children}</span>
  </div>
);

/** A panel the size of a task: its title bar with a way out, then its body. */
export const Window = ({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon?: IconMeaning;
  onClose: () => void;
  children: ReactNode;
}) => (
  <section className="ui ui-window" role="dialog" aria-label={title}>
    <header className="ui-window__bar">
      {icon && <Icon name={icon} size={22} />}
      <span>{title}</span>
      <IconButton icon="close" label="Close" kind="quiet" onClick={onClose} />
    </header>
    <div className="ui-window__body">{children}</div>
  </section>
);

/** The minimap's frame: a panel with no header, its map in a well. */
export const MinimapFrame = ({ children }: { children: ReactNode }) => (
  <section className="ui ui-panel ui-minimap" aria-label="Minimap">
    <div className="ui-minimap__well">{children}</div>
  </section>
);
