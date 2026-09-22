import { useAccountStore } from "@/hooks/store/use-account-store";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { configManager, divideByPrecision, getBalance } from "@bibliothecadao/eternum";
import { useGame, useNativeRevision } from "@bibliothecadao/react";
import { ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import type { Account } from "starknet";

type Lane = "Barracks" | "Attunement";
const BARRACKS_TIERS = ["I", "II", "III"];
const ATTUNEMENT_DEPTHS = ["Surface", "Ethereal I", "Ethereal II", "Ethereal III"];

/** Essence buys the barracks and attunement ladders on a Frontier realm; games without board rules show nothing. */
export const RealmLadders = ({ structureEntityId }: { structureEntityId: number }) => {
  const {
    setup: { store, systemCalls },
  } = useGame();
  const account = useAccountStore((state) => state.account);
  const tick = useCurrentDefaultTick();
  const [pending, setPending] = useState<Lane | null>(null);
  useNativeRevision(["Structure", "ResourceBalance"]);
  const gameId = configManager.getActiveGameId();
  const board = store.get("BoardRules", { game_id: gameId });
  const realm = store.get("Structure", { game_id: gameId, entity_id: structureEntityId });
  if (!board || !realm || !account) return null;

  const essence = divideByPrecision(Number(getBalance(structureEntityId, ResourcesIds.Essence, tick, store).balance));
  const barracksTier = realm.metadata.barracks_tier;
  const attunement = realm.metadata.attunement;
  const barracksCost =
    barracksTier === 0 ? board.barracks_ii_cost : barracksTier === 1 ? board.barracks_iii_cost : null;
  const attunementCost =
    attunement < 3 ? store.require("DepthRules", { game_id: gameId, depth: attunement + 1 }).attunement_cost : null;

  const buy = async (lane: Lane) => {
    setPending(lane);
    try {
      await systemCalls.buy_realm_upgrade({
        signer: account as unknown as Account,
        structureId: structureEntityId,
        lane,
      });
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The upgrade could not be bought."));
    } finally {
      setPending(null);
    }
  };

  const ladder = (lane: Lane, current: string, next: string | null, cost: bigint | null) => {
    const price = cost === null ? null : divideByPrecision(Number(cost));
    return (
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-gold/70">
          {lane} · <span className="text-gold">{current}</span>
        </span>
        {next && price !== null ? (
          <button
            type="button"
            disabled={essence < price || pending !== null}
            onClick={() => void buy(lane)}
            className="rounded-md border border-gold/30 px-2 py-1 text-gold disabled:opacity-40"
            title={essence < price ? `Needs ${price.toLocaleString()} Essence` : undefined}
          >
            {pending === lane ? "Buying…" : `${next} · ${price.toLocaleString()} Essence`}
          </button>
        ) : (
          <span className="text-gold/50">Max</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-gold/15 pt-2">
      {ladder("Barracks", BARRACKS_TIERS[barracksTier] ?? "I", BARRACKS_TIERS[barracksTier + 1] ?? null, barracksCost)}
      {ladder(
        "Attunement",
        ATTUNEMENT_DEPTHS[attunement] ?? "Surface",
        ATTUNEMENT_DEPTHS[attunement + 1] ?? null,
        attunementCost,
      )}
      <p className="text-[10px] text-gold/50">Essence on hand: {essence.toLocaleString()}</p>
    </div>
  );
};
