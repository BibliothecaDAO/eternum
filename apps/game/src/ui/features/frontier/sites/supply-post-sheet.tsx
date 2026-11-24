import { useState, type ReactNode } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { HudButton, HudNotice, HudPortrait, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { REINFORCE, TROOPS } from "@/ui/design-system/kit/words";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { isSupplyPost, siteDisplayName } from "@bibliothecadao/eternum";
import { formatExact, frontierTroopName } from "@bibliothecadao/types";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { ReinforceSheet, useReinforceRange } from "../army/reinforce";
import { reinforcementSource } from "../army/reinforce-plan";

/** The camp's existing receipt opens reinforcement from the clearing home's stores. */
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
    ? setup.store.get("Structure", { game_id: site.game_id, entity_id: site.clear.home_id })
    : undefined;
  const armies = useDockArmies(realm ?? null);
  const [chosen, setChosen] = useState<number | null>(null);
  const supplyPost = Number(site.entity_id);
  const usable =
    realm &&
    ordersAllowed &&
    account.account?.address &&
    BigInt(account.account.address) === realm.owner &&
    isSupplyPost(setup.store, site, realm.entity_id, now);
  const adjacent = usable
    ? armies.filter((army) => reinforcementSource(setup.store, realm, army.explorerId, now, supplyPost))
    : [];
  const army = adjacent.find((entry) => entry.explorerId === chosen);
  if (army && realm) return <ReinforceSheet realm={realm} army={army} supplyPost={supplyPost} onClose={onClose} />;
  return (
    <HudSheet label={`Supply post · ${siteDisplayName(supplyPost)}`} onClose={onClose}>
      {children}
      <HudNotice icon="flag" line="Reinforce your armies beside this camp until the day ends." />
      {realm &&
        adjacent.map((entry) => (
          <SupplyPostArmy
            key={entry.explorerId}
            realm={realm}
            army={entry}
            primary={adjacent.length === 1}
            onChoose={() => setChosen(entry.explorerId)}
          />
        ))}
    </HudSheet>
  );
}

const SupplyPostArmy = ({
  realm,
  army,
  primary,
  onChoose,
}: {
  realm: NativeRows["Structure"];
  army: DockArmy;
  primary: boolean;
  onChoose: () => void;
}) => {
  const { plan, range } = useReinforceRange(realm, army);
  const amount = formatExact(range.max);
  const troops = frontierTroopName(army.troopsFact.category) || TROOPS;
  return (
    <>
      {plan && range.max > 0 && (
        <div
          data-supply-army
          className="flex items-center gap-3 rounded-lg border border-hud-divider bg-hud-well px-3 py-2"
        >
          <HudPortrait icon={army.art} label={TROOPS} />
          <span className="flex min-w-0 flex-col tabular-nums">
            <b className="text-hud-label text-hud-ink">{`${army.label} · ${formatExact(plan.current)} → ${formatExact(plan.current + range.max)}`}</b>
            <span className="text-hud-label text-hud-good">{REINFORCE.fromHome(amount, troops)}</span>
          </span>
        </div>
      )}
      <HudButton kind={primary ? "primary" : "secondary"} icon="military" onClick={onChoose}>
        {range.max > 0 ? REINFORCE.titleAmount(army.label, amount) : REINFORCE.title(army.label)}
      </HudButton>
    </>
  );
};
