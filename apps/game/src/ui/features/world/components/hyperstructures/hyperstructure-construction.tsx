import { useState } from "react";
import { configManager, getHyperstructureTotalContributableAmounts, ResourceManager } from "@bibliothecadao/eternum";
import { useGame, useNativeRevision, useNativeRow } from "@bibliothecadao/react";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import Button from "@/ui/design-system/atoms/button";
import { toast } from "@/ui/features/event-feed/notify";

const accessOptions = ["Public", "Private", "GuildOnly"] as const;
const precision = BigInt(RESOURCE_PRECISION);
const decimals = precision.toString().length - 1;

function parseContribution(text: string): bigint | undefined {
  if (!/^\d+(?:\.\d+)?$/.test(text)) return undefined;
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) return undefined;
  return BigInt(whole) * precision + BigInt(fraction.padEnd(decimals, "0"));
}

function displayAmount(amount: bigint): string {
  const fraction = (amount % precision).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${amount / precision}${fraction ? `.${fraction}` : ""}`;
}

export const HyperstructureConstruction = ({ entityId }: { entityId: number }) => {
  const {
    setup: { store, systemCalls },
    account: { account },
  } = useGame();
  const game_id = configManager.getActiveGameId();
  const tick = useCurrentDefaultTick();
  const structure = useNativeRow("Structure", { game_id, entity_id: entityId });
  const hyperstructure = useNativeRow("Hyperstructure", { game_id, entity_id: entityId });
  const rules = useNativeRow("HyperstructureRules", { game_id });
  useNativeRevision([
    "Structure",
    "ResourceWeight",
    "ResourceBalance",
    "ResourceProduction",
    "HyperstructureProgress",
    "GuildMember",
  ]);
  const [sourceId, setSourceId] = useState<number>();
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [pending, setPending] = useState(false);

  if (!structure || !hyperstructure || !rules || hyperstructure.stage === "Complete") return null;
  const actor = account ? BigInt(account.address) : undefined;
  const owned = actor !== undefined && actor !== 0n && structure.owner === actor;
  const sources = actor !== undefined && actor !== 0n ? [...store.structuresOwnedBy(game_id, actor)] : [];
  const source = sourceId === undefined ? sources[0] : sources.find((row) => row.entity_id === sourceId);
  const resources = source ? new ResourceManager(store, source.entity_id) : undefined;
  const ownerGuild = store.get("GuildMember", { game_id, actor: structure.owner })?.guild_id;
  const actorGuild = actor !== undefined ? store.get("GuildMember", { game_id, actor })?.guild_id : undefined;
  const canContribute =
    owned ||
    hyperstructure.access === "Public" ||
    (hyperstructure.access === "GuildOnly" &&
      ownerGuild !== undefined &&
      ownerGuild !== 0n &&
      ownerGuild === actorGuild);
  const requirements = getHyperstructureTotalContributableAmounts(entityId, store).map(({ resource, amount }) => {
    const contributed =
      store.get("HyperstructureProgress", { game_id, entity_id: entityId, resource_type: resource })?.contributed ?? 0n;
    const remaining = BigInt(amount) * precision - contributed;
    const current = resources?.current(resource);
    const available =
      current && resources
        ? current.balance + resources.balanceWithProduction(tick, resource).amountProducedLimited
        : undefined;
    const text = amounts[resource] ?? "";
    const value = parseContribution(text);
    return {
      resource,
      remaining,
      available,
      value,
      valid:
        text === "" ||
        (value !== undefined && value > 0n && available !== undefined && value <= available && value <= remaining),
    };
  });
  const contributions = requirements.flatMap((row) =>
    row.value !== undefined && row.value > 0n ? [{ resource: row.resource, amount: row.value }] : [],
  );
  const canSubmit = canContribute && source && contributions.length > 0 && requirements.every((row) => row.valid);

  const submit = async (action: () => Promise<unknown>, message: string) => {
    if (!account || actor === 0n || pending) return;
    setPending(true);
    try {
      await action();
      setAmounts({});
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Construction action failed");
    } finally {
      setPending(false);
    }
  };

  const initialize = () => {
    if (!owned) return;
    return submit(
      () => systemCalls.initialize_hyperstructure({ signer: account, hyperstructure_id: entityId }),
      "Hyperstructure construction started",
    );
  };
  const contribute = () => {
    if (!canSubmit || !source) return;
    return submit(
      () =>
        systemCalls.contribute_to_construction({
          signer: account,
          hyperstructure_entity_id: entityId,
          contributor_entity_id: source.entity_id,
          contributions,
        }),
      "Construction resources contributed",
    );
  };
  const setAccess = (access: number) => {
    if (!owned) return;
    return submit(
      () => systemCalls.set_access({ signer: account, hyperstructure_entity_id: entityId, access }),
      "Construction access updated",
    );
  };

  return (
    <section className="space-y-3 p-3 text-xs text-gold" aria-label="Hyperstructure construction">
      <h4>Construction</h4>
      {hyperstructure.stage === "Foundation" ? (
        <>
          <p>
            Supply this hyperstructure with {displayAmount(rules.initialize_shards)} Ancient Fragments to begin
            construction.
          </p>
          {owned && (
            <Button disabled={pending} onClick={initialize}>
              Start construction
            </Button>
          )}
        </>
      ) : (
        <>
          {owned ? (
            <label className="flex justify-between gap-2">
              Contributors
              <select
                aria-label="Construction access"
                value={accessOptions.indexOf(hyperstructure.access)}
                disabled={pending}
                onChange={(event) => void setAccess(Number(event.target.value))}
              >
                {accessOptions.map((access, index) => (
                  <option key={access} value={index} disabled={access === "GuildOnly" && !ownerGuild}>
                    {access === "GuildOnly" ? "Guild only" : access}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>Construction access: {hyperstructure.access === "GuildOnly" ? "Guild only" : hyperstructure.access}</p>
          )}
          {canContribute && sources.length > 0 && (
            <label className="flex justify-between gap-2">
              Supply from
              <select
                aria-label="Construction source"
                value={source?.entity_id ?? ""}
                disabled={pending}
                onChange={(event) => {
                  setSourceId(Number(event.target.value));
                  setAmounts({});
                }}
              >
                {!source && (
                  <option value="" disabled>
                    Select an owned structure
                  </option>
                )}
                {sources.map((row) => (
                  <option key={row.entity_id} value={row.entity_id}>
                    Structure #{row.entity_id}
                  </option>
                ))}
              </select>
            </label>
          )}
          {requirements.map((row) => (
            <label key={row.resource} className="flex justify-between gap-2">
              <span>
                {ResourcesIds[row.resource]}: {displayAmount(row.remaining)} needed
                {canContribute && source && (
                  <small className="block">
                    {row.available === undefined
                      ? "Waiting for inventory"
                      : `${displayAmount(row.available)} available`}
                  </small>
                )}
              </span>
              {canContribute && source && (
                <input
                  aria-label={`${ResourcesIds[row.resource]} contribution`}
                  inputMode="decimal"
                  className="w-20 bg-black/40 p-1"
                  value={amounts[row.resource] ?? ""}
                  disabled={pending || row.remaining === 0n || row.available === undefined}
                  onChange={(event) => setAmounts((previous) => ({ ...previous, [row.resource]: event.target.value }))}
                />
              )}
            </label>
          ))}
          {canContribute && source && (
            <Button disabled={!canSubmit || pending} onClick={contribute}>
              Contribute resources
            </Button>
          )}
        </>
      )}
    </section>
  );
};
