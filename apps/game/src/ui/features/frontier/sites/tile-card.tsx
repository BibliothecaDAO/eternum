import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentArmiesTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requestArmySelection } from "@/three/scenes/worldmap-army-select-request";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { biomeTypeOf, configManager, entityMapPosition } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

import { useFrontierRealm, useGoToFrontierPlace } from "../frontier-home";
import { type ArmyOrder, type Cost, isCovered, useArmyStamina, useOrderAt } from "../hud/army-order";
import { armyArt, type DockArmy, useDockArmies } from "../hud/dock-armies";
import { useApproachTile } from "./approach";
import { useSelectedOwnArmy } from "./selected-army";
import { readSiteCard, type SiteAttack } from "./site-card-plan";
import { type SiteChoice, SiteCardView, type SiteVerb } from "./site-card-view";

const SITE_MODELS = ["ExpeditionSite", "ExplorerTroops", "ArmySlot", "Guard", "Structure", "TileOccupancy"] as const;

/** The resources a clear pays home, by the icon the card draws them with. */
const PAY_ICONS: Partial<Record<ResourcesIds, IconCode>> = { [ResourcesIds.Labor]: "La", [ResourcesIds.Essence]: "Es" };

interface SelectedSite {
  site: NativeRows["ExpeditionSite"];
  structure: NativeRows["Structure"];
  tile: TileSpatialRenderable;
}

/** The map tile the player tapped, when it holds a standing expedition site: a camp, rift or ruin. */
export const useSelectedSite = (): SelectedSite | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selectedHex ? [selectedHex] : []), [selectedHex]);
  const [tile] = useWorldSpatialTiles(hexes);
  useNativeRevision(SITE_MODELS);
  if (!isMapView || !tile?.occupierIsStructure) return null;
  const key = { game_id: configManager.getActiveGameId(), entity_id: tile.occupierId };
  const site = setup.store.get("ExpeditionSite", key);
  if (!site || site.cleared) return null;
  return { site, structure: setup.store.require("Structure", key), tile };
};

/**
 * A guarded site's card over the game's facts: the selected army's matchup and exact forecast, what the clear pays and
 * its XP, then Attack in reach, Move until the army arrives, or the stamina it lacks. With no army selected, the
 * realm's armies are the choices. The card stays between attacks and closes when the site falls.
 */
export const TileCard = ({ selected, onClose }: { selected: SelectedSite; onClose: () => void }) => {
  const { setup, account } = useGame();
  const actor = useSelectedOwnArmy();
  const attack = useSiteAttack(selected.tile, actor);
  const revision = useNativeRevision(SITE_MODELS);
  const siteTile = selected.tile.hexCoords;
  const plan = useMemo(
    () => readSiteCard(setup.store, selected.site, selected.structure, siteTile, attack),
    [attack, revision, selected, setup.store, siteTile],
  );
  const choices = useSiteChoices(selected, actor === null);
  const approach = useOrderAt(useApproachTile(siteTile, actor !== null && plan.fight === undefined));
  const stamina = useArmyStamina(actor?.army.explorer_id ?? null, plan.attackStamina);
  const realm = useFrontierRealm();
  const goToPlace = useGoToFrontierPlace(realm);
  const [sending, setSending] = useState(false);

  const attackSite = async () => {
    if (!attack || !account.account) return;
    setSending(true);
    try {
      playUnitCommandSound("attack");
      await setup.systemCalls.attack_explorer_vs_guard({
        signer: account.account,
        explorer_id: attack.army.explorer_id,
        structure_id: selected.structure.entity_id,
      });
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The attack could not be sent."));
    } finally {
      setSending(false);
    }
  };

  const verb = siteVerb({
    hasArmy: actor !== null,
    inReach: plan.fight !== undefined,
    approach,
    stamina,
    attack: { stamina: plan.attackStamina, sending, onAttack: () => void attackSite() },
  });
  const payIcon = plan.payout && PAY_ICONS[plan.payout.resourceId];

  return (
    <SiteCardView
      site={plan.kind}
      beast={plan.beast}
      army={actor && { art: armyArt(actor.army.troops), troops: wholeTroops(actor.army) }}
      guard={plan.guard === undefined ? undefined : (plan.guard?.count ?? null)}
      fight={plan.fight}
      pay={plan.payout && payIcon ? { icon: payIcon, amount: plan.payout.amount } : null}
      xp={plan.xp}
      verb={verb}
      choices={actor ? undefined : choices}
      onRealm={() => {
        onClose();
        goToPlace(false);
      }}
      onClose={onClose}
    />
  );
};

/**
 * The card's step: Move toward the site until the army is in reach (its prices, the order's), then Attack, the same
 * tap whatever the forecast, or the stamina it lacks held against the attack's cost.
 */
const siteVerb = ({
  hasArmy,
  inReach,
  approach,
  stamina,
  attack,
}: {
  hasArmy: boolean;
  inReach: boolean;
  approach: ArmyOrder | null;
  stamina: Cost | undefined;
  attack: { stamina: number; sending: boolean; onAttack: () => void };
}): SiteVerb | null => {
  if (!hasArmy) return null;
  if (!inReach) {
    if (!approach) return null;
    return {
      kind: "move",
      prices: [
        { of: "stamina", amount: approach.stamina.cost },
        { of: "wheat", amount: Math.ceil(approach.wheat.cost) },
      ],
      onMove: () => requestOrderAt(approach.target),
    };
  }
  if (stamina && !isCovered(stamina)) return { kind: "short", stamina };
  return { kind: "attack", ...attack };
};

/** The selected army's attack on this site: where it stands, on the site's biome, at the current clocks. */
const useSiteAttack = (
  siteTile: TileSpatialRenderable,
  actor: ReturnType<typeof useSelectedOwnArmy>,
): SiteAttack | null => {
  const timestamp = useNowSeconds();
  const armiesTick = useCurrentArmiesTick();
  return actor && { ...actor, biome: biomeTypeOf(siteTile.biome), timestamp, armiesTick };
};

/** With no army selected, each of the realm's armies as a choice, marked with whether it wins from where it stands. */
const useSiteChoices = (selected: SelectedSite, wanted: boolean): SiteChoice[] => {
  const { setup } = useGame();
  const realm = useFrontierRealm();
  const armies = useDockArmies(realm);
  const timestamp = useNowSeconds();
  const armiesTick = useCurrentArmiesTick();
  if (!wanted || !realm) return [];
  return armies.map((army: DockArmy) => {
    const troops = setup.store.get("ExplorerTroops", { game_id: realm.game_id, explorer_id: army.explorerId });
    const position = entityMapPosition(setup.store, realm.game_id, army.explorerId);
    const fight =
      troops &&
      readSiteCard(setup.store, selected.site, selected.structure, selected.tile.hexCoords, {
        army: troops,
        armyTile: { col: position.x, row: position.y, alt: position.alt },
        biome: biomeTypeOf(selected.tile.biome),
        timestamp,
        armiesTick,
      }).fight;
    return {
      label: army.label,
      art: army.art,
      troops: army.troops,
      wins: fight && fight.outcome !== "refused" ? fight.outcome === "wins" : undefined,
      onPick: () => requestArmySelection(army.explorerId),
    };
  });
};

const wholeTroops = (army: NativeRows["ExplorerTroops"]): number =>
  Number(army.troops.count / BigInt(RESOURCE_PRECISION));
