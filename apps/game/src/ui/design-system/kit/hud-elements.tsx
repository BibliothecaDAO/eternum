import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import "./hud-sheet.css";

/**
 * The HUD's elements: everything the game draws over the map, each built only from the HUD scope of the token file
 * (src/tokens.ts: HUD_TYPE, HUD_SHEET, HUD_MODES) by its classes (hud-sheet.css). A screen takes these and gives them
 * words and values, never a look of its own. /lab/kit shows each in every state, age and device.
 */

type ButtonKind = "primary" | "secondary" | "quiet";
type Tone = "good" | "bad" | "warn";

/** A button: primary is a screen's one verb, secondary sits beside it, quiet is a way out. */
export const HudButton = ({
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
export const HudIconButton = ({
  icon,
  label,
  kind = "secondary",
  ...rest
}: { icon: IconMeaning; label: string; kind?: ButtonKind } & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" aria-label={label} {...rest} className="ui-button" data-kind={kind} data-icon-only>
    <Icon name={icon} size={20} />
  </button>
);

/** What is typed (a name, a search), in a well. */
export const HudField = ({
  value,
  placeholder,
  icon,
  state,
  disabled = false,
  onChange,
}: {
  value: string;
  placeholder?: string;
  icon?: IconMeaning;
  state?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) => (
  <label className="ui-field" data-state={state}>
    {icon && <Icon name={icon} size={16} />}
    <input
      className="!w-48"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

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

/** One thing of a list: what it is and what it says; hover lights it, the chosen one carries a bar in the accent. */
export const HudRow = ({
  lead,
  title,
  detail,
  selected = false,
  state,
}: {
  lead?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  selected?: boolean;
  state?: string;
}) => (
  <div className="ui-row" role="option" aria-selected={selected} data-state={state}>
    {lead}
    <span className="flex min-w-0 flex-col">
      <span className="ui-row__title">{title}</span>
      {detail !== undefined && <span className="ui-row__detail">{detail}</span>}
    </span>
  </div>
);

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

/** A table's header: its column names on the same grid as its rows. */
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
 * A panel the size of a task: its title bar with a way out, its body, and its foot: what it costs on the left, the way
 * out and the one verb on the right, the verb last.
 */
export const HudWindow = ({
  title,
  icon,
  onClose,
  note,
  actions,
  children,
}: {
  title: string;
  icon?: IconMeaning;
  onClose: () => void;
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <section className="ui ui-window" role="dialog" aria-label={title}>
    <header className="ui-window__bar">
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

/** A choice's trigger: what is chosen, and the cue that it opens. */
export const HudSelect = ({ value, state, onClick }: { value: string; state?: string; onClick?: () => void }) => (
  <button type="button" className="ui-select" data-state={state} aria-haspopup="listbox" onClick={onClick}>
    <span>{value}</span>
    <Icon name="chevron-down" size={16} />
  </button>
);

/** The list a select opens: each choice, the chosen one checked, a rule between groups. The map has no menu: a right-click acts. */
export const HudMenu = ({
  items,
}: {
  items: readonly (
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
      }
  )[];
}) => (
  <div className="ui ui-menu" role="menu">
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
        >
          {item.icon && <Icon name={item.icon} size={16} />}
          {item.label}
          {item.hint && <span className="ui-menu__hint">{item.hint}</span>}
        </button>
      ),
    )}
  </div>
);

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

/** How full a thing is (stamina, production, a load), from 0 to 1, in a tone. */
export const HudMeter = ({ share, tone, label }: { share: number; tone?: Tone; label: string }) => (
  <span
    className="ui-meter block"
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
