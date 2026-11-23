import "./realm-panel.css";

import {
  aspectName,
  catalogOrder,
  formatAmount,
  formatExact,
  LORDS,
  rankName,
  type AspectId,
} from "@bibliothecadao/types";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { homeIcon, HOME_KINDS, type HomeKind } from "@/ui/design-system/home-icons";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudChip, HudIconButton, HudPanel, HudRow, HudTier } from "@/ui/design-system/kit/hud-elements";
import {
  ARMIES,
  CLOSE,
  DEPLOY,
  REALM,
  RESEARCH,
  SHOW_MY_REALM,
  UPGRADE,
  type Rank,
} from "@/ui/design-system/kit/words";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import type { ReactNode } from "react";

import { FRONTIER_STORES } from "../stores";
import { LandingDelta, STORE_TONES, type StoreReading, storeLine } from "./status-strip";

export interface RealmBuildingItem {
  key: string;
  icon: IconMeaning;
  name: string;
  tier?: Rank;
  rankLabel?: string;
  rateIcon?: IconMeaning;
  rate?: string;
  onUpgrade?: () => void;
}

export const RealmPanel = ({
  name,
  level,
  aspect,
  orderId,
  armies,
  stores,
  buildings,
  lords,
  linkWalletLine = null,
  onHome,
  storeCards,
  onWithdraw,
  onResearch,
  onDeploy,
  onClose,
  sheetHandle = false,
  kind = "realm",
}: {
  kind?: HomeKind;
  name: string;
  level: number | undefined;
  aspect?: AspectId;
  orderId?: number;
  armies?: { active: number; limit: number };
  stores: StoreReading[];
  buildings?: readonly RealmBuildingItem[];
  lords?: number;
  linkWalletLine?: string | null;
  onHome?: () => void;
  storeCards?: {
    kinds: readonly StoreReading["kind"][];
    open: StoreReading["kind"] | null;
    onToggle: (kind: StoreReading["kind"]) => void;
    card: ReactNode;
  };
  onWithdraw?: () => void;
  onResearch?: () => void;
  onDeploy?: () => void;
  onClose?: () => void;
  sheetHandle?: boolean;
}) => {
  const order = orderId && orderId > 0 ? catalogOrder(orderId) : undefined;
  const visibleStores = stores.filter(
    (store) =>
      store.kind === "labor" ||
      store.kind === "wheat" ||
      store.amount === undefined ||
      store.amount > 0 ||
      (store.perHour ?? 0) > 0,
  );
  return (
    <HudPanel
      label={REALM}
      title={
        <span className="inline-flex items-center gap-3">
          <SemanticIcon
            name={homeIcon(kind, level ?? 0)}
            size={40}
            alt={kind === "wonder" ? HOME_KINDS[kind].label : undefined}
            data-tip={kind === "wonder" ? HOME_KINDS[kind].label : undefined}
          />
          <span className="flex min-w-0 flex-col">
            <span className="realm-panel__name">{name}</span>
            {(aspect || order || (!aspect && level !== undefined)) && (
              <span className="realm-panel__sub">
                {!aspect && level !== undefined && (
                  <span className="text-hud-label text-hud-muted">{rankName(level)}</span>
                )}
                {aspect && (
                  <span className="inline-flex items-center gap-1 text-hud-label text-hud-ink">
                    <AspectMark aspect={aspect} size={14} decorative />
                    {aspectName(aspect)}
                  </span>
                )}
                {aspect && order && <span className="text-hud-label text-hud-muted">·</span>}
                {order && (
                  <span className="inline-flex items-center gap-1 text-hud-label text-hud-muted">
                    <SemanticIcon name={orderMeaning(order.orderId)} size={14} />
                    {order.orderName}
                  </span>
                )}
              </span>
            )}
          </span>
        </span>
      }
      cue={onClose && <HudIconButton icon="close" label={CLOSE} kind="secondary" size="sm" onClick={onClose} />}
      onTitle={onHome && { label: SHOW_MY_REALM, run: onHome }}
      collapsible={false}
      className={sheetHandle ? "pointer-events-auto relative realm-panel--sheet" : "pointer-events-auto"}
      bodyClassName="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
    >
      {sheetHandle && <span className="frontier-phone-handle" aria-hidden="true" />}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <ul aria-label="Stores" className="realm-tiles">
          {visibleStores.map((store) => (
            <li key={store.kind} data-store={store.kind} className="relative min-w-0">
              <StoreTile
                store={store}
                onOpen={storeCards?.kinds.includes(store.kind) ? () => storeCards.onToggle(store.kind) : undefined}
              />
            </li>
          ))}
          {armies && (
            <li className="min-w-0">
              <span
                className="realm-tile"
                aria-label={`${ARMIES} ${formatExact(armies.active)} / ${formatExact(armies.limit)}`}
              >
                <span className="realm-tile__label">{ARMIES}</span>
                <span className="realm-tile__value tabular-nums">
                  <SemanticIcon name="knight-t1" size={16} />
                  {`${formatExact(armies.active)} / ${formatExact(armies.limit)}`}
                </span>
              </span>
            </li>
          )}
          {lords !== undefined && (
            <li className="min-w-0">
              <TileShell
                label={[`${LORDS} ${formatExact(lords)}`, linkWalletLine].filter(Boolean).join(". ")}
                tip={linkWalletLine ?? LORDS}
                onClick={onWithdraw}
              >
                <span className="realm-tile__label">
                  {LORDS}
                  {linkWalletLine && <SemanticIcon name="warning" size={12} />}
                </span>
                <span className="realm-tile__value tabular-nums">
                  <SemanticIcon name="lords" size={16} />
                  {formatAmount(lords)}
                </span>
              </TileShell>
            </li>
          )}
        </ul>
        {storeCards?.open && storeCards.card}
        {buildings && buildings.length > 0 && (
          <ul data-realm-buildings className="flex flex-col gap-2">
            {buildings.map((building) => (
              <li key={building.key} className="realm-building__row">
                <HudRow
                  lead={<SemanticIcon name={building.icon} size={40} />}
                  title={
                    <span className="flex items-center gap-2">
                      <span className="realm-building__name truncate">{building.name}</span>
                      {building.tier !== undefined && <HudTier tier={building.tier} />}
                      {building.rankLabel && <HudChip>{building.rankLabel}</HudChip>}
                    </span>
                  }
                  detail={
                    building.rate && (
                      <span className="inline-flex items-center gap-1 text-hud-body tabular-nums">
                        {building.rateIcon && <SemanticIcon name={building.rateIcon} size={14} />}
                        {building.rate}
                      </span>
                    )
                  }
                  controls={
                    building.onUpgrade && (
                      <HudButton kind="secondary" onClick={building.onUpgrade}>
                        {UPGRADE}
                      </HudButton>
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {(onResearch || onDeploy) && (
        <div className="realm-foot shrink-0">
          {onResearch && (
            <HudButton kind="secondary" icon="research" onClick={onResearch}>
              {RESEARCH}
            </HudButton>
          )}
          {onDeploy && (
            <HudButton kind="primary" icon="knight-t1" onClick={onDeploy}>
              {DEPLOY}
            </HudButton>
          )}
        </div>
      )}
    </HudPanel>
  );
};

const TileShell = ({
  label,
  tip,
  onClick,
  children,
}: {
  label: string;
  tip?: string;
  onClick?: () => void;
  children: ReactNode;
}) =>
  onClick ? (
    <button type="button" className="realm-tile" aria-label={label} data-tip={tip} onClick={onClick}>
      {children}
    </button>
  ) : (
    <span role="img" className="realm-tile" aria-label={label} data-tip={tip}>
      {children}
    </span>
  );

const StoreTile = ({ store, onOpen }: { store: StoreReading; onOpen?: () => void }) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  const line = storeLine(store);
  const meta = FRONTIER_STORES[store.kind];
  return (
    <>
      <LandingDelta target={store.flyTarget} />
      <TileShell label={line} tip={line} onClick={onOpen}>
        <span className="realm-tile__label">{meta.word}</span>
        <span className="realm-tile__value tabular-nums">
          <SemanticIcon name={meta.icon} size={16} />
          <span data-fly-target={store.flyTarget} className={STORE_TONES[store.tone].text}>
            {shown === undefined ? "—" : <TickNumber value={shown} format={formatAmount} />}
          </span>
        </span>
      </TileShell>
    </>
  );
};
