import "./realm-panel.css";

import {
  aspectName,
  formatAmount,
  formatExact,
  formatShortDuration,
  LORDS,
  rankName,
  type AspectId,
} from "@bibliothecadao/types";
import { homeIcon, HOME_KINDS, type HomeKind } from "@/ui/design-system/home-icons";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudIconButton, HudPanel, HudRow, HudTier } from "@/ui/design-system/kit/hud-elements";
import { OrderLine, resolvedOrder } from "@/ui/design-system/kit/order-emblem";
import {
  ARMIES,
  CLOSE,
  DEPLOY,
  FULL,
  MAX_LEVEL,
  REALM,
  REALM_POP,
  RESEARCH,
  SHOW_MY_REALM,
  UPGRADE,
  type Rank,
} from "@/ui/design-system/kit/words";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import type { ReactNode } from "react";

import { FRONTIER_STORES } from "../stores";
import { ProgressRing } from "./progress-ring";
import { AspectMedallion } from "./realm-header-chip";
import { LandingDelta, STORE_TONES, storeCapacityShare, type StoreReading, storeLine } from "./status-strip";

export interface RealmBuildingItem {
  key: string;
  icon: IconMeaning;
  name: string;
  tier?: Rank;
  rankLabel?: string;
  rateIcon?: IconMeaning;
  rate?: string;
  onUpgrade?: () => void;
  maxed?: boolean;
}

export const RealmPanel = ({
  name,
  level,
  aspect,
  orderId,
  population,
  armies,
  stores,
  buildings,
  lords,
  linkWalletLine = null,
  lean = false,
  onHome,
  onUpgradeCastle,
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
  population?: { used: number; max: number };
  armies?: { active: number; limit: number };
  stores: StoreReading[];
  buildings?: readonly RealmBuildingItem[];
  lords?: number;
  linkWalletLine?: string | null;
  lean?: boolean;
  onHome?: () => void;
  onUpgradeCastle?: () => void;
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
  const order = resolvedOrder(orderId);
  const visibleStores = stores.filter(
    (store) =>
      store.kind === "labor" ||
      store.kind === "wheat" ||
      store.amount === undefined ||
      store.amount > 0 ||
      (store.perHour ?? 0) > 0,
  );
  const wonderLabel = kind === "wonder" ? HOME_KINDS[kind].label : undefined;
  const medallionTip = aspect !== undefined ? aspectName(aspect) : wonderLabel;
  const castleRank = level !== undefined ? rankName(level) : REALM;
  const lordsLabel =
    lords !== undefined ? [`${LORDS} ${formatExact(lords)}`, linkWalletLine].filter(Boolean).join(". ") : undefined;
  const leanTitle = (
    <span data-realm-castle className="inline-flex min-w-0 items-center gap-2.5">
      <SemanticIcon name={homeIcon(kind, level ?? 0)} size={30} />
      <span className="flex min-w-0 flex-col">
        <span className="realm-panel__castle">{castleRank}</span>
        {(population || lords !== undefined) && (
          <span className="realm-panel__meta">
            {population && <span>{REALM_POP(population.used, population.max)}</span>}
            {population && lords !== undefined && <span aria-hidden="true">·</span>}
            {lords !== undefined && (
              <LordsInline
                lords={lords}
                label={lordsLabel!}
                tip={linkWalletLine ?? LORDS}
                warn={Boolean(linkWalletLine)}
                onWithdraw={onWithdraw}
              />
            )}
          </span>
        )}
      </span>
    </span>
  );
  const fullTitle = (
    <span className="inline-flex min-w-0 items-center gap-3">
      <AspectMedallion
        aspect={aspect}
        fallbackIcon={homeIcon(kind, level ?? 0)}
        fallbackAlt={wonderLabel}
        tip={medallionTip}
        decorative={false}
        size="md"
      />
      <span className="flex min-w-0 flex-col">
        <span className="realm-panel__name">{name}</span>
        {(order || aspect !== undefined || level !== undefined) && (
          <span className="realm-panel__sub">
            {order && (
              <OrderLine
                orderId={order.orderId}
                size={15}
                className="inline-flex min-w-0 items-center gap-1.5 text-hud-label text-hud-muted"
              />
            )}
            {order && aspect !== undefined && <span className="text-hud-label text-hud-muted">·</span>}
            {aspect !== undefined && <span className="text-hud-label text-hud-ink">{aspectName(aspect)}</span>}
            {!order && aspect === undefined && level !== undefined && (
              <span className="text-hud-label text-hud-muted">{rankName(level)}</span>
            )}
          </span>
        )}
      </span>
    </span>
  );
  const panelCue = lean ? (
    <span className="inline-flex items-center gap-1.5">
      {onUpgradeCastle && (
        <HudButton kind="primary" size="sm" onClick={onUpgradeCastle}>
          {UPGRADE}
        </HudButton>
      )}
      {onClose && <HudIconButton icon="close" label={CLOSE} kind="secondary" size="sm" onClick={onClose} />}
    </span>
  ) : (
    onClose && <HudIconButton icon="close" label={CLOSE} kind="secondary" size="sm" onClick={onClose} />
  );
  return (
    <HudPanel
      label={REALM}
      title={lean ? leanTitle : fullTitle}
      cue={panelCue}
      onTitle={!lean && onHome ? { label: SHOW_MY_REALM, run: onHome } : undefined}
      collapsible={false}
      className={
        sheetHandle
          ? "pointer-events-auto relative realm-panel--sheet"
          : lean
            ? "pointer-events-auto realm-panel--lean"
            : "pointer-events-auto"
      }
      bodyClassName="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden"
    >
      {sheetHandle && <span className="frontier-phone-handle" aria-hidden="true" />}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
        {!lean && (
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
                <TileShell
                  label={`${ARMIES} ${formatExact(armies.active)} / ${formatExact(armies.limit)}`}
                  tip={ARMIES}
                >
                  <ProgressRing
                    size="lg"
                    share={armies.limit > 0 ? armies.active / armies.limit : undefined}
                    tone="calm"
                  >
                    <SemanticIcon name="knight-t1" size={20} />
                  </ProgressRing>
                  <span className="realm-tile__value tabular-nums">
                    {`${formatExact(armies.active)}/${formatExact(armies.limit)}`}
                  </span>
                </TileShell>
              </li>
            )}
            {lords !== undefined && (
              <li className="min-w-0">
                <TileShell label={lordsLabel!} tip={linkWalletLine ?? LORDS} onClick={onWithdraw}>
                  <ProgressRing
                    size="lg"
                    tone={linkWalletLine ? "amber" : "calm"}
                    badge={linkWalletLine ? <SemanticIcon name="warning" size={12} /> : undefined}
                  >
                    <SemanticIcon name="lords" size={20} />
                  </ProgressRing>
                  <span className="realm-tile__value tabular-nums">{formatAmount(lords)}</span>
                </TileShell>
              </li>
            )}
          </ul>
        )}
        {!lean && storeCards?.open && storeCards.card}
        {buildings && buildings.length > 0 && (
          <ul data-realm-buildings className="flex flex-col gap-1.5">
            {buildings.map((building) => (
              <li key={building.key} className="realm-building__row">
                <HudRow
                  lead={<SemanticIcon name={building.icon} size={32} />}
                  title={
                    <span className="flex items-center gap-1.5">
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
                    building.onUpgrade ? (
                      <HudButton kind="secondary" size="sm" onClick={building.onUpgrade}>
                        {UPGRADE}
                      </HudButton>
                    ) : building.maxed ? (
                      <span className="realm-building__max">{MAX_LEVEL}</span>
                    ) : undefined
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
            <HudButton kind="secondary" size="sm" icon="research" onClick={onResearch}>
              {RESEARCH}
            </HudButton>
          )}
          {onDeploy && (
            <HudButton kind="primary" size="sm" icon="knight-t1" onClick={onDeploy}>
              {DEPLOY}
            </HudButton>
          )}
        </div>
      )}
    </HudPanel>
  );
};

const LordsInline = ({
  lords,
  label,
  tip,
  warn,
  onWithdraw,
}: {
  lords: number;
  label: string;
  tip: string;
  warn: boolean;
  onWithdraw?: () => void;
}) => {
  const face = (
    <>
      {warn && <SemanticIcon name="warning" size={12} />}
      <span>{`${formatAmount(lords)} ${LORDS}`}</span>
    </>
  );
  return onWithdraw ? (
    <button
      type="button"
      className="realm-panel__lords"
      data-warn={warn || undefined}
      aria-label={label}
      data-tip={tip}
      onClick={onWithdraw}
    >
      {face}
    </button>
  ) : (
    <span role="img" className="realm-panel__lords" data-warn={warn || undefined} aria-label={label} data-tip={tip}>
      {face}
    </span>
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

const storeBadge = (store: StoreReading): string | undefined => {
  if (store.fullIn === 0) return FULL;
  if (store.fullIn !== undefined && store.fullIn > 0) return formatShortDuration(store.fullIn);
  return undefined;
};

const StoreTile = ({ store, onOpen }: { store: StoreReading; onOpen?: () => void }) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  const line = storeLine(store);
  const meta = FRONTIER_STORES[store.kind];
  const badge = storeBadge(store);
  return (
    <>
      <LandingDelta target={store.flyTarget} />
      <TileShell label={line} tip={line} onClick={onOpen}>
        <ProgressRing size="lg" share={storeCapacityShare(store)} tone={store.tone} badge={badge}>
          <SemanticIcon name={meta.icon} size={20} />
        </ProgressRing>
        <span className="realm-tile__value tabular-nums">
          <span data-fly-target={store.flyTarget} className={STORE_TONES[store.tone].text}>
            {shown === undefined ? "—" : <TickNumber value={shown} format={formatAmount} />}
          </span>
        </span>
      </TileShell>
    </>
  );
};
