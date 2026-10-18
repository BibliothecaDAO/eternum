import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import {
  type ButtonHTMLAttributes,
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import "./hud-sheet.css";

/**
 * The HUD's elements: everything the game draws over the map, each built only from the HUD scope of the token file
 * (src/tokens.ts: HUD_TYPE, HUD_SHEET, HUD_MODES) by its classes (hud-sheet.css). A screen takes these and gives them
 * words and values, never a look of its own. /lab/kit shows each in every state, age and device.
 */

type ButtonKind = "primary" | "secondary" | "quiet";
type Tone = "good" | "bad" | "warn";

/** A button: primary is a screen's one verb, secondary sits beside it, quiet is a way out. */
export const HudButton = forwardRef<
  HTMLButtonElement,
  {
    kind: ButtonKind;
    size?: "md" | "sm";
    icon?: IconMeaning;
    children?: ReactNode;
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ kind, size = "md", icon, children, ...rest }, ref) => (
  <button ref={ref} type="button" {...rest} className="ui-button" data-kind={kind} data-size={size}>
    {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
    {children}
  </button>
));
HudButton.displayName = "HudButton";

/** A button that is only its painting, named for assistive technology and the app's tooltip. */
export const HudIconButton = forwardRef<
  HTMLButtonElement,
  { icon: IconMeaning; label: string; kind?: ButtonKind } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ icon, label, kind = "secondary", ...rest }, ref) => (
  <button ref={ref} type="button" aria-label={label} {...rest} className="ui-button" data-kind={kind} data-icon-only>
    <Icon name={icon} size={20} />
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

/** The HUD's one panel (the InfoBubble look): a header band naming it, a cue at its end, then its body. */
export const HudPanel = ({
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

/** A strip of choices; the chosen one in the age's accent. */
export const HudTabs = <K extends string>({
  tabs,
  value,
  onChange,
  states = {},
}: {
  /** Each tab; `title` is its hover text, what the tab holds in full. */
  tabs: readonly { key: K; label: string; count?: number; disabled?: boolean; title?: string }[];
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
        title={tab.title}
        data-state={states[tab.key]}
        onClick={() => onChange(tab.key)}
      >
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
  selected = false,
  state,
  disabled,
  onClick,
}: {
  lead?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  selected?: boolean;
  state?: string;
  disabled?: boolean;
  onClick?: () => void;
}) => {
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
 * the list row's hover and the chosen one's bar. It is a button, so Enter and Space choose it.
 */
export const HudTableRow = ({
  cols,
  colsWide,
  label,
  selected = false,
  state,
  onClick,
  children,
}: {
  cols: string;
  colsWide?: string;
  label: string;
  selected?: boolean;
  state?: string;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    className="ui-table-row"
    aria-label={label}
    aria-current={selected || undefined}
    data-state={state}
    style={{ "--cols": cols, "--cols-wide": colsWide ?? cols } as React.CSSProperties}
    onClick={onClick}
  >
    {children}
  </button>
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
type WindowSize = "task" | "page" | "workspace";

/**
 * A panel the size of a task: its title bar with a way out (dragging the bar moves the window), its body, which scrolls
 * within the window's height, and its foot: what it costs on the left, the way out and the one verb on the right, the
 * verb last.
 */
export const HudWindow = ({
  title,
  icon,
  size,
  onClose,
  note,
  actions,
  children,
}: {
  title: string;
  icon?: IconMeaning;
  size?: WindowSize;
  onClose: () => void;
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <section className="ui ui-window" role="dialog" aria-label={title} data-size={size}>
    <header className="ui-window__bar" data-popover-drag-handle>
      {icon && <Icon name={icon} size={22} />}
      <span>{title}</span>
      <HudIconButton icon="close" label="Close" kind="quiet" onClick={onClose} />
    </header>
    <div className="ui-window__body">{children}</div>
    {(note !== undefined || actions !== undefined) && (
      <footer className="ui-window__foot">
        <span className="ui-window__note">{note}</span>
        {actions}
      </footer>
    )}
  </section>
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
      hint?: string;
      checked?: boolean;
      disabled?: boolean;
      tone?: "bad";
      state?: string;
      onSelect?: () => void;
    };

/** The list a select opens: each choice, the chosen one checked, a rule between groups. The map has no menu: a right-click acts. */
export const HudMenu = forwardRef<
  HTMLDivElement,
  { items: readonly MenuItem[] } & Omit<HTMLAttributes<HTMLDivElement>, "className" | "role" | "style">
>(({ items, ...rest }, ref) => (
  <div ref={ref} {...rest} className="ui ui-menu" role="menu">
    {items.map((item, index) =>
      item.kind === "rule" ? (
        <span key={index} className="ui-menu__rule" role="separator" />
      ) : (
        <button
          key={index}
          type="button"
          role="menuitemradio"
          className="ui-menu__item"
          aria-checked={item.checked ?? false}
          disabled={item.disabled}
          data-tone={item.tone}
          data-state={item.state}
          onClick={item.onSelect}
        >
          {item.icon && <Icon name={item.icon} size={16} />}
          {item.label}
          {item.hint && <span className="ui-menu__hint">{item.hint}</span>}
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

/** The HUD's top line: its readings in one rounded strip, a rule between them. */
export const HudPill = ({ children }: { children: readonly ReactNode[] }) => (
  <div className="ui ui-pill">
    {children.map((child, index) => (
      <span key={index} className="contents">
        {index > 0 && <span className="ui-pill__rule" aria-hidden="true" />}
        {child}
      </span>
    ))}
  </div>
);

/** A player's or an army's painting, centred in its disc. */
export const HudPortrait = ({ icon, label }: { icon: IconMeaning; label: string }) => (
  <span className="ui-portrait" role="img" aria-label={label}>
    <Icon name={icon} size={30} />
  </span>
);

/** The minimap's frame: a panel with no header, its map in a well. */
export const HudMinimapFrame = ({ children }: { children: ReactNode }) => (
  <section className="ui ui-panel ui-minimap" aria-label="Minimap">
    <div className="ui-minimap__well">{children}</div>
  </section>
);
