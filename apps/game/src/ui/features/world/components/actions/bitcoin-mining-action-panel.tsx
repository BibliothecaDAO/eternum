import { useState } from "react";
import { configManager, ResourceManager } from "@bibliothecadao/eternum";
import { useGame, useNativeRow, useNativeRevision } from "@bibliothecadao/react";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useCurrentBlockTimestamp, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import Button from "@/ui/design-system/atoms/button";
import { toast } from "@/ui/features/event-feed/notify";

export const BitcoinMiningActionPanel = ({ structureEntityId }: { structureEntityId: number }) => {
  const {
    setup: { store, systemCalls },
    account: { account },
  } = useGame();
  const game_id = configManager.getActiveGameId();
  const timestamp = useCurrentBlockTimestamp();
  const tick = useCurrentDefaultTick();
  const structure = useNativeRow("Structure", { game_id, entity_id: structureEntityId });
  const rules = useNativeRow("SliceRules", { game_id });
  const mine = useNativeRow("BitcoinMine", { game_id, entity_id: structureEntityId });
  const interval = rules?.tick_config.bitcoin_phase_in_seconds;
  const phase = interval ? BigInt(timestamp) / interval : undefined;
  const contribution = useNativeRow(
    "BitcoinContribution",
    phase !== undefined && account
      ? {
          game_id,
          phase,
          player: BigInt(account.address),
        }
      : undefined,
  );
  const claimPhase = useNativeRow("BitcoinPhase", mine ? { game_id, phase: mine.next_phase } : undefined);
  useNativeRevision(["ResourceBalance", "ResourceProduction"]);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);

  if (!rules?.bitcoin_mine_config.enabled || !structure || phase === undefined) return null;
  const owned = account && BigInt(account.address) !== 0n && structure.owner === BigInt(account.address);
  const canClaim = mine && mine.next_phase < phase;
  if (!owned && !canClaim) return null;
  const precision = BigInt(RESOURCE_PRECISION);
  const resources = new ResourceManager(store, structureEntityId);
  const labor =
    (resources.current(ResourcesIds.Labor)?.balance ?? 0n) +
    resources.balanceWithProduction(tick, ResourcesIds.Labor).amountProducedLimited;
  const minimum = rules.bitcoin_mine_config.min_labor_per_contribution;
  const parsed = /^\d+$/.test(amount) ? BigInt(amount) * precision : 0n;
  const validAmount = parsed > 0n && parsed >= minimum && parsed <= labor;

  const contribute = async () => {
    if (!account || !owned || !validAmount || pending) return;
    setPending(true);
    try {
      await systemCalls.bitcoin_mine_contribute_labor({
        signer: account,
        structure_id: structureEntityId,
        labor_amount: parsed,
      });
      setAmount("");
      toast.success("Labor contributed to the current mining phase");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Labor contribution failed");
    } finally {
      setPending(false);
    }
  };

  const claim = async () => {
    if (!account || !mine || !canClaim || pending) return;
    setPending(true);
    const props = { signer: account, phase_id: mine.next_phase };
    try {
      if (!claimPhase || claimPhase.state === "Open") await systemCalls.bitcoin_mine_close_phase(props);
      const closed = store.require("BitcoinPhase", { game_id, phase: mine.next_phase });
      if (closed.total_labor > 0n && closed.state === "Closed") await systemCalls.bitcoin_mine_bind_phase(props);
      await systemCalls.bitcoin_mine_claim_phase_reward({ ...props, mine_ids: [structureEntityId] });
      toast.success("Mining phase settled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mining phase settlement failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="space-y-2 rounded border border-gold/20 p-3 text-xs text-gold">
      <h4>Bitcoin mining · phase {phase.toString()}</h4>
      {owned && (
        <>
          <p>
            Contribute Labor from this structure to every owned mine’s draw. Your phase contribution:{" "}
            {(contribution?.labor ?? 0n) / precision + " Labor"}.
          </p>
          <label className="flex items-center gap-2">
            Labor ({(labor / precision).toString()} available)
            <input
              aria-label="Mining Labor"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-24 bg-black/40 p-1"
            />
          </label>
          <Button onClick={contribute} disabled={!validAmount || pending}>
            {pending ? "Submitting…" : "Contribute Labor"}
          </Button>
        </>
      )}
      {canClaim && (
        <Button onClick={claim} disabled={!account || pending}>
          Settle mine phase {mine.next_phase.toString()}
        </Button>
      )}
    </section>
  );
};
