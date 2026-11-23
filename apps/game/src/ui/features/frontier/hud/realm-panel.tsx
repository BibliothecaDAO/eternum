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
import { HudButton, HudPanel, HudRow, HudTier } from "@/ui/design-system/kit/hud-elements";
import {
  ARMY,
  DEPLOY,
  REALM,
  RESEARCH,
  SHOP_WORDS,
  SHOW_MY_REALM,
  UPGRADE,
  type Rank,
} from "@/ui/design-system/kit/words";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import type { ReactNode } from "react";

import { RankSteps } from "../realm/rank-steps";
import { FRONTIER_STORES } from "../stores";
import { LandingDelta, STORE_TONES, type StoreReading, storeLine } from "./status-strip";

export interface RealmBuildingItem {
  key: string;
  icon: IconMeaning;
  name: string;
  tier: Rank;
  rateIcon?: IconMeaning;
  rate?: string;
  onUpgrade?: () => void;
}

export const RealmPanel = ({
  name,
  level,
  highest,
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
  fragments,
  onShop,
  onResearch,
  onDeploy,
  kind = "realm",
}: {
  kind?: HomeKind;
  name: string;
  level: number | undefined;
  highest?: number;
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
  fragments?: number;
  onShop?: () => void;
  onResearch?: () => void;
  onDeploy?: () => void;
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
        <span className="inline-flex items-center gap-2">
          <SemanticIcon
            name={homeIcon(kind, level ?? 0)}
            size={24}
            alt={kind === "wonder" ? HOME_KINDS[kind].label : undefined}
            data-tip={kind === "wonder" ? HOME_KINDS[kind].label : undefined}
          />
          <span className="ui-realm-panel__name">{name}</span>
          {level !== undefined && highest !== undefined && <RankSteps level={level} highest={highest} kind={kind} />}
        </span>
      }
      onTitle={onHome && { label: SHOW_MY_REALM, run: onHome }}
      collapsible={false}
      className="pointer-events-auto"
      bodyClassName="flex flex-col gap-2.5"
    >
      <div className="ui-realm-panel__sub">
        {level !== undefined && <span className="text-hud-label text-hud-muted">{rankName(level)}</span>}
        {aspect && (
          <span className="inline-flex items-center gap-1 text-hud-label text-hud-ink">
            <AspectMark aspect={aspect} size={16} decorative />
            {aspectName(aspect)}
          </span>
        )}
        {order && (
          <span className="inline-flex items-center gap-1 text-hud-label text-hud-muted">
            <SemanticIcon name={orderMeaning(order.orderId)} size={16} />
            {order.orderName}
          </span>
        )}
      </div>
      <ul aria-label="Stores" className="ui-realm-tiles">
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
              className="ui-realm-tile"
              aria-label={`${ARMY} ${formatExact(armies.active)} / ${formatExact(armies.limit)}`}
            >
              <span className="ui-realm-tile__label">{ARMY}</span>
              <span className="ui-realm-tile__value tabular-nums">
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
              <span className="ui-realm-tile__label">
                {LORDS}
                {linkWalletLine && <SemanticIcon name="warning" size={12} />}
              </span>
              <span className="ui-realm-tile__value tabular-nums">
                <SemanticIcon name="lords" size={16} />
                {formatAmount(lords)}
              </span>
            </TileShell>
          </li>
        )}
        {fragments !== undefined && (
          <li data-store="fragments" className="min-w-0">
            <TileShell label={SHOP_WORDS.fragments(fragments)} tip={SHOP_WORDS.title} onClick={onShop}>
              <span className="ui-realm-tile__label">{SHOP_WORDS.title}</span>
              <span className="ui-realm-tile__value tabular-nums">
                <SemanticIcon name="fragment" size={16} />
                {formatAmount(fragments)}
              </span>
            </TileShell>
          </li>
        )}
      </ul>
      {storeCards?.open && storeCards.card}
      {buildings && buildings.length > 0 && (
        <ul data-realm-buildings className="flex flex-col gap-1.5">
          {buildings.map((building) => (
            <li key={building.key} className="rounded-md border border-hud-divider bg-hud-well">
              <HudRow
                lead={<SemanticIcon name={building.icon} size={32} />}
                title={
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-hud-strong text-hud-ink">{building.name}</span>
                    <HudTier tier={building.tier} />
                  </span>
                }
                detail={
                  building.rate && (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      {building.rateIcon && <SemanticIcon name={building.rateIcon} size={13} />}
                      {building.rate}
                    </span>
                  )
                }
                controls={
                  building.onUpgrade && (
                    <HudButton kind="secondary" size="sm" onClick={building.onUpgrade}>
                      {UPGRADE}
                    </HudButton>
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
      {(onResearch || onDeploy) && (
        <div className="ui-realm-foot">
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
    <button type="button" className="ui-realm-tile" aria-label={label} data-tip={tip} onClick={onClick}>
      {children}
    </button>
  ) : (
    <span role="img" className="ui-realm-tile" aria-label={label} data-tip={tip}>
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
        <span className="ui-realm-tile__label">{meta.word}</span>
        <span className="ui-realm-tile__value tabular-nums">
          <SemanticIcon name={meta.icon} size={16} />
          <span data-fly-target={store.flyTarget} className={STORE_TONES[store.tone].text}>
            {shown === undefined ? "—" : <TickNumber value={shown} format={formatAmount} />}
          </span>
        </span>
      </TileShell>
    </>
  );
};
