import "./unit-details-popover.css";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HOLD_MS, HOLD_SLOP_PX } from "@/ui/design-system/kit/named-tips";
import { useSystemBackCloses } from "@/ui/design-system/kit/sheet-closes";
import { CLOSE, TROOP_TRAIT_WORDS, UNIT_DETAILS_WORDS, type TroopFigures } from "@/ui/design-system/kit/words";
import { resolveFirstStrike, troopMark } from "@bibliothecadao/eternum";
import { buildingName, formatExact, type TroopType } from "@bibliothecadao/types";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";

import { type ArmyStaminaCosts, troopTraits } from "../deploy/troop-figures";
import { HudPopoverRoot } from "../hud/hud-popover";
import { CombatMarkBadge, combatMarkOf } from "../sites/combat-mark";
import { buildingForTroop } from "./troop-traits-card";

const POPOVER_GAP = 10;
const POPOVER_WIDTH = 304;
const POPOVER_ESTIMATED_HEIGHT = 240;
const VIEWPORT_MARGIN = 12;

export type UnitDetailsRole = keyof typeof UNIT_DETAILS_WORDS.role;

interface UnitDetailsRow {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}

export interface UnitDetailsSubject {
  role: UnitDetailsRole;
  name: string;
  art: IconMeaning;
  category: TroopType;
  strength?: number;
  figures?: TroopFigures;
  staminaCosts?: ArmyStaminaCosts;
  vsCategory?: TroopType;
}

type OpenState = { id: string; pinned: boolean } | null;

const useUnitDetailsStore = create<{ open: OpenState }>(() => ({ open: null }));

export const UnitDetailsTrigger = ({
  subject,
  openOnClick = true,
  className,
  children,
}: {
  subject: UnitDetailsSubject;
  openOnClick?: boolean;
  className?: string;
  children: ReactNode;
}) => {
  const root = useContext(HudPopoverRoot);
  const id = useId();
  const openState = useUnitDetailsStore((state) => state.open);
  const open = openState?.id === id;
  const pinned = open && openState.pinned;
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    touchOrigin.current = null;
  }, []);

  const close = useCallback(() => {
    useUnitDetailsStore.setState((state) => (state.open?.id === id ? { open: null } : state));
  }, [id]);

  const closeHover = useCallback(() => {
    useUnitDetailsStore.setState((state) => (state.open?.id === id && !state.open.pinned ? { open: null } : state));
  }, [id]);

  useEffect(() => {
    return () => {
      clearHold();
      useUnitDetailsStore.setState((state) => (state.open?.id === id ? { open: null } : state));
    };
  }, [clearHold, id]);

  useDismissOnOutsidePress(pinned, close, triggerRef, popoverRef);
  const position = usePopoverPosition(triggerRef, popoverRef, open, root.scale);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    clearHold();
    suppressClick.current = false;
    touchOrigin.current = { x: event.clientX, y: event.clientY };
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      suppressClick.current = true;
      useUnitDetailsStore.setState({ open: { id, pinned: true } });
    }, HOLD_MS);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!touchOrigin.current) return;
    const dx = event.clientX - touchOrigin.current.x;
    const dy = event.clientY - touchOrigin.current.y;
    if (Math.hypot(dx, dy) > HOLD_SLOP_PX) clearHold();
  };

  const onPointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    useUnitDetailsStore.setState((state) =>
      state.open?.id === id && state.open.pinned ? state : { open: { id, pinned: false } },
    );
  };

  const onPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    closeHover();
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const onClick = () => {
    if (!openOnClick) return;
    useUnitDetailsStore.setState((state) =>
      state.open?.id === id && state.open.pinned ? { open: null } : { open: { id, pinned: true } },
    );
  };

  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (touchOrigin.current !== null || suppressClick.current || open) event.preventDefault();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (openOnClick && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        data-own-overlay=""
        data-unit-details-trigger={subject.name}
        role={openOnClick ? "button" : undefined}
        tabIndex={openOnClick ? 0 : undefined}
        aria-label={openOnClick ? UNIT_DETAILS_WORDS.inspectLabel(subject.name) : undefined}
        aria-expanded={openOnClick ? open : undefined}
        aria-controls={open ? id : undefined}
        className={`unit-details-trigger ${openOnClick ? "unit-details-trigger--button" : ""} ${className ?? ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={clearHold}
        onPointerCancel={clearHold}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onClickCapture={onClickCapture}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
      {open &&
        createPortal(
          <UnitDetailsCard
            id={id}
            popoverRef={popoverRef}
            subject={subject}
            pinned={pinned}
            position={position}
            onClose={close}
          />,
          root.node ?? document.body,
        )}
    </>
  );
};

const PinnedBackClose = ({ onClose }: { onClose: () => void }) => {
  useSystemBackCloses(onClose);
  return null;
};

const UnitDetailsCard = ({
  id,
  popoverRef,
  subject,
  pinned,
  position,
  onClose,
}: {
  id: string;
  popoverRef: RefObject<HTMLDivElement>;
  subject: UnitDetailsSubject;
  pinned: boolean;
  position: { left: number; top: number; above: boolean } | null;
  onClose: () => void;
}) => {
  const markKey = troopMark(subject.category);
  const mark = combatMarkOf(subject.category);
  const traits = troopTraits(subject.category);
  const isEnemy = subject.role !== "player";
  const calloutHead = buildCalloutHead(subject, markKey, traits);
  const calloutSub = UNIT_DETAILS_WORDS.strikeRule[markKey];
  const rows = buildDetailRows(subject, traits);
  const style: CSSProperties | undefined = position
    ? {
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: position.above ? "translateY(-100%)" : undefined,
      }
    : undefined;

  return (
    <div
      ref={popoverRef}
      id={id}
      role={pinned ? "dialog" : "note"}
      aria-label={subject.name}
      tabIndex={pinned ? -1 : undefined}
      data-unit-details-popover=""
      data-pinned={pinned ? "" : undefined}
      className="ui unit-details-popover"
      style={style}
      onKeyDown={
        pinned
          ? (event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          : undefined
      }
    >
      {pinned && <PinnedBackClose onClose={onClose} />}
      <div className="unit-details-popover__head">
        <span className="unit-details-popover__portrait">
          <span className="unit-details-popover__portrait-frame">
            <Icon name={subject.art} size={44} className="size-full object-cover" />
          </span>
          <CombatMarkBadge category={subject.category} />
        </span>
        <span className="unit-details-popover__title-wrap">
          <span className="unit-details-popover__title">{subject.name}</span>
          <span className="unit-details-popover__role" data-tone={isEnemy ? "bad" : "good"}>
            {`${UNIT_DETAILS_WORDS.role[subject.role]} · ${mark.label}`}
          </span>
        </span>
        {pinned && (
          <button type="button" className="unit-details-popover__close" aria-label={CLOSE} onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      <div className="unit-details-popover__callout">
        <span className="unit-details-popover__callout-head">
          <Icon name={mark.icon} size={15} />
          <span>{calloutHead}</span>
        </span>
        <span className="unit-details-popover__callout-sub">{calloutSub}</span>
      </div>
      {rows.length > 0 && (
        <div className="unit-details-popover__rows">
          {rows.map((row) => (
            <div key={row.label} className="unit-details-popover__row">
              <span className="unit-details-popover__label">{row.label}</span>
              <span className="unit-details-popover__value" data-tone={row.tone}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function buildCalloutHead(
  subject: UnitDetailsSubject,
  markKey: ReturnType<typeof troopMark>,
  traits: ReturnType<typeof troopTraits>,
): string {
  const prefix =
    subject.role === "enemyGuard" ? UNIT_DETAILS_WORDS.classGuard(markKey) : UNIT_DETAILS_WORDS.classUnit(markKey);
  if (subject.role === "beast" || subject.role === "deepBeast") {
    return `${prefix} · ${UNIT_DETAILS_WORDS.beastHeadline[markKey]}`;
  }
  if (!subject.figures) return prefix;
  return `${prefix} · ${UNIT_DETAILS_WORDS.headline(traits, subject.figures)}`;
}

function buildDetailRows(subject: UnitDetailsSubject, traits: ReturnType<typeof troopTraits>): UnitDetailsRow[] {
  const rows: UnitDetailsRow[] = [];
  if (subject.strength !== undefined) {
    rows.push({ label: UNIT_DETAILS_WORDS.rows.strength, value: formatExact(subject.strength) });
  }
  if (subject.role === "player" && subject.figures) {
    rows.push({
      label: UNIT_DETAILS_WORDS.rows.damage,
      value: TROOP_TRAIT_WORDS.damageValue(traits, subject.figures),
      tone: traits.light ? "warn" : "good",
    });
    if (traits.guard) {
      rows.push({
        label: UNIT_DETAILS_WORDS.rows.guardDeep,
        value: TROOP_TRAIT_WORDS.guardValue(subject.figures),
        tone: "good",
      });
    }
    const revealStamina =
      subject.staminaCosts?.reveal ?? (traits.scout ? subject.figures.scoutReveal : subject.figures.baseReveal);
    const attackStamina = subject.staminaCosts?.attack ?? subject.figures.attackStamina;
    rows.push({
      label: UNIT_DETAILS_WORDS.rows.revealStamina,
      value: UNIT_DETAILS_WORDS.staminaPerTile(revealStamina),
      tone: revealStamina < subject.figures.baseReveal ? "good" : undefined,
    });
    rows.push({
      label: UNIT_DETAILS_WORDS.rows.attackStamina,
      value: UNIT_DETAILS_WORDS.staminaCost(attackStamina),
      tone: attackStamina < subject.figures.attackStamina ? "good" : undefined,
    });
    rows.push({
      label: UNIT_DETAILS_WORDS.rows.trainedAt,
      value: buildingName(buildingForTroop(subject.category), true),
    });
  } else {
    if (subject.role === "enemyGuard" && traits.guard && subject.figures) {
      rows.push({
        label: UNIT_DETAILS_WORDS.rows.guardDeep,
        value: TROOP_TRAIT_WORDS.guardValue(subject.figures),
        tone: "warn",
      });
    }
    if (subject.vsCategory !== undefined) {
      const strike = resolveFirstStrike(subject.vsCategory, subject.category);
      rows.push({
        label: UNIT_DETAILS_WORDS.rows.matchup,
        value:
          strike === "attacker"
            ? UNIT_DETAILS_WORDS.matchup.attacker
            : strike === "defender"
              ? UNIT_DETAILS_WORDS.matchup.defender
              : UNIT_DETAILS_WORDS.matchup.simultaneous,
        tone: strike === "attacker" ? "good" : strike === "defender" ? "warn" : undefined,
      });
    }
  }
  return rows;
}

function usePopoverPosition(
  trigger: RefObject<HTMLElement>,
  popover: RefObject<HTMLElement>,
  open: boolean,
  scale: number,
) {
  const [position, setPosition] = useState<{ left: number; top: number; above: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const update = () => {
      const triggerEl = trigger.current;
      if (!triggerEl) return;
      const rect = triggerEl.getBoundingClientRect();
      const vw = window.innerWidth || 1024;
      const vh = window.innerHeight || 768;
      const width = Math.min(POPOVER_WIDTH, vw - VIEWPORT_MARGIN * 2);
      const sheetRect = triggerEl.closest<HTMLElement>("[data-kit-sheet]")?.getBoundingClientRect();
      if (sheetRect) {
        const leftSpace = sheetRect.left - POPOVER_GAP - VIEWPORT_MARGIN;
        const rightSpace = vw - sheetRect.right - POPOVER_GAP - VIEWPORT_MARGIN;
        if (Math.max(leftSpace, rightSpace) >= width) {
          const left = leftSpace >= rightSpace ? sheetRect.left - POPOVER_GAP - width : sheetRect.right + POPOVER_GAP;
          const height = popover.current?.getBoundingClientRect().height || POPOVER_ESTIMATED_HEIGHT;
          const top = Math.max(VIEWPORT_MARGIN, Math.min(vh - height - VIEWPORT_MARGIN, rect.top));
          setPosition({ left: Math.round(left / scale), top: Math.round(top / scale), above: false });
          return;
        }
      }
      const center = rect.left + rect.width / 2;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(vw - width - VIEWPORT_MARGIN, center - width / 2));
      const above = rect.top > vh * 0.45;
      const top = above
        ? Math.max(VIEWPORT_MARGIN, rect.top - POPOVER_GAP)
        : Math.min(vh - VIEWPORT_MARGIN, rect.bottom + POPOVER_GAP);
      setPosition({ left: Math.round(left / scale), top: Math.round(top / scale), above });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, trigger, popover, scale]);
  return position;
}

function useDismissOnOutsidePress(
  open: boolean,
  close: () => void,
  trigger: RefObject<HTMLElement>,
  popover: RefObject<HTMLElement>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !popover.current?.contains(target)) close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close, trigger, popover]);
}
