import "./supply-post-sheet.css";

import type { ReactNode } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { Icon } from "@/ui/design-system/icon";
import { HudChip, HudPortrait, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { SUPPLY_POST, TROOPS } from "@/ui/design-system/kit/words";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import {
  configManager,
  isSupplyPost,
  readExpeditionRules,
  siteDisplayName,
  type ExpeditionRules,
} from "@bibliothecadao/eternum";
import { formatExact, formatShort, frontierTroopName } from "@bibliothecadao/types";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { SupplyPostEnds, useReinforceRange } from "../army/reinforce";
import { reinforcementSource } from "../army/reinforce-plan";
import { useRealmStores } from "../realm-stores";
import { FRONTIER_STORES, isTroopStore, STORE_KINDS } from "../stores";
import { TARGET_MARKS } from "./site-marks";

const TROOP_STORES = STORE_KINDS.filter(isTroopStore);

export function SupplyPostSheet({
  site,
  children,
  onClose,
}: {
  site: NativeRows["ExpeditionSite"];
  children: ReactNode;
  onClose: () => void;
}) {
  const { setup, account } = useGame();
  const now = useCurrentDefaultTick();
  useNativeRevision(["ExpeditionSite", "TileOccupancy", "Structure"]);
  const ordersAllowed = useUIStore(canIssueOrders);
  const realm = site.clear
    ? (setup.store.get("Structure", { game_id: site.game_id, entity_id: site.clear.home_id }) ?? null)
    : null;
  const armies = useDockArmies(realm);
  const supplyPost = Number(site.entity_id);
  const rules = readExpeditionRules(setup.store, configManager.getActiveGameId());
  const usable =
    rules &&
    realm &&
    ordersAllowed &&
    account.account?.address &&
    BigInt(account.account.address) === realm.owner &&
    isSupplyPost(setup.store, site, realm.entity_id, now);
  const inRange =
    usable && realm
      ? armies.filter((army) => reinforcementSource(setup.store, realm, army.explorerId, now, supplyPost))
      : [];
  return (
    <HudSheet
      label={SUPPLY_POST.title}
      cue={<HudChip icons={[TARGET_MARKS.Camp.icon]}>{siteDisplayName(supplyPost)}</HudChip>}
      onClose={onClose}
    >
      {realm && rules && usable ? <RealmStock realm={realm} rules={rules} /> : children}
      {realm && usable && (
        <section className="supply-post__band" aria-label={SUPPLY_POST.inRange}>
          <header className="supply-post__head">
            <span>{SUPPLY_POST.inRange}</span>
            <span>{SUPPLY_POST.beside(inRange.length)}</span>
          </header>
          {inRange.map((army) => (
            <ArmyInRange key={army.explorerId} realm={realm} army={army} post={supplyPost} />
          ))}
        </section>
      )}
    </HudSheet>
  );
}

const RealmStock = ({ realm, rules }: { realm: NativeRows["Structure"]; rules: ExpeditionRules }) => {
  const stores = useRealmStores(realm, rules);
  return (
    <section className="supply-post__band" aria-label={SUPPLY_POST.drawsFrom}>
      <header className="supply-post__head">
        <span>{SUPPLY_POST.drawsFrom}</span>
        <SupplyPostEnds />
      </header>
      <div className="supply-post__stock">
        {TROOP_STORES.map((kind) => (
          <span key={kind} className="supply-post__amount" data-empty={(stores?.[kind].amount ?? 0) === 0}>
            <Icon name={FRONTIER_STORES[kind].icon} size={20} />
            {formatShort(stores?.[kind].amount ?? 0)}
          </span>
        ))}
        <span className="supply-post__amount supply-post__wheat">
          <Icon name={FRONTIER_STORES.wheat.icon} size={20} />
          {formatShort(stores?.wheat.amount ?? 0)}
        </span>
      </div>
    </section>
  );
};

const ArmyInRange = ({ realm, army, post }: { realm: NativeRows["Structure"]; army: DockArmy; post: number }) => {
  const { setup } = useGame();
  const selectOnMap = useUIStore((state) => state.selectOnMap);
  const { plan, range } = useReinforceRange(realm, army);
  const reinforce = () => {
    const at = setup.store.entityOccupancy(realm.game_id, army.explorerId);
    if (at) selectOnMap({ kind: "structure", entityId: post, tile: { col: at.col, row: at.row } });
  };
  return (
    <button type="button" data-supply-army className="supply-post__army" onClick={reinforce}>
      <HudPortrait icon={army.art} label={TROOPS} />
      <span className="supply-post__army-words">
        <b>{frontierTroopName(army.troopsFact.category) || TROOPS}</b>
        {plan && (
          <span className="supply-post__army-troops">
            {formatExact(plan.current)} <span className="supply-post__arrow">→</span>{" "}
            <span className="supply-post__after">{formatExact(plan.current + range.max)}</span>
          </span>
        )}
      </span>
      {plan && range.max > 0 && (
        <HudChip icons={[army.art]} label={TROOPS} tone="good">
          {formatShort(range.max, { signed: true })}
        </HudChip>
      )}
    </button>
  );
};
