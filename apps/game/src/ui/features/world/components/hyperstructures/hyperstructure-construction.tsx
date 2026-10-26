import { useState } from "react";
import {
  configManager,
  getHyperstructureTotalContributableAmounts,
  getStructureName,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision, useNativeRow } from "@/hooks/helpers/use-native-facts";
import { RESOURCE_PRECISION, resourceName } from "@bibliothecadao/types";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { HudButton, HudField, HudSelect } from "@/ui/design-system/kit/hud-elements";
import { toast } from "@/ui/features/event-feed/notify";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

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
  const [sourceId, setSourceId] = useState<bigint>();
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [pending, setPending] = useState(false);

  if (!structure || !hyperstructure || !rules || hyperstructure.stage === "Complete") return null;
  const actor = account ? BigInt(account.address) : undefined;
  const owned = actor !== undefined && actor !== 0n && structure.owner === actor;
  const sources = actor !== undefined && actor !== 0n ? [...store.structuresOwnedBy(game_id, actor)] : [];
  const source = sourceId === undefined ? sources[0] : sources.find((row) => row.entity_id === sourceId);
  const resources = source ? new ResourceManager(store, safeInteger(source.entity_id)) : undefined;
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
    const contributed = store.requireOrAbsent("HyperstructureProgress", {
      game_id,
      entity_id: entityId,
      resource_type: resource,
    }).known?.contributed;
    const remaining = contributed === undefined ? undefined : BigInt(amount) * precision - contributed;
    const current = resources?.current(resource);
    const produced = resources?.balanceWithProduction(tick, resource);
    const available = current && produced ? current.balance + produced.amountProducedLimited : undefined;
    const text = amounts[resource] ?? "";
    const value = parseContribution(text);
    return {
      resource,
      remaining,
      available,
      value,
      valid:
        text === "" ||
        (value !== undefined &&
          value > 0n &&
          available !== undefined &&
          value <= available &&
          remaining !== undefined &&
          value <= remaining),
    };
  });
  const contributions = requirements.flatMap((row) =>
    row.value !== undefined && row.value > 0n ? [{ resource: row.resource, amount: row.value }] : [],
  );
  const canSubmit = canContribute && source && contributions.length > 0 && requirements.every((row) => row.valid);

  const submit = async (action: () => Promise<unknown>) => {
    if (!account || actor === 0n || pending) return;
    setPending(true);
    try {
      await action();
      setAmounts({});
    } catch (error) {
      toast.failed(error, "Construction action failed");
    } finally {
      setPending(false);
    }
  };

  const initialize = () => {
    if (!owned) return;
    return submit(() => systemCalls.initialize_hyperstructure({ signer: account, hyperstructure_id: entityId }));
  };
  const contribute = () => {
    if (!canSubmit || !source) return;
    return submit(() =>
      systemCalls.contribute_to_construction({
        signer: account,
        hyperstructure_entity_id: entityId,
        contributor_entity_id: source.entity_id,
        contributions,
      }),
    );
  };
  const setAccess = (access: number) => {
    if (!owned) return;
    return submit(() => systemCalls.set_access({ signer: account, hyperstructure_entity_id: entityId, access }));
  };

  return (
    <section className="space-y-3 p-3 text-hud-body text-hud-ink" aria-label="Hyperstructure construction">
      <h4>Construction</h4>
      {hyperstructure.stage === "Foundation" ? (
        <>
          <p>Needs {displayAmount(rules.initialize_shards)} Ancient Fragments to start</p>
          {owned && (
            <HudButton kind="secondary" size="sm" disabled={pending} onClick={initialize}>
              Start construction
            </HudButton>
          )}
        </>
      ) : (
        <>
          {owned ? (
            <div className="flex items-center justify-between gap-2">
              Contributors
              <HudSelect
                label="Construction access"
                value={accessOptions.indexOf(hyperstructure.access)}
                disabled={pending}
                options={accessOptions.map((access, index) => ({
                  value: index,
                  label: access === "GuildOnly" ? "Guild only" : access,
                  disabled: access === "GuildOnly" && !ownerGuild,
                }))}
                onChange={(access) => void setAccess(access)}
              />
            </div>
          ) : (
            <p>Construction access: {hyperstructure.access === "GuildOnly" ? "Guild only" : hyperstructure.access}</p>
          )}
          {canContribute && sources.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              Supply from
              <HudSelect
                label="Construction source"
                value={source?.entity_id.toString() ?? ""}
                disabled={pending}
                options={[
                  ...(source ? [] : [{ value: "", label: "Select an owned structure", disabled: true }]),
                  ...sources.map((row) => ({
                    value: row.entity_id.toString(),
                    label: getStructureName(row).name,
                  })),
                ]}
                onChange={(id) => {
                  setSourceId(BigInt(id));
                  setAmounts({});
                }}
              />
            </div>
          )}
          {requirements.map((row) => (
            <label key={row.resource} className="flex justify-between gap-2">
              <span>
                {resourceName(row.resource)}: {row.remaining === undefined ? "—" : displayAmount(row.remaining)} needed
                {canContribute && source && (
                  <small className="block">
                    {row.available === undefined
                      ? "Waiting for inventory"
                      : `${displayAmount(row.available)} available`}
                  </small>
                )}
              </span>
              {canContribute && source && (
                <span className="w-20">
                  <HudField
                    aria-label={`${resourceName(row.resource)} contribution`}
                    inputMode="decimal"
                    value={amounts[row.resource] ?? ""}
                    disabled={
                      pending || row.remaining === undefined || row.remaining === 0n || row.available === undefined
                    }
                    onChange={(value) => setAmounts((previous) => ({ ...previous, [row.resource]: value }))}
                  />
                </span>
              )}
            </label>
          ))}
          {canContribute && source && (
            <HudButton kind="secondary" size="sm" disabled={!canSubmit || pending} onClick={contribute}>
              Contribute resources
            </HudButton>
          )}
        </>
      )}
    </section>
  );
};
