import { type IconMeaning } from "@/ui/design-system/icon";
import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";

import type { Tier } from "@/ui/design-system/kit/words";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { biomeTypeOf, configManager, getStructureName, isViewerOwner } from "@bibliothecadao/eternum";
import {
  safeInteger,
  type GameClientSetup,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { fightVerdict, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useMemo, type ReactNode } from "react";

import { useFrontierRealm, useGoToFrontierPlace } from "../frontier-home";
import { type ArmyOrder, type Cost, isCovered, useArmyStamina, useOrderAt } from "../hud/army-order";
import { armyArt } from "../hud/dock-armies";
import { useApproachTile } from "./approach";
import { readFightRecord } from "./fight-record";
import { fightIsSent, fightWasNotSent, useFightRefusal } from "./fight-refusal";
import { useSelectedOwnArmy } from "./selected-army";
import { readArmyCard, readSiteCard, type SiteAttack, type SiteCardPlan } from "./site-card-plan";
import { SiteCardView, type SiteVerb } from "./site-card-view";

const SITE_MODELS = [
  "ExpeditionSite",
  "SiteChest",
  "ExplorerTroops",
  "ArmyProgress",
  "ArmySlot",
  "Guard",
  "Structure",
  "TileOccupancy",
  "ResourceBalance",
  "ResourceProduction",
  "RealmKnowledge",
] as const;

/** The resources a clear pays home, by the icon the card draws them with. */
const PAY_ICONS: Partial<Record<ResourcesIds, IconMeaning>> = {
  [ResourcesIds.Labor]: "labor",
  [ResourcesIds.Essence]: "essence",
};

/** What the tile card attacks: a standing site through its guard, or another player's army. */
type AttackTarget =
  | {
      kind: "site";
      site: NativeRows["ExpeditionSite"];
      structure: NativeRows["Structure"];
      tile: TileSpatialRenderable;
    }
  | { kind: "army"; army: NativeRows["ExplorerTroops"]; tile: TileSpatialRenderable };

/**
 * The map tile the player tapped, when something an army can attack stands on it: a standing expedition site (a
 * camp, rift, ruin or beasts), or an army that is not the player's own where the game takes an army's attack on another
 * (Battle; Frontier's preset leaves it out).
 */
export const useSelectedTarget = (): AttackTarget | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const viewer = useAccountAddress();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selectedHex ? [selectedHex] : []), [selectedHex]);
  const [tile] = useWorldSpatialTiles(hexes);
  useNativeRevision(SITE_MODELS);
  if (!isMapView || !tile) return null;
  if (tile.occupierIsStructure) return standingSite(setup.store, tile);
  return configManager.isCommandEnabled("Battle") ? otherArmy(setup.store, tile, viewer) : null;
};

const standingSite = (store: NativeFactStore, tile: TileSpatialRenderable): AttackTarget | null => {
  const key = { game_id: configManager.getActiveGameId(), entity_id: tile.occupierId };
  const site = store.get("ExpeditionSite", key);
  if (!site || site.clear) return null;
  return { kind: "site", site, structure: store.require("Structure", key), tile };
};

/** The army on the tile when it is someone else's; the player's own armies have their dock, not a card. */
const otherArmy = (store: NativeFactStore, tile: TileSpatialRenderable, viewer: bigint | null): AttackTarget | null => {
  const gameId = configManager.getActiveGameId();
  const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: tile.occupierId });
  if (!army) return null;
  const home = store.get("Structure", { game_id: gameId, entity_id: army.owner });
  return home && isViewerOwner(home.owner, viewer) ? null : { kind: "army", army, tile };
};

/** The card's reading of its target for an attack: a site's by its guard, an army's by its troops. */
const readTarget = (store: NativeFactStore, target: AttackTarget, attack: SiteAttack | null): SiteCardPlan =>
  target.kind === "site"
    ? readSiteCard(store, target.site, target.structure, target.tile.hexCoords, attack)
    : readArmyCard(store, target.army, target.tile.hexCoords, attack);

const targetId = (target: AttackTarget): number =>
  safeInteger(target.kind === "site" ? target.site.entity_id : target.army.explorer_id);

/**
 * A target's card over the game's facts: the selected army's matchup and exact forecast, what a clear pays and its
 * XP, then Attack in reach, Move until the army arrives, or the stamina it lacks. With no army selected, what the site
 * is and pays, and its guard. The card stays between attacks and closes when the target falls. It is the one surface an
 * army's attack is confirmed on, whatever it attacks.
 *
 * After a clear the panel is the still-selected army's again, not the cleared site's (owner, 27 October 2026: "when I
 * clear a camp, the panel on the right should go back to my army panel since its still selected"), through the HUD's
 * `onArmyBack`; selecting the site later shows its own card. An army lost lets go of the map itself.
 */
export const TileCard = ({
  selected,
  onClose,
  onArmyBack,
  receipt,
}: {
  selected: AttackTarget;
  onClose: () => void;
  /** Hands the HUD back to the army once it cleared the target (useArmyPanelOpens). */
  onArmyBack: (armyId: number) => void;
  receipt?: ReactNode;
}) => {
  const { setup, account } = useGame();
  const actor = useSelectedOwnArmy();
  const attack = useSiteAttack(selected.tile, actor);
  const facts = useNativeFacts(SITE_MODELS);
  const siteTile = selected.tile.hexCoords;
  const plan = useMemo(() => readTarget(facts.store, selected, attack), [attack, facts, selected]);
  const approach = useOrderAt(useApproachTile(siteTile, actor !== null && plan.fight === undefined));
  const stamina = useArmyStamina(actor ? safeInteger(actor.army.explorer_id) : null, plan.attackStamina);
  const realm = useFrontierRealm();
  const goToPlace = useGoToFrontierPlace(realm);
  const armyId = actor ? safeInteger(actor.army.explorer_id) : null;
  const inFlight = useInFlight("army", armyId)?.order;
  const refused = useFightRefusal(armyId, targetId(selected));

  const attackSite = async () => {
    if (!attack || !account.account || armyId === null) return;
    const signer = account.account;
    try {
      const fought = await sendOnce("army", armyId, { order: "attack" }, () => {
        fightIsSent();
        playUnitCommandSound("attack");
        return sendAttack(setup.systemCalls, signer, armyId, selected);
      });
      if (fought !== null && targetFell(setup.store, selected, fought) && stillActsOn(armyId, siteTile))
        onArmyBack(armyId);
    } catch (error) {
      fightWasNotSent({
        armyId,
        targetId: targetId(selected),
        line: extractReadableErrorMessage(error, "The attack could not be sent."),
      });
    }
  };

  const verb = siteVerb({
    hasArmy: actor !== null,
    inReach: plan.fight !== undefined,
    approach,
    stamina,
    attack: { stamina: plan.attackStamina, inFlight, refused, onAttack: () => void attackSite() },
  });

  return (
    <SiteCardView
      receipt={receipt}
      site={plan.kind}
      name={selected.kind === "site" ? getStructureName(selected.structure).name : undefined}
      beast={plan.beast && plan.guard ? { ...plan.beast, combatClass: plan.guard.type } : undefined}
      army={actor && { art: armyArt(actor.army.troops), troops: wholeTroops(actor.army) }}
      guard={plan.guard === undefined ? undefined : (plan.guard?.count ?? null)}
      fight={plan.fight}
      pay={sitePay(plan)}
      chest={plan.chest ? { tier: (plan.chest.tier + 1) as Tier, lords: plan.chest.amount } : undefined}
      xp={plan.xp}
      verb={verb}
      onRealm={() => {
        onClose();
        goToPlace(false);
      }}
      onClose={onClose}
    />
  );
};

/** The attack the contract takes for the target: on a site's guard, or on another army (taking nothing from it). */
const sendAttack = (
  systemCalls: GameClientSetup["systemCalls"],
  signer: NonNullable<ReturnType<typeof useGame>["account"]["account"]>,
  explorerId: number,
  target: AttackTarget,
) =>
  target.kind === "site"
    ? systemCalls.attack_explorer_vs_guard({ signer, explorer_id: explorerId, structure_id: targetId(target) })
    : systemCalls.attack_explorer_vs_explorer({
        signer,
        aggressor_id: explorerId,
        defender_id: targetId(target),
        steal_resources: [],
      });

/**
 * The card's step: Move toward the site until the army is in reach (its prices, the order's), or Attack held back
 * when no order leads beside it; then Attack, the same tap whatever the forecast, or held back by the stamina it
 * lacks.
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
  attack: Omit<Extract<SiteVerb, { kind: "attack" }>, "kind">;
}): SiteVerb | null => {
  if (!hasArmy) return null;
  if (!inReach) {
    if (!approach) return { kind: "far" };
    return {
      kind: "move",
      prices: [
        { of: "stamina", amount: approach.stamina.cost },
        { of: "wheat", amount: approach.wheat.cost },
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
  const timestamp = useCurrentDefaultTick();
  return actor && { ...actor, biome: biomeTypeOf(siteTile.biome), timestamp };
};

/** What a camp or rift pays home and what of it fits; a ruin pays its chest, beasts only XP. */
const sitePay = (plan: SiteCardPlan) => {
  const icon = plan.payout && PAY_ICONS[plan.payout.resourceId];
  return plan.payout && icon ? { icon, amount: plan.payout.amount, fits: plan.payout.fits } : null;
};

/**
 * The target fell to this attack: its battle's record says the army stands over a fallen guard, or, before any record
 * reaches this screen, the site stands cleared. A fight both sides survive goes on in the target's card.
 */
const targetFell = (store: NativeFactStore, selected: AttackTarget, transactionHash: string): boolean => {
  const record = readFightRecord(transactionHash);
  if (record) return fightVerdict({ army: record.army.after, guard: record.guard.after }) === "victory";
  if (selected.kind !== "site") return false;
  const id = safeInteger(selected.site.entity_id);
  return store.get("ExpeditionSite", { game_id: configManager.getActiveGameId(), entity_id: id })?.clear != null;
};

/**
 * Whether the army is still selected acting on the attacked tile when the attack's outcome arrives: a player who let
 * go of it, picked another army or another tile meanwhile keeps that newer choice.
 */
const stillActsOn = (armyId: number, tile: { col: number; row: number }): boolean => {
  const selection = useUIStore.getState().mapSelection;
  return (
    selection?.kind === "army" &&
    selection.entityId === armyId &&
    typeof selection.tile === "object" &&
    selection.tile?.col === tile.col &&
    selection.tile.row === tile.row
  );
};

const wholeTroops = (army: NativeRows["ExplorerTroops"]): number =>
  Number(army.troops.count / BigInt(RESOURCE_PRECISION));
