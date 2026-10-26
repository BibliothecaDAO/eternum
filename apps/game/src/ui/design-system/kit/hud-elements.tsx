import {
  formatTypedNumber,
  formatExact,
  formatPercent,
  formatShortDuration,
  readTypedNumber,
  typedNumberText,
  formatAmount,
} from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import {
  type ButtonHTMLAttributes,
  createContext,
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { OpenedFromPanel } from "./opened-from-panel";
import { useDragDownCloses, useSheetCloses } from "./sheet-closes";
import { BACK, CLOSE, TIER_WORDS, TRY_AGAIN } from "./words";

/**
 * The HUD's elements: everything the game draws over the map, each built only from the HUD scope of the token file
 * (src/tokens.ts: HUD_TYPE, HUD_SHEET, HUD_MODES) by its classes (hud-sheet.css). A screen takes these and gives them
 * words and values, never a look of its own. /lab/kit shows each in every state, age and device.
 */

/** The gold verb, a second choice, a quiet one, and what destroys something (delete, disband, dismiss). */
type ButtonKind = "primary" | "secondary" | "quiet" | "danger";
type Tone = "good" | "bad" | "warn";

/**
 * A press's send in flight: `press` runs the action unless a send it started is still pending, and while that promise
 * is pending `now` is true. A failed send frees the press for a retry, its error left to whoever reports it.
 */
const useSending = () => {
  const [now, setNow] = useState(false);
  const inFlight = useRef(false);
  const press = (action: () => unknown) => {
    if (inFlight.current) return;
    const sent = action();
    if (!(sent instanceof Promise)) return;
    inFlight.current = true;
    setNow(true);
    const settle = () => {
      inFlight.current = false;
      setNow(false);
    };
    sent.then(settle, (error: unknown) => {
      settle();
      throw error;
    });
  };
  return { now, press };
};

/**
 * A button: primary is a screen's one verb, secondary sits beside it, quiet is a way out. It carries its verb only; what
 * the verb costs is the line beside it (`HudCost`), never on the button (owner, sheet 2026-10-18).
 */
export const HudButton = forwardRef<
  HTMLButtonElement,
  {
    kind: ButtonKind;
    size?: "md" | "sm";
    icon?: IconMeaning;
    /** Its order is on its way: this word in place of its own, and no second press. */
    busy?: string;
    /** Its action. One that returns the send's promise holds the button until the send settles: no second press. */
    onClick?: (event: MouseEvent<HTMLButtonElement>) => unknown;
    children?: ReactNode;
  } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">
>(({ kind, size = "md", icon, busy, children, disabled, onClick, ...rest }, ref) => {
  const sending = useSending();
  const waits = busy !== undefined || sending.now;
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      disabled={disabled || waits}
      aria-busy={waits || undefined}
      className="ui-button"
      data-kind={kind}
      data-size={size}
      onClick={(event) => sending.press(() => onClick?.(event))}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
      {busy ?? children}
    </button>
  );
});
HudButton.displayName = "HudButton";

/** A button that is only its painting, named for assistive technology and the app's tooltip. */
export const HudIconButton = forwardRef<
  HTMLButtonElement,
  {
    icon: IconMeaning;
    label: string;
    kind?: ButtonKind;
    size?: "md" | "sm";
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ icon, label, kind = "secondary", size = "md", ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={label}
    {...rest}
    className="ui-button"
    data-kind={kind}
    data-size={size}
    data-icon-only
  >
    <Icon name={icon} size={size === "sm" ? 16 : 20} />
  </button>
));
HudIconButton.displayName = "HudIconButton";

/** What is typed (a name, a search, an amount), in a well as wide as its container. */
export const HudField = forwardRef<
  HTMLInputElement,
  {
    value: string;
    icon?: IconMeaning;
    /** The lab's forced state. */
    state?: string;
    onChange: (value: string) => void;
  } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "style">
>(({ value, icon, state, onChange, ...input }, ref) => (
  <label className="ui-field" data-fill data-state={state}>
    {icon && <Icon name={icon} size={16} />}
    <input ref={ref} {...input} value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
));
HudField.displayName = "HudField";

/**
 * Whole units typed into an amount field, read as the game has always read them: a sign, digits and thousands commas,
 * the whole part only ("1.5" is 1), held between `min` and `max` ("-500" is 0). Nothing typed yet is null: the field
 * stays blank until it loses focus, and nothing is reported.
 */
const parseWholeAmount = (text: string, min: number, max: number): number | null =>
  heldBetween(readTypedNumber(text, { whole: true }), min, max);

/**
 * A number with its fraction typed into a decimal field (a price, a swap), read as the game has always read it: a
 * sign, digits, thousands commas and a fraction, at most `max`, and below `min` only as `min` ("-2" is 0). Nothing
 * typed yet is null; anything else that holds no number is `min`.
 */
const parseDecimalAmount = (text: string, min: number, max: number): number | null =>
  heldBetween(readTypedNumber(text), min, max);

const heldBetween = (typed: number | null, min: number, max: number): number | null =>
  typed === null ? null : Math.min(Math.max(Number.isNaN(typed) ? min : typed, min), max);

/**
 * The one amount input every amount element types into: whole units, formatted, blank while cleared. A decimal one keeps
 * what is typed on screen while it has focus, so a fraction can be typed one digit at a time ("0." stays "0.").
 */
export const AmountInput = ({
  label,
  value,
  min = 0,
  max,
  decimals = false,
  disabled,
  autoFocus,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  decimals?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (amount: number) => void;
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="ui-field">
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        inputMode={decimals ? "decimal" : "numeric"}
        value={draft ?? formatTypedNumber(value)}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(event) => {
          const text = event.target.value;
          const amount = decimals ? parseDecimalAmount(text, min, max) : parseWholeAmount(text, min, max);
          if (amount === null) setDraft("");
          else setDraft(decimals ? (typedNumberText(text) ?? formatTypedNumber(amount)) : null);
          if (amount !== null) onChange(amount);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
};

/**
 * A number set in steps (a simulated army's troops or stamina, a price): the amount typed, between `min` and `max`, and
 * a step down and up on either side; whole units, or with `decimals` its fraction too. A whole field tops out at the
 * whole part of `max`: a 28.2 balance allows 28.
 */
export const HudNumberField = ({
  label,
  value,
  min = 0,
  max,
  step = 1,
  decimals = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  decimals?: boolean;
  disabled?: boolean;
  onChange: (amount: number) => void;
}) => {
  const top = decimals ? max : Math.floor(max);
  return (
    <div className="ui-number">
      <HudButton
        kind="secondary"
        size="sm"
        aria-label={`Fewer: ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(value - step, min))}
      >
        −
      </HudButton>
      <AmountInput
        label={label}
        value={value}
        min={min}
        max={top}
        decimals={decimals}
        disabled={disabled}
        onChange={onChange}
      />
      <HudButton
        kind="secondary"
        size="sm"
        aria-label={`More: ${label}`}
        disabled={disabled || value >= top}
        onClick={() => onChange(Math.min(value + step, top))}
      >
        +
      </HudButton>
    </div>
  );
};

/** What one press of the quick button adds. */
const QUICK_ADD = 500;

/**
 * How many troops go, for a quick deploy (the owner's rounds 3 and 4): the count typed with +500 per press (where more
 * than 500 can go; else it would only be Max) and Max right beside it, then out of how many can ("that fit" when the army's room runs out first); under them, a slider
 * across the same range, to drag the count by hand (the owner, playing dev: "I kinda wish I still had the slider").
 */
export const HudTroopAmount = ({
  name,
  value,
  most,
  held,
  disabled = false,
  onChange,
}: {
  name: string;
  value: number;
  /** The most that can go: the troops on hand within the army's room. */
  most: number;
  /** How many are on hand; when fewer fit, the count reads "of N that fit". */
  held: number;
  disabled?: boolean;
  onChange: (amount: number) => void;
}) => {
  const full = disabled || value >= most;
  return (
    <div className="ui-amount">
      <AmountInput label={name} value={value} max={most} disabled={disabled} onChange={onChange} />
      {most > QUICK_ADD && (
        <HudButton kind="secondary" disabled={full} onClick={() => onChange(Math.min(value + QUICK_ADD, most))}>
          +{QUICK_ADD}
        </HudButton>
      )}
      <HudButton kind="secondary" disabled={full} onClick={() => onChange(most)}>
        Max
      </HudButton>
      <span className="ui-amount__of">
        of {formatExact(most)}
        {held > most && " that fit"}
      </span>
      <HudSlider label={`${name}: how many go`} value={value} max={most} disabled={disabled} onChange={onChange} />
    </div>
  );
};

/**
 * A stack of troops a realm holds: its painting, its tier and how many. `disabled` shuts one the realm holds but this
 * deploy cannot take (a guard slot takes only the troop and tier already in it).
 */
export type HudTroopStack = { key: string; icon: IconMeaning; tier: 1 | 2 | 3; held: number; disabled?: boolean };

/**
 * Deploying an army: a column per troop, its tiers under its name, every one always in the same place (an empty one
 * dimmed), so the hand learns where to click; under them, the chosen stack's amount with +500, Max and its slider. Where
 * the army goes and the Deploy verb with its cost are the caller's: the map's picker hangs on a tile, the Military
 * window adds its map selector.
 */
export const HudDeploy = ({
  troops,
  chosen,
  onChoose,
  value,
  most,
  onChange,
}: {
  troops: readonly { name: string; stacks: readonly HudTroopStack[] }[];
  /** The chosen stack's key. */
  chosen: string;
  onChoose: (key: string) => void;
  /** How many go, and the most that can (the chosen stack within the army's room). */
  value: number;
  most: number;
  onChange: (amount: number) => void;
}) => {
  const troop = troops.find(({ stacks }) => stacks.some(({ key }) => key === chosen));
  const stack = troop?.stacks.find(({ key }) => key === chosen);
  return (
    <div className="ui-deploy">
      <div className="ui-deploy__troops" role="group" aria-label="Troops">
        {troops.map(({ name, stacks }) => (
          <div key={name} className="ui-deploy__troop">
            <span className="ui-deploy__name">{name}</span>
            {stacks.map(({ key, icon, tier, held, disabled }) => (
              <HudButton
                key={key}
                kind="secondary"
                size="sm"
                disabled={held === 0 || disabled}
                aria-pressed={key === chosen}
                aria-label={`${name} T${tier}, ${formatAmount(held)} held`}
                onClick={() => onChoose(key)}
              >
                <Icon name={icon} size={20} />
                <HudTierChip tier={tier} />
                {held > 0 ? formatAmount(held) : "none"}
              </HudButton>
            ))}
          </div>
        ))}
      </div>
      {troop && stack && (
        <HudTroopAmount
          name={`${troop.name} T${stack.tier}`}
          value={value}
          most={most}
          held={stack.held}
          disabled={most === 0}
          onChange={onChange}
        />
      )}
    </div>
  );
};

/** The shares a transfer row's quick steps take of what is held. */
const TRANSFER_STEPS = [0.25, 0.5, 0.75, 1] as const;

/**
 * How much of something, from `min` (none by default) to `max`, dragged: the part taken fills the track in the age's
 * accent. Where something runs out first (the wheat a deploy costs), `stop` marks it on the track and the thumb stops
 * there.
 */
export const HudSlider = ({
  label,
  value,
  min = 0,
  max,
  stop,
  step = 1,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  stop?: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) => {
  const share = (amount: number) => `${max > min ? ((amount - min) / (max - min)) * 100 : 0}%`;
  const most = Math.min(stop ?? max, max);
  return (
    <span className="ui-slider">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ "--fill": share(value) } as React.CSSProperties}
        onChange={(event) => onChange(Math.min(Number(event.target.value), most))}
      />
      {stop !== undefined && stop < max && (
        <i className="ui-slider__stop" aria-hidden="true" style={{ left: share(stop) }} />
      )}
    </span>
  );
};

/**
 * What a transfer moves: one row per resource, its painting and name, what is held, a slider, quick steps taking a share
 * of what is held, and the amount typed. A row that cannot be sent says why in place of its controls.
 */
export const HudTransfer = ({
  rows,
  onChange,
}: {
  /** `focus`: the row the window opened for, its total ready to type. `blocked`: why it cannot be sent. */
  rows: readonly {
    icon: IconMeaning;
    name: string;
    held: number;
    value: number;
    focus?: boolean;
    state?: string;
    blocked?: string;
  }[];
  onChange: (index: number, amount: number) => void;
}) => (
  <div className="ui-transfer">
    {rows.map((row, index) => (
      <div
        key={row.name}
        className="ui-transfer__row"
        data-state={row.state}
        aria-disabled={row.blocked ? true : undefined}
      >
        <span className="ui-transfer__what">
          <Icon name={row.icon} size={24} />
          <span className="flex flex-col">
            <span>{row.name}</span>
            <span className="ui-transfer__held">{formatExact(row.held)} held</span>
          </span>
        </span>
        {row.blocked ? (
          <span className="ui-transfer__held ui-transfer__why">{row.blocked}</span>
        ) : (
          <TransferControls row={row} onChange={(amount) => onChange(index, amount)} />
        )}
      </div>
    ))}
  </div>
);

/** A sendable row's controls: a slider, quick steps taking a share of what is held, and the amount typed. */
const TransferControls = ({
  row,
  onChange,
}: {
  row: { name: string; held: number; value: number; focus?: boolean };
  onChange: (amount: number) => void;
}) => (
  <>
    <HudSlider label={`${row.name}: share to send`} value={row.value} max={row.held} onChange={onChange} />
    <span className="ui-transfer__steps">
      {TRANSFER_STEPS.map((step) => (
        <HudButton
          key={step}
          kind="secondary"
          size="sm"
          disabled={row.held === 0}
          aria-pressed={row.held > 0 && row.value === Math.round(row.held * step)}
          onClick={() => onChange(Math.round(row.held * step))}
        >
          {step === 1 ? "Max" : formatPercent(step)}
        </HudButton>
      ))}
    </span>
    <AmountInput
      label={`${row.name}: total to send`}
      value={row.value}
      max={row.held}
      autoFocus={row.focus}
      onChange={onChange}
    />
  </>
);

/**
 * What a verb costs, rounded as every charge reads (formatCharge), as one compact line: under the order on the map's order line and the app's
 * tooltip, and beside a button, which carries its verb only (`costLine` writes it from the verb's prices). Nothing when
 * it costs nothing.
 */
export const HudCost = ({ line }: { line: string }) => (line ? <span className="ui-cost">{line}</span> : null);

/**
 * The HUD's one panel: a header band naming it (its icon, its title, a cue at its end) over a divider, then its body.
 * With a `label` it is a named section for assistive technology (a landmark). Its chevron and title fold its body away
 * unless `collapsible` is off; the cue's own controls never fold it. With `onTitle` the whole header band is one press
 * instead (the realm card's way home), and the panel never folds. A `section` is a part of a panel: the same header
 * and body on the panel's surface, and a `divided` body stacks such sections with a divider between each.
 * `className` and `bodyClassName` place the panel and lay out its body (flex, overflow, a height, no padding), never
 * its look.
 */
export const HudPanel = ({
  title,
  onTitle,
  cue,
  icon,
  label,
  collapsible = true,
  defaultCollapsed = false,
  kind = "panel",
  divided = false,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  /** The header's one press, named for assistive technology and its tooltip; such a panel never folds. */
  onTitle?: { label: string; run: () => void };
  cue?: ReactNode;
  icon?: IconMeaning;
  label?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  kind?: "panel" | "section";
  divided?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const folds = collapsible && onTitle === undefined;
  const folded = folds && collapsed;
  const Root = label ? "section" : "div";
  return (
    <Root aria-label={label} className={cn(kind === "panel" ? "ui ui-panel" : "ui-section", "shrink-0", className)}>
      {title !== undefined && (
        <PanelHead
          title={title}
          icon={icon}
          cue={cue}
          press={
            onTitle
              ? { kind: "action", ...onTitle }
              : folds
                ? { kind: "fold", folded, toggle: () => setCollapsed((value) => !value) }
                : null
          }
        />
      )}
      {!folded && (
        <div className={cn("ui-panel__body", bodyClassName)} data-divided={divided || undefined}>
          {children}
        </div>
      )}
    </Root>
  );
};

/** What pressing a panel's header does: fold its body, or the panel's one action across the whole band. */
type HeadPress =
  | { kind: "fold"; folded: boolean; toggle: () => void }
  | { kind: "action"; label: string; run: () => void };

/** A panel's header band: its name (a fold toggle when the panel folds, or the panel's one action) and its cue. */
const PanelHead = ({
  title,
  icon,
  cue,
  press,
}: {
  title: ReactNode;
  icon?: IconMeaning;
  cue?: ReactNode;
  press: HeadPress | null;
}) => {
  const name = (
    <>
      {press?.kind === "fold" && <Icon name="chevron-down" className="ui-panel__chevron" data-folded={press.folded} />}
      {icon && <Icon name={icon} className="ui-panel__icon" />}
      <span className="ui-panel__title">{title}</span>
    </>
  );
  return (
    <header className="ui-panel__head">
      {press?.kind === "fold" ? (
        <button type="button" className="ui-panel__name" aria-expanded={!press.folded} onClick={press.toggle}>
          {name}
        </button>
      ) : press?.kind === "action" ? (
        <button
          type="button"
          className="ui-panel__name"
          data-action
          aria-label={press.label}
          data-tip={press.label}
          onClick={press.run}
        >
          {name}
        </button>
      ) : (
        <span className="ui-panel__name">{name}</span>
      )}
      {cue !== undefined && <span className="ui-panel__cue">{cue}</span>}
    </header>
  );
};

/** A strip of choices; the chosen one in the age's accent. */
export const HudTabs = <K extends string | number>({
  tabs,
  value,
  onChange,
  size = "md",
  states = {},
}: {
  /**
   * Each tab; `title` is its hover text, what the tab holds in full. A tab may be its painting (`icon`) and count with
   * no word, named then by `ariaLabel`: it draws compact, its count a badge on the painting, so a row of kinds fits a
   * narrow column. A strip too wide for its place wraps; no tab ever leaves it.
   */
  tabs: readonly {
    key: K;
    label?: string;
    icon?: IconMeaning;
    ariaLabel?: string;
    count?: number;
    /** The count's tone, where it says how things stand (green: ready to claim). */
    countTone?: Tone;
    disabled?: boolean;
    title?: string;
  }[];
  value: K;
  onChange: (key: K) => void;
  /** A strip in a line of body text (the top bar's): its words at the body's size. */
  size?: "md" | "sm";
  /** The lab's forced state per tab. */
  states?: Partial<Record<K, string>>;
}) => (
  <div className="ui-tabs" role="tablist" data-size={size}>
    {tabs.map((tab) => (
      <button
        key={tab.key}
        type="button"
        role="tab"
        className="ui-tab"
        aria-selected={tab.key === value}
        disabled={tab.disabled}
        title={tab.title}
        aria-label={tab.ariaLabel}
        data-state={states[tab.key]}
        data-shape={tab.icon && !tab.label ? "mark" : undefined}
        onClick={() => onChange(tab.key)}
      >
        {tab.icon && !tab.label ? (
          <span className="ui-tab__mark">
            <Icon name={tab.icon} size={22} />
            {tab.count !== undefined && <HudChip tone={tab.countTone}>{tab.count}</HudChip>}
          </span>
        ) : (
          <>
            {tab.icon && <Icon name={tab.icon} size={22} />}
            {tab.label}
            {tab.count !== undefined && <HudChip tone={tab.countTone}>{tab.count}</HudChip>}
          </>
        )}
      </button>
    ))}
  </div>
);

/** A small tag: a count in the age's accent, or a state in its tone. */
export const HudChip = ({
  tone,
  icons,
  label,
  tip,
  children,
}: {
  tone?: Tone;
  /** The paintings of what it counts, one or two overlapping (stamina; a returning army's troops). */
  icons?: readonly IconMeaning[];
  /** What it counts, for assistive technology, which reads it with the chip's own words ("Stamina 120"). */
  label?: string;
  /** A fuller line for the hover than the chip's words, where the facts have one. */
  tip?: string;
  children: ReactNode;
}) => (
  <span
    className="ui-chip"
    data-tone={tone}
    data-tip={tip}
    role={label === undefined ? undefined : "img"}
    aria-label={label === undefined ? undefined : `${label} ${textOf(children)}`}
  >
    {icons && icons.length > 0 && (
      <span className="ui-chip__icons" aria-hidden="true">
        {icons.map((icon) => (
          <Icon key={icon} name={icon} size={16} />
        ))}
      </span>
    )}
    {children}
  </span>
);

/** The words a chip's children say, for its name: its strings and numbers, joined. */
const textOf = (node: ReactNode): string =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node
          .map((child) => textOf(child).trim())
          .filter(Boolean)
          .join(" ")
      : "";

/** A troop tier: T1 blue, T2 green, T3 purple. */
export const HudTierChip = ({ tier }: { tier: 1 | 2 | 3 }) => (
  <span className="ui-chip" data-tier={tier}>
    T{tier}
  </span>
);

/**
 * A chest's rarity, common to legendary: its pips filled to its tier on a frame that thickens and warms with it, its
 * word beside them where there is room. Not a troop tier: a rarity has five steps and no colours of its own kind.
 */
export const HudRarity = ({ tier, word = false }: { tier: 1 | 2 | 3 | 4 | 5; word?: boolean }) => (
  <span className="ui-rarity" data-tier={tier} role="img" aria-label={TIER_WORDS[tier - 1]}>
    <span aria-hidden className="ui-rarity__pips">
      {TIER_WORDS.map((name, index) => (
        <i key={name} data-filled={index < tier || undefined} />
      ))}
    </span>
    {word && <span aria-hidden>{TIER_WORDS[tier - 1]}</span>}
  </span>
);

/**
 * A number in a ring that drains (the day, as today runs out): the ring is the share left, from 1 to 0, and takes a
 * tone near its end. `label` is all it says for assistive technology.
 */
export const HudDial = ({
  value,
  share,
  tone,
  label,
}: {
  value: ReactNode;
  share: number;
  tone?: Tone;
  label: string;
}) => (
  <span className="ui-dial" data-tone={tone} role="img" aria-label={label}>
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle className="ui-dial__track" cx="20" cy="20" r="15" />
      <circle
        className="ui-dial__left"
        cx="20"
        cy="20"
        r="15"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - Math.min(1, Math.max(0, share))}
      />
    </svg>
    <span aria-hidden="true">{value}</span>
  </span>
);

/**
 * A painting in a round well with its numbers on the rim, all in one badge: buildings top left, the time left top
 * right, the amount on the foot; how far production has come as an arc, its rim in its state's tone (producing good,
 * idle warn). One size wherever it stands, in a list or a panel, so every ring in a row reads alike. The two top badges
 * share one line, so they push apart and never cover each other, and the ring writes the time left (`timeLeft`, in
 * seconds) in three characters at most ("7h", "14w"), the most that fits beside a count, so a ring's top line stays
 * inside its place in a row; a time that never runs out has nothing to count and shows no badge. `tip` is its hover
 * (the resource's name), `label` all it says for assistive technology. With `onClick` it is a button.
 */
export const HudRing = ({
  icon,
  label,
  tip,
  state,
  corner,
  timeLeft,
  foot,
  progress,
  onClick,
}: {
  icon: IconMeaning;
  label: string;
  tip?: string;
  state?: "producing" | "idle";
  corner?: ReactNode;
  timeLeft?: number;
  foot?: ReactNode;
  progress?: number;
  onClick?: () => void;
}) => {
  const time = timeLeft !== undefined && Number.isFinite(timeLeft) ? formatShortDuration(timeLeft) : undefined;
  const body = (
    <>
      {progress !== undefined && (
        <span
          className="ui-ring__arc"
          style={{ "--ring-arc": `${Math.round(Math.min(1, Math.max(0, progress)) * 360)}deg` } as React.CSSProperties}
        />
      )}
      <span className="ui-ring__face">
        <Icon name={icon} size={32} />
      </span>
      {(corner !== undefined || time !== undefined) && (
        <span className="ui-ring__top">
          {corner !== undefined && (
            <span className="ui-ring__badge" data-at="corner">
              {corner}
            </span>
          )}
          {time !== undefined && (
            <span className="ui-ring__badge" data-at="timer">
              {time}
            </span>
          )}
        </span>
      )}
      {foot !== undefined && (
        <span className="ui-ring__badge" data-at="foot">
          {foot}
        </span>
      )}
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="ui-ring"
      data-production={state}
      data-tip={tip}
      aria-label={label}
      onClick={onClick}
    >
      {body}
    </button>
  ) : (
    <span className="ui-ring" data-production={state} data-tip={tip} role="img" aria-label={label}>
      {body}
    </span>
  );
};

/**
 * One thing of a list: what it is and what it says; hover lights it, the chosen one carries a bar in the accent. With
 * `onClick` it is a button: choosing it is pressing it.
 */
export const HudRow = ({
  lead,
  label,
  title,
  detail,
  trail,
  selected = false,
  state,
  disabled,
  tip,
  onClick,
}: {
  lead?: ReactNode;
  /** The name of the button that chooses the row, where its words say more than its name (an army's figures). */
  label?: string;
  title: ReactNode;
  detail?: ReactNode;
  /**
   * What follows the row's words: its own controls (Provision, Level up) or a figure (a bonus). With them the row is a
   * container: its lead, its words (the button that chooses it, when it has `onClick`) and its trail side by side,
   * never one button inside another.
   */
  trail?: ReactNode;
  selected?: boolean;
  state?: string;
  disabled?: boolean;
  /** What the row stands for in full, on the app's hover (a research row's next tier). */
  tip?: string;
  onClick?: () => void;
}) => {
  if (trail !== undefined) {
    return (
      <div className="ui-row" aria-selected={selected} aria-disabled={disabled} data-state={state} data-tip={tip}>
        {lead}
        {onClick ? (
          <button
            type="button"
            className="ui-row__choose"
            aria-label={label}
            aria-pressed={selected}
            disabled={disabled}
            onClick={onClick}
          >
            <span className="ui-row__title">{title}</span>
            {detail !== undefined && <span className="ui-row__detail">{detail}</span>}
          </button>
        ) : (
          <span className="ui-row__choose">
            <span className="ui-row__title">{title}</span>
            {detail !== undefined && <span className="ui-row__detail">{detail}</span>}
          </span>
        )}
        <span className="ui-row__controls">{trail}</span>
      </div>
    );
  }
  const words = (
    <>
      {lead}
      <span className="flex min-w-0 flex-col">
        <span className="ui-row__title">{title}</span>
        {detail !== undefined && <span className="ui-row__detail">{detail}</span>}
      </span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="ui-row"
      aria-label={label}
      role="option"
      aria-selected={selected}
      data-state={state}
      data-tip={tip}
      disabled={disabled}
      onClick={onClick}
    >
      {words}
    </button>
  ) : (
    <div
      className="ui-row"
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      data-state={state}
      data-tip={tip}
    >
      {words}
    </div>
  );
};

/**
 * One row of a table (the leaderboard): its columns on the caller's grid, `cols` (and `colsWide` from a tablet up), with
 * the list row's hover and the chosen one's bar. With `onClick` it is a button, so Enter and Space choose it; `disabled`
 * when it leads nowhere, `title` its hover. Without it the row is only read (a reference table in a role="table"): no
 * hover, no cursor.
 */
export const HudTableRow = ({
  cols,
  colsWide,
  label,
  title,
  selected = false,
  disabled = false,
  state,
  onClick,
  children,
}: {
  cols: string;
  colsWide?: string;
  label: string;
  title?: string;
  selected?: boolean;
  disabled?: boolean;
  state?: string;
  onClick?: () => void;
  children: ReactNode;
}) =>
  onClick ? (
    <button
      type="button"
      className="ui-table-row"
      aria-label={label}
      title={title}
      aria-current={selected || undefined}
      disabled={disabled}
      data-state={state}
      style={{ "--cols": cols, "--cols-wide": colsWide ?? cols } as React.CSSProperties}
      onClick={onClick}
    >
      {children}
    </button>
  ) : (
    <div
      className="ui-table-row"
      role="row"
      aria-label={label}
      title={title}
      aria-current={selected || undefined}
      data-state={state}
      style={{ "--cols": cols, "--cols-wide": colsWide ?? cols } as React.CSSProperties}
    >
      {children}
    </div>
  );

/** A table's header: its column names on the same grid as its rows, staying over them as they scroll. */
export const HudTableHead = ({
  cols,
  colsWide,
  children,
}: {
  cols: string;
  colsWide?: string;
  children: ReactNode;
}) => (
  <div className="ui-table-head" style={{ "--cols": cols, "--cols-wide": colsWide ?? cols } as React.CSSProperties}>
    {children}
  </div>
);

/**
 * A card to pick (a building to build): its painting on the well, drawn whole, its name and what it says on the foot,
 * its own small actions stacked at the top left and a badge at the top right. With `onClick` one button covers the
 * painting and the foot and chooses the card (pressed when `selected`); the actions and the badge sit beside it, never
 * inside it. A card that cannot be chosen says why on its foot, in the muted label colour: it explains, it does not warn.
 */
export const HudCard = ({
  title,
  picture,
  detail,
  corner,
  actions,
  size = "md",
  selected = false,
  disabled = false,
  refusal,
  onClick,
}: {
  title: ReactNode;
  picture: ReactNode;
  detail?: ReactNode;
  corner?: ReactNode;
  actions?: ReactNode;
  /** md in a window's grid; sm three to a sheet's row, its painting above its name. */
  size?: "md" | "sm";
  selected?: boolean;
  disabled?: boolean;
  refusal?: string;
  onClick?: () => void;
}) => {
  const refusalId = useId();
  const described = refusal === undefined ? undefined : refusalId;
  const face = (
    <>
      <span className="ui-card__picture" aria-hidden="true">
        {picture}
      </span>
      <span className="ui-card__foot">
        {refusal !== undefined && (
          <span className="ui-card__refusal" id={refusalId}>
            {refusal}
          </span>
        )}
        <span className="ui-card__title">{title}</span>
        {detail !== undefined && <span className="ui-card__detail">{detail}</span>}
      </span>
    </>
  );
  return (
    <div
      className="ui-card"
      data-size={size}
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
    >
      {onClick ? (
        <button
          type="button"
          className="ui-card__choose"
          aria-pressed={selected}
          aria-describedby={described}
          disabled={disabled}
          onClick={onClick}
        >
          {face}
        </button>
      ) : (
        <div className="ui-card__choose" aria-describedby={described}>
          {face}
        </div>
      )}
      {actions !== undefined && <div className="ui-card__actions">{actions}</div>}
      {corner !== undefined && <div className="ui-card__corner">{corner}</div>}
    </div>
  );
};

/**
 * What happened, said once: its time, a mark in its tone (or the painting of what kind of news it is), the words (a
 * name or a gain in the accent), whole on hover through `tip`. With `onOpen` the row is the button that goes where it
 * happened; `trail` is its one action (Retry), beside that button, never inside it. A notice of the moment has no time.
 */
export const HudEventRow = ({
  time,
  tone,
  icon,
  tip,
  onOpen,
  trail,
  children,
}: {
  time?: string;
  tone?: Tone;
  icon?: IconMeaning;
  tip?: string;
  onOpen?: () => void;
  trail?: ReactNode;
  children: ReactNode;
}) => {
  const words = (
    <>
      {time !== undefined && <span className="ui-event__time">{time}</span>}
      {icon ? (
        <Icon name={icon} size={16} className="ui-event__icon" />
      ) : (
        <span className="ui-event__mark" aria-hidden="true" />
      )}
      <span className="ui-event__text" data-tip={tip}>
        {children}
      </span>
    </>
  );
  return (
    <div className="ui-event" data-tone={tone}>
      {onOpen ? (
        <button type="button" className="ui-event__open" onClick={onOpen}>
          {words}
        </button>
      ) : (
        words
      )}
      {trail}
    </div>
  );
};

/**
 * A line the game says about the screen it sits in: a refusal, a warning, a success, and why. A failure the player can
 * recover from carries Try again (`retry`), so the recovery sits on the line that names what failed.
 */
export const HudNotice = ({
  tone,
  line,
  why,
  retry,
}: {
  tone?: Tone;
  line: string;
  why?: string;
  retry?: () => unknown;
}) => (
  <div className="ui-notice" data-tone={tone} role={tone === "bad" ? "alert" : "status"}>
    <span className="flex flex-col">
      <span>{line}</span>
      {why && <span className="ui-notice__why">{why}</span>}
    </span>
    {retry && (
      <span className="ui-notice__retry">
        <HudButton kind="secondary" size="sm" onClick={retry}>
          {TRY_AGAIN}
        </HudButton>
      </span>
    )}
  </div>
);

/**
 * News across the top of the map: what kind it is (its painting and a word over the headline), the headline, a line,
 * and what the player can do about it; its side in the news' tone (bad for a war report, warn for a timer).
 */
export const HudBanner = ({
  tone,
  icon,
  eyebrow,
  title,
  line,
  actions,
}: {
  tone?: Tone;
  icon: IconMeaning;
  eyebrow: string;
  title: string;
  line?: ReactNode;
  actions?: ReactNode;
}) => (
  <section className="ui ui-banner" data-tone={tone} role="status" aria-label={title}>
    <span className="ui-banner__mark" aria-hidden="true">
      <Icon name={icon} size={20} />
    </span>
    <span className="ui-banner__words">
      <span className="ui-banner__eyebrow">{eyebrow}</span>
      <span className="ui-banner__title">{title}</span>
      {line && <span className="ui-banner__line">{line}</span>}
    </span>
    {actions !== undefined && <span className="ui-banner__actions">{actions}</span>}
  </section>
);

/**
 * How big a window is, by what it holds: one task (a name, a relic, a confirmation), a page to read (a Wonder's
 * faith), or a workspace (Build, Production, Transfer, the market) that fills the desk on desktop and the sheet on a
 * phone.
 */
type WindowSize = "task" | "page" | "workspace" | "fit";

/** The foot of the window a body is drawn in, once the window is drawn. */
const WindowFootContext = createContext<HTMLElement | null>(null);

/**
 * A panel the size of a task: its title bar with a way out (dragging the bar moves the window), its body, which scrolls
 * within the window's height, and its foot, which its body fills (HudWindowFoot) and which is hidden while empty.
 */
export const HudWindow = ({
  title,
  icon,
  size,
  onClose,
  children,
}: {
  title: string;
  icon?: IconMeaning;
  size?: WindowSize;
  onClose: () => void;
  children: ReactNode;
}) => {
  const [foot, setFoot] = useState<HTMLElement | null>(null);
  return (
    <section className="ui ui-window" role="dialog" aria-label={title} data-size={size}>
      <header className="ui-window__bar" data-popover-drag-handle>
        {icon && <Icon name={icon} size={22} />}
        <span>{title}</span>
        <HudIconButton icon="close" label="Close" kind="quiet" onClick={onClose} />
      </header>
      <WindowFootContext.Provider value={foot}>
        <div className="ui-window__body">{children}</div>
      </WindowFootContext.Provider>
      <footer ref={setFoot} className="ui-window__foot ui-actions" />
    </section>
  );
};

/**
 * Where a sheet stands when its host keeps a place for its sheets (Frontier's desktop rail, the one home for everything):
 * the sheet stands in that place, in its flow. None elsewhere: a sheet floats over the stage.
 */
export const SheetDock = createContext<HTMLElement | null>(null);

/**
 * A sheet over the stage: the panel's look, its name in the header band and its way out as the cue (a cross, or a back
 * arrow when it opened from another panel, whose place it takes). On a phone it rises from the place bar, as tall as
 * what it holds and at most the phone panel's height, under that one row (owner, 26 October 2026: layout A), which a
 * drag down also closes; the map above it stays playable. From the desktop width
 * up it docks under the top bar or in its host's SheetDock, with the stage playable beside it. Escape and system back
 * close it on both. Its foot is a window's (HudWindowFoot), so the verb and cost stay visible while the body scrolls.
 */
export const HudSheet = ({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) => {
  const back = useContext(OpenedFromPanel);
  const dock = useContext(SheetDock);
  const [foot, setFoot] = useState<HTMLElement | null>(null);
  useSheetCloses(onClose);
  const drag = useDragDownCloses(onClose);
  const sheet = (
    <section
      role="dialog"
      aria-label={label}
      data-kit-sheet
      data-docked={dock ? "" : undefined}
      className="ui ui-panel ui-sheet"
    >
      <div className="ui-sheet__head" {...drag.handlers}>
        <PanelHead
          title={label}
          cue={
            <HudIconButton
              icon={back ? "arrow-left" : "close"}
              label={back ? BACK : CLOSE}
              kind="quiet"
              size="sm"
              onClick={onClose}
            />
          }
          press={null}
        />
      </div>
      <WindowFootContext.Provider value={foot}>
        <div className="ui-sheet__body">{children}</div>
      </WindowFootContext.Provider>
      <footer ref={setFoot} className="ui-window__foot ui-actions" />
    </section>
  );
  return dock ? createPortal(sheet, dock) : sheet;
};

/**
 * The one way to fill a window's or a sheet's foot, as actions (HudActions): the way out on the left with what it
 * costs, the one verb, last, alone on the right.
 * It is drawn where its state lives, anywhere in the window's body (as the body's first child when the verb is known at
 * the top), and lands in the window's foot.
 */
export const HudWindowFoot = ({ note, children }: { note?: ReactNode; children?: ReactNode }) => {
  const foot = useContext(WindowFootContext);
  if (!foot) return null;
  return createPortal(
    <>
      <span className="ui-actions__note">{note}</span>
      {children}
    </>,
    foot,
  );
};

/**
 * A row of buttons outside a window (the combat forecast's): the way out and any other button on the left, the one
 * verb, last, alone on the right. `className` places it, never its look.
 */
export const HudActions = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("ui-actions", className)}>{children}</div>
);

/** A question that stops the task: what it does and costs, the way back, and the verb (red when it cannot be undone). */
export const HudConfirm = ({
  question,
  children,
  verb,
  back = "Cancel",
  tone,
  onConfirm,
  onBack,
}: {
  question: string;
  children?: ReactNode;
  verb: string;
  back?: string;
  tone?: "bad";
  /** The send; one that returns its promise holds the verb until it settles, as every HudButton does. */
  onConfirm: () => unknown;
  onBack: () => void;
}) => (
  <section className="ui ui-confirm" role="alertdialog" aria-label={question} data-tone={tone}>
    <div className="ui-confirm__body">
      <span className="ui-confirm__question">{question}</span>
      {children}
    </div>
    <footer className="ui-window__foot ui-actions">
      <HudButton kind="quiet" onClick={onBack}>
        {back}
      </HudButton>
      <HudButton kind={tone === "bad" ? "danger" : "primary"} onClick={onConfirm}>
        {verb}
      </HudButton>
    </footer>
  </section>
);

type MenuItem =
  | { kind: "rule" }
  | {
      kind?: "item";
      label: string;
      icon?: IconMeaning;
      /** A painting the item brings itself (a building's art), in the icon's place. */
      lead?: ReactNode;
      hint?: string;
      /** A choice of a select; an action leaves it out. */
      checked?: boolean;
      /** It opens a list of its own: a chevron at its end. */
      opens?: boolean;
      disabled?: boolean;
      tone?: "bad";
      state?: string;
      onSelect?: () => void;
    };

/**
 * A list of choices: the one a select opens (the chosen one checked), or the actions a right-click on your own
 * structure lists (its name and place at its head, a way back from a list it opened). A rule between groups. The map
 * has no menu of orders: a right-click on a tile acts.
 */
export const HudMenu = forwardRef<
  HTMLDivElement,
  {
    items: readonly MenuItem[];
    head?: { title: string; place?: string; onBack?: () => void };
  } & Omit<HTMLAttributes<HTMLDivElement>, "className" | "role" | "style">
>(({ items, head, ...rest }, ref) => (
  <div ref={ref} {...rest} className="ui ui-menu" role="menu" aria-label={rest["aria-label"] ?? head?.title}>
    {head && (
      <div className="ui-menu__head">
        {head.onBack && <HudIconButton icon="chevron-left" label="Back" kind="quiet" size="sm" onClick={head.onBack} />}
        <span className="ui-menu__title">{head.title}</span>
        {head.place && <span className="ui-menu__hint">{head.place}</span>}
      </div>
    )}
    {items.map((item, index) =>
      item.kind === "rule" ? (
        <span key={index} className="ui-menu__rule" role="separator" />
      ) : (
        <button
          key={index}
          type="button"
          role={item.checked === undefined ? "menuitem" : "menuitemradio"}
          className="ui-menu__item"
          aria-checked={item.checked}
          disabled={item.disabled}
          title={item.disabled ? item.hint : undefined}
          data-tone={item.tone}
          data-state={item.state}
          onClick={item.onSelect}
        >
          {item.lead ?? (item.icon && <Icon name={item.icon} size={16} />)}
          <span className="ui-menu__label">{item.label}</span>
          {item.hint && !item.disabled && <span className="ui-menu__hint">{item.hint}</span>}
          {item.opens && <Icon name="chevron-right" size={14} />}
        </button>
      ),
    )}
  </div>
));
HudMenu.displayName = "HudMenu";

const MENU_GAP_PX = 4;

/** Where an open select's list sits: under its trigger, or over it when the screen has no room below. */
const menuPlace = (trigger: HTMLElement, menu: HTMLElement | null) => {
  const rect = trigger.getBoundingClientRect();
  const height = menu?.offsetHeight ?? 0;
  const roomBelow = rect.bottom + MENU_GAP_PX + height <= window.innerHeight;
  return {
    left: rect.left,
    minWidth: rect.width,
    top: roomBelow ? rect.bottom + MENU_GAP_PX : Math.max(MENU_GAP_PX, rect.top - MENU_GAP_PX - height),
  };
};

/** The choices of an open list a key can reach: every item not disabled. */
const reachableItems = (menu: HTMLElement | null) =>
  menu ? [...menu.querySelectorAll<HTMLButtonElement>(".ui-menu__item:not(:disabled)")] : [];

/**
 * A choice opened from its trigger: what is chosen and the cue that it opens; its list under it, drawn over every surface
 * so no window clips it. Arrows move through the list, Enter chooses, Escape and a press outside close it.
 */
export const HudSelect = <K extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  tip,
  state,
}: {
  /** What is chosen, for assistive technology. */
  label: string;
  value: K;
  options: readonly { value: K; label: string; disabled?: boolean; hint?: string }[];
  onChange: (value: K) => void;
  disabled?: boolean;
  /** Its line on hover: what the choice does, or why it can't be changed. */
  tip?: string;
  /** The lab's forced state. */
  state?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<ReturnType<typeof menuPlace> | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const layerId = useId();
  const chosen = options.find((option) => option.value === value);

  const close = (refocus: boolean) => {
    setOpen(false);
    setPlace(null);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open || !trigger.current) return;
    setPlace(menuPlace(trigger.current, menu.current));
    const dismiss = () => {
      setOpen(false);
      setPlace(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) dismiss();
    };
    // The list sits where its trigger was; a scroll or a resize under it moves the trigger away, so it closes.
    const onScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) dismiss();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  // The list takes the keys once it is shown: hidden until placed, it can't hold focus before.
  const shown = open && place !== null;
  useEffect(() => {
    if (!shown) return;
    const items = reachableItems(menu.current);
    (items.find((item) => item.getAttribute("aria-checked") === "true") ?? items[0])?.focus({ preventScroll: true });
  }, [shown]);

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setOpen(true);
  };
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = reachableItems(menu.current);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus({ preventScroll: true });
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="ui-select"
        data-state={state}
        aria-label={label}
        data-tip={tip}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? layerId : undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onTriggerKey}
      >
        <span>{chosen?.label ?? ""}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open &&
        createPortal(
          <div id={layerId} className="ui-select__layer" data-placed={place !== null} style={place ?? undefined}>
            <HudMenu
              ref={menu}
              aria-label={label}
              onKeyDown={onMenuKey}
              items={options.map((option) => ({
                label: option.label,
                hint: option.hint,
                disabled: option.disabled,
                checked: option.value === value,
                onSelect: () => {
                  onChange(option.value);
                  close(true);
                },
              }))}
            />
          </div>,
          document.body,
        )}
    </>
  );
};

/** On or off, at once. */
export const HudSwitch = ({
  on,
  label,
  disabled,
  state,
  onChange,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  state?: string;
  onChange: (on: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    data-state={state}
    className="ui-switch"
    onClick={() => onChange(!on)}
  />
);

/** One of several things chosen together. */
export const HudCheck = ({
  checked,
  label,
  disabled,
  state,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  state?: string;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    data-state={state}
    className="ui-check"
    onClick={() => onChange(!checked)}
  >
    {checked && (
      <svg aria-hidden viewBox="0 0 12 12" width="12" height="12">
        <path d="M2.5 6.5l2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )}
  </button>
);

/** A setting: what it sets, its control at the end. */
export const HudSetting = ({ name, children }: { name: string; children: ReactNode }) => (
  <div className="ui-setting">
    <span className="ui-setting__name">{name}</span>
    {children}
  </div>
);

/**
 * One of the HUD's round actions: its painting in a disc, its word under it, a count to act on on its rim, in a tone
 * when it says more (good: ready to collect). It is a button: its label, tooltip and anchor pass through.
 */
export const HudBubble = ({
  icon,
  word,
  count,
  countTone,
  pressed,
  disabled,
  state,
  ...rest
}: {
  icon: IconMeaning;
  word: string;
  count?: number;
  countTone?: Tone;
  pressed?: boolean;
  disabled?: boolean;
  state?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) => (
  <button type="button" {...rest} className="ui-bubble" aria-pressed={pressed} disabled={disabled} data-state={state}>
    <span className="ui-bubble__disc">
      <Icon name={icon} size={26} />
      {count !== undefined && count > 0 && (
        <span className="ui-badge" data-tone={countTone}>
          {count}
        </span>
      )}
    </span>
    <span className="ui-bubble__word">{word}</span>
  </button>
);

/**
 * How full a thing is, in a tone; `filling` while it refills (stamina). Given as a `share` from 0 to 1 (production, a
 * load), it reads as a percentage; given as an `amount` (an army's stamina), it reads as that amount of its maximum,
 * so a reader of the meter gets the amount itself, as the phone's stamina segments give it (unknown reads as nothing).
 */
export const HudMeter = ({
  share,
  amount,
  tone,
  label,
  filling = false,
}: {
  tone?: Tone;
  label: string;
  filling?: boolean;
} & ({ share: number; amount?: never } | { amount: { current: number; max: number } | undefined; share?: never })) => {
  const exact = share === undefined;
  const fill = exact ? (amount && amount.max > 0 ? amount.current / amount.max : 0) : share;
  return (
    <span
      className="ui-meter block"
      data-filling={filling || undefined}
      role="meter"
      aria-label={label}
      aria-valuenow={exact ? amount?.current : Math.round(fill * 100)}
      aria-valuemin={0}
      aria-valuemax={exact ? amount?.max : 100}
      data-tone={tone}
    >
      <i style={{ width: `${Math.min(1, Math.max(0, fill)) * 100}%` }} />
    </span>
  );
};

/** What a relic works on: its chip takes that kind's colour. */
type RelicKind = "stamina" | "damage" | "damage-reduction" | "exploration" | "production";

/**
 * A relic: its painting, what it gives (its name, its bonus) in its kind's colour, then how long it still works or how
 * many are held, in a tone when time runs short; named in full on hover. Sized to read on screen (the owner, 18 October
 * 2026: "bigger so we can actually read it"). A held relic says whether it is working (`active`), can be set to work
 * now (`ready`, pulsing; with `onPress` the chip is the button that does it) or is only held (`held`).
 */
export const HudRelic = ({
  icon,
  kind,
  gives,
  trail,
  trailTone,
  title,
  state,
  onPress,
  label,
  tip,
}: {
  icon: IconMeaning;
  kind: RelicKind;
  gives: ReactNode;
  trail?: ReactNode;
  trailTone?: Tone;
  title?: string;
  state?: "active" | "ready" | "held";
  onPress?: () => void;
  /** The pressable chip's name for assistive technology ("Activate Stamina I"). */
  label?: string;
  /** The app's tooltip: what the relic does, and on a pressable chip what pressing it does and costs. */
  tip?: string;
}) => {
  const words = (
    <>
      <Icon name={icon} size={28} />
      <span className="ui-relic__gives">{gives}</span>
      {trail !== undefined && (
        <span className="ui-relic__trail" data-tone={trailTone}>
          {trail}
        </span>
      )}
    </>
  );
  return onPress ? (
    <button
      type="button"
      className="ui-relic"
      data-kind={kind}
      data-state={state}
      title={title}
      aria-label={label}
      data-tip={tip}
      onClick={onPress}
    >
      {words}
    </button>
  ) : (
    <span className="ui-relic" data-kind={kind} data-state={state} title={title} data-tip={tip}>
      {words}
    </span>
  );
};

/** An answer on its way: a spinner and what is awaited. */
export const HudLoading = ({ line }: { line: string }) => (
  <span className="ui-loading" role="status">
    <span className="ui-spinner" aria-hidden="true" />
    {line}
  </span>
);

/** Rows standing in for a list that is coming. */
export const HudSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <span className="flex flex-col gap-2" aria-hidden="true">
    {Array.from({ length: rows }, (_, index) => (
      <span key={index} className="ui-skeleton block" style={{ width: `${90 - index * 15}%` }} />
    ))}
  </span>
);

/** Nothing to show yet, said once, with the one thing that would fill it. */
export const HudEmpty = ({ icon, line, action }: { icon: IconMeaning; line: string; action?: ReactNode }) => (
  <div className="ui-empty">
    <Icon name={icon} size={28} />
    <span className="ui-empty__line">{line}</span>
    {action}
  </div>
);

/**
 * The HUD's top line: its readings in one rounded strip, a rule between them. With `onPress` the whole strip is one
 * button (the player's chip opens the standings). `label` names it for assistive technology, `className` places it
 * (never its look), and the rest are the strip's own attributes (a group's role, a title, whether what it opens is
 * open).
 */
export const HudPill = ({
  children,
  label,
  className,
  onPress,
  ...rest
}: {
  children: readonly ReactNode[];
  label?: string;
  className?: string;
  onPress?: () => void;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "onClick">) => {
  const readings = children.map((child, index) => (
    <span key={index} className="contents">
      {index > 0 && <span className="ui-pill__rule" aria-hidden="true" />}
      {child}
    </span>
  ));
  return onPress ? (
    <button {...rest} type="button" aria-label={label} className={cn("ui ui-pill", className)} onClick={onPress}>
      {readings}
    </button>
  ) : (
    <div {...rest} aria-label={label} className={cn("ui ui-pill", className)}>
      {readings}
    </div>
  );
};

/** A player's or an army's painting, centred in its disc: a painting, a player's own image, or their initial. */
export const HudPortrait = ({
  icon,
  src,
  initial,
  label,
}: {
  label: string;
} & (
  | { icon: IconMeaning; src?: never; initial?: never }
  | { src: string; icon?: never; initial?: never }
  | {
      initial: string;
      icon?: never;
      src?: never;
    }
)) => (
  <span className="ui-portrait" role="img" aria-label={label}>
    {icon && <Icon name={icon} size={30} />}
    {src && <img className="ui-portrait__image" src={src} alt="" />}
    {initial && <span className="ui-portrait__initial">{initial}</span>}
  </span>
);

/** The minimap's frame: a panel with no header, its map filling a well. */
export const HudMinimapFrame = ({
  loading = false,
  className,
  children,
}: {
  /** The map's tiles are still coming: the sheet's shimmer lies over the well. */
  loading?: boolean;
  /** Where the frame sits and how big it is, never its look. */
  className?: string;
  children: ReactNode;
}) => (
  <section className={cn("ui ui-panel ui-minimap", className)} aria-label="Minimap">
    <div className="ui-minimap__well">
      {children}
      {loading && <span className="ui-minimap__loading ui-skeleton" aria-hidden="true" />}
    </div>
  </section>
);
