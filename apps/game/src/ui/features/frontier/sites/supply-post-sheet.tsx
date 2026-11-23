import { useState, type ReactNode } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { HudButton, HudNotice, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { REINFORCE } from "@/ui/design-system/kit/words";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { isSupplyPost, siteDisplayName } from "@bibliothecadao/eternum";
import { useDockArmies } from "../hud/dock-armies";
import { ReinforceSheet } from "../army/reinforce";
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
      {adjacent.map((entry) => (
        <HudButton
          key={entry.explorerId}
          kind={adjacent.length === 1 ? "primary" : "secondary"}
          icon="military"
          onClick={() => setChosen(entry.explorerId)}
        >
          {REINFORCE.title(entry.label)}
        </HudButton>
      ))}
    </HudSheet>
  );
}
