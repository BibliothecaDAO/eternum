import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import {
  type ButtonHTMLAttributes,
  createContext,
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * The HUD's elements: everything the game draws over the map, each built only from the HUD scope of the token file
 * (src/tokens.ts: HUD_TYPE, HUD_SHEET, HUD_MODES) by its classes (hud-sheet.css). A screen takes these and gives them
 * words and values, never a look of its own. /lab/kit shows each in every state, age and device.
 */

type ButtonKind = "primary" | "secondary" | "quiet";
type Tone = "good" | "bad" | "warn";

/** A button: primary is a screen's one verb, secondary sits beside it, quiet is a way out. */
/** A price a button pays: its painting (or, with none, its word, as XP) and how much; named whole for assistive technology. */
export type HudPrice = { icon?: IconMeaning; word: string; amount: string };

export const HudButton = forwardRef<
  HTMLButtonElement,
  {
    kind: ButtonKind;
    size?: "md" | "sm";
    icon?: IconMeaning;
    /** Its order is on its way: this word in place of its own, and no second press. */
    busy?: string;
    /** A secondary or quiet button that loses something (Delete army): its words and line in the bad tone. A primary
     *  stays gold in every age. */
    tone?: "bad";
    /** What pressing it pays, after its word (Move: stamina and wheat). */
    prices?: readonly HudPrice[];
    children?: ReactNode;
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ kind, size = "md", icon, busy, tone, prices = [], children, disabled, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    {...rest}
    disabled={disabled || busy !== undefined}
    aria-busy={busy !== undefined || undefined}
    className="ui-button"
    data-kind={kind}
    data-size={size}
    data-tone={kind === "primary" ? undefined : tone}
  >
    {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
    {busy ?? children}
    {busy === undefined &&
      prices.map((price) => (
        <span key={price.word} className="ui-button__price" role="img" aria-label={`${price.amount} ${price.word}`}>
          {price.icon ? <Icon name={price.icon} size={18} /> : <span>{price.word}</span>}
          <span>{price.amount}</span>
        </span>
      ))}
  </button>
));
HudButton.displayName = "HudButton";

/** A button that is only its painting, named for assistive technology and the app's tooltip. */
export const HudIconButton = forwardRef<
  HTMLButtonElement,
  {
    icon: IconMeaning;
    label: string;
    kind?: ButtonKind;
    size?: "md" | "sm";
    /** As HudButton's: the bad tone on a secondary or quiet button. */
    tone?: "bad";
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ icon, label, kind = "secondary", size = "md", tone, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={label}
    {...rest}
    className="ui-button"
    data-kind={kind}
    data-size={size}
    data-tone={kind === "primary" ? undefined : tone}
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

const formatAmount = (amount: number) => Math.round(amount).toLocaleString("en-US");

/** What one press of the quick button adds. */
const QUICK_ADD = 500;

/**
 * How many troops go, for a quick deploy (the owner's rounds 3 and 4): the count typed with +500 per press and Max
 * right beside it, then out of how many can ("that fit" when the army's room runs out first).
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
      <label className="ui-field">
        <span className="sr-only">{name}</span>
        <input
          inputMode="numeric"
          value={formatAmount(value)}
          disabled={disabled}
          onChange={(event) => onChange(Math.min(most, Number(event.target.value.replace(/\D/g, "")) || 0))}
        />
      </label>
      <HudButton kind="secondary" disabled={full} onClick={() => onChange(Math.min(value + QUICK_ADD, most))}>
        +{QUICK_ADD}
      </HudButton>
      <HudButton kind="secondary" disabled={full} onClick={() => onChange(most)}>
        Max
      </HudButton>
      <span className="ui-amount__of">
        of {formatAmount(most)}
        {held > most && " that fit"}
      </span>
    </div>
  );
};

/** The shares a transfer row's quick steps take of what is held. */
const TRANSFER_STEPS = [0.25, 0.5, 0.75, 1] as const;

/**
 * What a transfer moves: one row per resource, its painting and name, what is held, a slider, quick steps taking a share
 * of what is held, and the amount typed.
 */
export const HudTransfer = ({
  rows,
  onChange,
}: {
  rows: readonly { icon: IconMeaning; name: string; held: number; value: number; state?: string }[];
  onChange: (index: number, amount: number) => void;
}) => (
  <div className="ui-transfer">
    {rows.map((row, index) => (
      <div key={row.name} className="ui-transfer__row" data-state={row.state}>
        <span className="ui-transfer__what">
          <Icon name={row.icon} size={24} />
          <span className="flex flex-col">
            <span>{row.name}</span>
            <span className="ui-transfer__held">{formatAmount(row.held)} held</span>
          </span>
        </span>
        <span className="ui-slider">
          <input
            type="range"
            aria-label={row.name}
            min={0}
            max={row.held}
            value={row.value}
            style={{ "--fill": `${row.held > 0 ? (row.value / row.held) * 100 : 0}%` } as React.CSSProperties}
            onChange={(event) => onChange(index, Number(event.target.value))}
          />
        </span>
        <span className="ui-transfer__steps">
          {TRANSFER_STEPS.map((step) => (
            <HudButton
              key={step}
              kind="secondary"
              size="sm"
              disabled={row.held === 0}
              aria-pressed={row.held > 0 && row.value === Math.round(row.held * step)}
              onClick={() => onChange(index, Math.round(row.held * step))}
            >
              {step === 1 ? "Max" : `${step * 100}%`}
            </HudButton>
          ))}
        </span>
        <label className="ui-field">
          <span className="sr-only">{row.name}</span>
          <input
            inputMode="numeric"
            value={formatAmount(row.value)}
            onChange={(event) =>
              onChange(index, Math.min(row.held, Number(event.target.value.replace(/\D/g, "")) || 0))
            }
          />
        </label>
      </div>
    ))}
  </div>
);

/**
 * The app's one tooltip: a line, and when the thing cannot be done, why and when it can; how to do it as a cue. The map's
 * order line is one ("Deploy an army here" / "Right-click").
 */
export const HudTip = ({ line, why, how }: { line: string; why?: string; how?: string }) => (
  <span className="ui-tip" role="tooltip">
    <span className="ui-tip__line">{line}</span>
    {why && <span className="ui-tip__why">{why}</span>}
    {how && <span className="ui-tip__how">{how}</span>}
  </span>
);

/**
 * The HUD's one panel: a header band naming it (its icon, its title, a cue at its end) over a divider, then its body.
 * With a `label` it is a named section for assistive technology (a landmark). Its chevron and title fold its body away
 * unless `collapsible` is off; the cue's own controls never fold it. A `section` is a part of a panel: the same header
 * and body on the panel's surface, and a `divided` body stacks such sections with a divider between each.
 * `className` and `bodyClassName` place the panel and lay out its body (flex, overflow, a height, no padding), never
 * its look.
 */
export const HudPanel = ({
  title,
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
  const folded = collapsible && collapsed;
  const Root = label ? "section" : "div";
  return (
    <Root aria-label={label} className={cn(kind === "panel" ? "ui ui-panel" : "ui-section", "shrink-0", className)}>
      {title !== undefined && (
        <PanelHead
          title={title}
          icon={icon}
          cue={cue}
          fold={collapsible ? { folded, toggle: () => setCollapsed((value) => !value) } : null}
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

/** A panel's header band: its name (a fold toggle when the panel folds) and its cue. */
const PanelHead = ({
  title,
  icon,
  cue,
  fold,
}: {
  title: ReactNode;
  icon?: IconMeaning;
  cue?: ReactNode;
  fold: { folded: boolean; toggle: () => void } | null;
}) => {
  const name = (
    <>
      {fold && <Icon name="chevron-down" className="ui-panel__chevron" data-folded={fold.folded} />}
      {icon && <Icon name={icon} className="ui-panel__icon" />}
      <span className="ui-panel__title">{title}</span>
    </>
  );
  return (
    <header className="ui-panel__head">
      {fold ? (
        <button type="button" className="ui-panel__name" aria-expanded={!fold.folded} onClick={fold.toggle}>
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
   * no word, named then by `ariaLabel`.
   */
  tabs: readonly {
    key: K;
    label?: string;
    icon?: IconMeaning;
    ariaLabel?: string;
    count?: number;
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
        onClick={() => onChange(tab.key)}
      >
        {tab.icon && <Icon name={tab.icon} size={22} />}
        {tab.label}
        {tab.count !== undefined && <HudChip>{tab.count}</HudChip>}
      </button>
    ))}
  </div>
);

/** A small tag: a count in the age's accent, or a state in its tone. */
export const HudChip = ({ tone, children }: { tone?: Tone; children: ReactNode }) => (
  <span className="ui-chip" data-tone={tone}>
    {children}
  </span>
);

/** A troop tier: T1 blue, T2 green, T3 purple. */
export const HudTierChip = ({ tier }: { tier: 1 | 2 | 3 }) => (
  <span className="ui-chip" data-tier={tier}>
    T{tier}
  </span>
);

/**
 * A painting in a round well with its numbers on the rim, all in one badge: buildings top left, the time left top
 * right, the amount on the foot; how far production has come as an arc, its rim in its state's tone (producing good,
 * idle warn). Two sizes, its painting fitted to each: sm in lists, md in cards and panels. `tip` is its hover (the
 * resource's name), `label` all it says for assistive technology. With `onClick` it is a button.
 */
export const HudRing = ({
  icon,
  label,
  tip,
  size = "md",
  state,
  corner,
  timer,
  foot,
  progress,
  onClick,
}: {
  icon: IconMeaning;
  label: string;
  tip?: string;
  size?: "sm" | "md";
  state?: "producing" | "idle";
  corner?: ReactNode;
  timer?: ReactNode;
  foot?: ReactNode;
  progress?: number;
  onClick?: () => void;
}) => {
  const body = (
    <>
      {progress !== undefined && (
        <span
          className="ui-ring__arc"
          style={{ "--ring-arc": `${Math.round(Math.min(1, Math.max(0, progress)) * 360)}deg` } as React.CSSProperties}
        />
      )}
      <span className="ui-ring__face">
        <Icon name={icon} size={size === "sm" ? 24 : 32} />
      </span>
      {corner !== undefined && (
        <span className="ui-ring__badge" data-at="corner">
          {corner}
        </span>
      )}
      {timer !== undefined && (
        <span className="ui-ring__badge" data-at="timer">
          {timer}
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
      data-size={size}
      data-production={state}
      data-tip={tip}
      aria-label={label}
      onClick={onClick}
    >
      {body}
    </button>
  ) : (
    <span className="ui-ring" data-size={size} data-production={state} data-tip={tip} role="img" aria-label={label}>
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
  title,
  detail,
  trail,
  selected = false,
  state,
  disabled,
  onClick,
}: {
  lead?: ReactNode;
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
  onClick?: () => void;
}) => {
  if (trail !== undefined) {
    return (
      <div className="ui-row" aria-selected={selected} aria-disabled={disabled} data-state={state}>
        {lead}
        {onClick ? (
          <button
            type="button"
            className="ui-row__choose"
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
      role="option"
      aria-selected={selected}
      data-state={state}
      disabled={disabled}
      onClick={onClick}
    >
      {words}
    </button>
  ) : (
    <div className="ui-row" role="option" aria-selected={selected} aria-disabled={disabled} data-state={state}>
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
    <div className="ui-card" data-selected={selected || undefined} data-disabled={disabled || undefined}>
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

/** What happened, said once: its time, a mark in its tone, the words (a name or a gain in the accent). */
export const HudEventRow = ({ time, tone, children }: { time: string; tone?: Tone; children: ReactNode }) => (
  <div className="ui-event" data-tone={tone}>
    <span className="ui-event__time">{time}</span>
    <span className="ui-event__mark" aria-hidden="true" />
    <span className="ui-event__text">{children}</span>
  </div>
);

/** A line the game says about the screen it sits in: a refusal, a warning, a success, and why. */
export const HudNotice = ({ tone, line, why }: { tone?: Tone; line: string; why?: string }) => (
  <div className="ui-notice" data-tone={tone} role={tone === "bad" ? "alert" : "status"}>
    <span className="flex flex-col">
      <span>{line}</span>
      {why && <span className="ui-notice__why">{why}</span>}
    </span>
  </div>
);

/**
 * How big a window is, by what it holds: one task (a name, a relic, a confirmation), a page to read (the Lordpedia), or a
 * workspace (Build, Production, Transfer, the market) that fills the desk on desktop and the sheet on a phone.
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
      <footer ref={setFoot} className="ui-window__foot" />
    </section>
  );
};

/**
 * The one way to fill a window's foot: what it costs on the left, then the way out and the one verb, the verb last.
 * It is drawn where its state lives, anywhere in the window's body (as the body's first child when the verb is known at
 * the top), and lands in the window's foot.
 */
export const HudWindowFoot = ({ note, children }: { note?: ReactNode; children?: ReactNode }) => {
  const foot = useContext(WindowFootContext);
  if (!foot) return null;
  return createPortal(
    <>
      <span className="ui-window__note">{note}</span>
      {children}
    </>,
    foot,
  );
};

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
  onConfirm: () => void;
  onBack: () => void;
}) => (
  <section className="ui ui-confirm" role="alertdialog" aria-label={question} data-tone={tone}>
    <div className="ui-confirm__body">
      <span className="ui-confirm__question">{question}</span>
      {children}
    </div>
    <footer className="ui-window__foot">
      <span className="ui-window__note" />
      <HudButton kind="quiet" onClick={onBack}>
        {back}
      </HudButton>
      <HudButton kind="primary" onClick={onConfirm}>
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
  state,
}: {
  /** What is chosen, for assistive technology. */
  label: string;
  value: K;
  options: readonly { value: K; label: string; disabled?: boolean; hint?: string }[];
  onChange: (value: K) => void;
  disabled?: boolean;
  /** The lab's forced state. */
  state?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<ReturnType<typeof menuPlace> | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const chosen = options.find((option) => option.value === value);

  const close = (refocus: boolean) => {
    setOpen(false);
    setPlace(null);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open || !trigger.current) return;
    setPlace(menuPlace(trigger.current, menu.current));
    const items = reachableItems(menu.current);
    (items.find((item) => item.getAttribute("aria-checked") === "true") ?? items[0])?.focus({ preventScroll: true });
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
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onTriggerKey}
      >
        <span>{chosen?.label ?? ""}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open &&
        createPortal(
          <div className="ui-select__layer" data-placed={place !== null} style={place ?? undefined}>
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

/** A setting: what it sets and what that does, its control at the end. */
export const HudSetting = ({ name, about, children }: { name: string; about?: string; children: ReactNode }) => (
  <div className="ui-setting">
    <span className="ui-setting__words">
      <span className="ui-setting__name">{name}</span>
      {about && <span className="ui-setting__about">{about}</span>}
    </span>
    {children}
  </div>
);

/** One of the HUD's round actions: its painting in a disc, its word under it, a count to act on on its rim. */
export const HudBubble = ({
  icon,
  word,
  count,
  pressed,
  disabled,
  state,
}: {
  icon: IconMeaning;
  word: string;
  count?: number;
  pressed?: boolean;
  disabled?: boolean;
  state?: string;
}) => (
  <button type="button" className="ui-bubble" aria-pressed={pressed} disabled={disabled} data-state={state}>
    <span className="ui-bubble__disc">
      <Icon name={icon} size={26} />
      {count !== undefined && count > 0 && <span className="ui-badge">{count}</span>}
    </span>
    {word}
  </button>
);

/** How full a thing is (stamina, production, a load), from 0 to 1, in a tone; `filling` while it refills (stamina). */
export const HudMeter = ({
  share,
  tone,
  label,
  filling = false,
}: {
  share: number;
  tone?: Tone;
  label: string;
  filling?: boolean;
}) => (
  <span
    className="ui-meter block"
    data-filling={filling || undefined}
    role="meter"
    aria-label={label}
    aria-valuenow={Math.round(share * 100)}
    aria-valuemin={0}
    aria-valuemax={100}
    data-tone={tone}
  >
    <i style={{ width: `${Math.min(1, Math.max(0, share)) * 100}%` }} />
  </span>
);

/** What a relic works on: its chip takes that kind's colour. */
export type RelicKind = "stamina" | "damage" | "damage-reduction" | "exploration" | "production";

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
