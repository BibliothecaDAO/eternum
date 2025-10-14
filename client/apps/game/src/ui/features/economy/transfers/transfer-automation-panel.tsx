import { useMemo, useState, useEffect, useCallback } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getStructureName, ResourceManager, getTotalResourceWeightKg, calculateDonkeysNeeded, getIsBlitz, isMilitaryResource } from "@bibliothecadao/eternum";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useDojo } from "@bibliothecadao/react";
import { ResourcesIds, RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import { useTransferAutomationStore } from "@/hooks/store/use-transfer-automation-store";
import { useTransferPanelDraftStore } from "@/hooks/store/use-transfer-panel-draft-store";
import { toast } from "sonner";
import { TransferAutomationAdvancedModal } from "./transfer-automation-modal";

const ALL_RESOURCE_IDS = Object.values(ResourcesIds).filter((v) => typeof v === "number") as ResourcesIds[];

export const TransferAutomationPanel = () => {
  const playerStructures = useUIStore((s) => s.playerStructures);
  const setRightView = useUIStore((s) => s.setRightNavigationView);
  const toggleModal = useUIStore((s) => s.toggleModal);
  const { currentDefaultTick } = useBlockTimestamp();
  const isBlitz = getIsBlitz();

  const ownedSources = useMemo(() => {
    // Allow Realm, Village, FragmentMine as sources
    const allowed = new Set<StructureType>([StructureType.Realm, StructureType.Village, StructureType.FragmentMine]);
    return playerStructures.filter((s: any) => allowed.has(s.structure?.base?.category));
  }, [playerStructures]);

  // Aggregate available resources across owned sources (balance > 0)
  const {
    setup: { components, systemCalls },
    account: { account },
  } = useDojo();

  const resourceTotals = useMemo(() => {
    const totals = new Map<ResourcesIds, number>();
    if (!components) return totals;
    for (const ps of ownedSources) {
      const rm = new ResourceManager(components as any, ps.entityId);
      for (const rid of ALL_RESOURCE_IDS) {
        try {
          const bal = rm.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n;
          const human = Number(bal) / RESOURCE_PRECISION;
          if (human > 0) totals.set(rid, (totals.get(rid) ?? 0) + human);
        } catch (_) {}
      }
    }
    return totals;
  }, [components, ownedSources, currentDefaultTick]);

  const availableResources = useMemo(() => new Set(resourceTotals.keys() as any), [resourceTotals]);

  // UI state
  const [selectedResources, setSelectedResources] = useState<ResourcesIds[]>([]);
  const [resourceConfigs, setResourceConfigs] = useState<Record<number, { percent: number }>>({});
  const [resourceFilter, setResourceFilter] = useState<"all" | "production" | "military">("all");
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [ownedDestOnly, setOwnedDestOnly] = useState(true);
  const [sourceSearch, setSourceSearch] = useState("");
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [percent, setPercent] = useState(10);
  const [repeat, setRepeat] = useState(false);
  const [interval, setIntervalMinutes] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!statusMessage) return;
    const t = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [statusMessage]);

  // Prefill from draft (Advanced -> Edit)
  const draft = useTransferPanelDraftStore((s) => s.draft);
  const setDraft = useTransferPanelDraftStore((s) => s.setDraft);
  useEffect(() => {
    if (!draft) return;
    try {
      setSelectedSourceId(Number(draft.sourceEntityId));
      setDestinationId(Number(draft.destinationEntityId));
      setSelectedResources(draft.resourceIds || []);
      setRepeat(true);
      setIntervalMinutes(draft.intervalMinutes);
      // build per-resource configs
      const next: Record<number, { percent: number }> = {};
      if (Array.isArray(draft.resourceConfigs) && draft.resourceConfigs.length > 0) {
        draft.resourceConfigs.forEach((cfg) => {
          next[cfg.resourceId] = {
            percent: Math.min(90, Math.max(5, Math.floor(cfg.percent ?? draft.percent ?? 10))),
          };
        });
      } else {
        // legacy fallback: apply same percent to all
        (draft.resourceIds || []).forEach((rid) => {
          next[rid] = { percent: Math.min(90, Math.max(5, Math.floor(draft.percent ?? 10))) };
        });
      }
      setResourceConfigs(next);
    } finally {
      setDraft(null);
    }
  }, [draft, setDraft]);

  const eligibleSources = useMemo(() => {
    if (!components) return [] as any[];
    if (selectedResources.length === 0) return ownedSources;
    return ownedSources.filter((ps: any) => {
      const rm = new ResourceManager(components as any, ps.entityId);
      for (const rid of selectedResources) {
        const bal = rm.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n;
        if (Number(bal) <= 0) return false;
      }
      return true;
    }).sort((a: any, b: any) => {
      const rma = new ResourceManager(components as any, a.entityId);
      const rmb = new ResourceManager(components as any, b.entityId);
      const suma = selectedResources.reduce((acc, rid) => acc + Number(rma.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n), 0);
      const sumb = selectedResources.reduce((acc, rid) => acc + Number(rmb.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n), 0);
      return sumb - suma;
    });
  }, [components, ownedSources, selectedResources, currentDefaultTick]);

  // Destinations: owned realms + villages (toggle does not affect source list)
  const ownedDestinations = useMemo(() => {
    const allowed = new Set<StructureType>([StructureType.Realm, StructureType.Village]);
    return playerStructures.filter((s: any) => allowed.has(s.structure?.base?.category));
  }, [playerStructures]);

  const [destSearch, setDestSearch] = useState("");
  const destinations = useMemo(() => {
    const base = ownedDestOnly ? ownedDestinations : ownedDestinations; // extend later for public
    const q = destSearch.trim();
    const isNumeric = /^\d+$/.test(q);
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, "");
    let list = base.filter((ps: any) => ps.entityId !== selectedSourceId);
    if (!q) return list;
    return list.filter((ps: any) => {
      const name = getStructureName(ps.structure, isBlitz).name;
      if (isNumeric) {
        return String(ps.entityId).includes(q);
      }
      return norm(name).includes(norm(q));
    });
  }, [ownedDestOnly, ownedDestinations, destSearch, isBlitz, selectedSourceId]);

  // If source equals currently selected destination, clear destination
  useEffect(() => {
    if (destinationId && selectedSourceId === destinationId) {
      setDestinationId(null);
    }
  }, [selectedSourceId]);


  // keep any global percent sanity for draft fallback
  const percentClamped = Math.min(90, Math.max(5, percent));
  useEffect(() => {
    if (percent !== percentClamped) setPercent(percentClamped);
  }, [percent, percentClamped]);

  // Ensure resourceConfigs exist for selected resources and remove stale ones
  useEffect(() => {
    setResourceConfigs((prev) => {
      const next: Record<number, { percent: number }> = {};
      for (const rid of selectedResources) {
        const existing = prev[rid];
        if (existing) {
          next[rid] = existing;
        } else {
          next[rid] = { percent };
        }
      }
      return next;
    });
  }, [selectedResources, percent]);

  // Compute current source balances (human units) for flat slider maxes
  const sourceBalances = useMemo(() => {
    const map = new Map<number, number>();
    if (!components || !selectedSourceId) return map;
    try {
      const rm = new ResourceManager(components as any, selectedSourceId);
      for (const rid of selectedResources) {
        const bal = rm.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n;
        map.set(rid, Math.max(0, Math.floor(Number(bal) / RESOURCE_PRECISION)));
      }
    } catch {}
    return map;
  }, [components, selectedSourceId, selectedResources, currentDefaultTick]);

  // Donkey availability separate to avoid re-computation on slider changes
  const donkeyAvailable = useMemo(() => {
    if (!components || !selectedSourceId) return 0;
    try {
      const rm = new ResourceManager(components as any, selectedSourceId);
      const raw = rm.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey).balance ?? 0n;
      return Math.max(0, Math.floor(Number(raw) / RESOURCE_PRECISION));
    } catch {
      return 0;
    }
  }, [components, selectedSourceId, currentDefaultTick]);

  // Computed preview for percent amounts and donkey capacity (fast path)
  const percentPreview = useMemo(() => {
    if (!selectedSourceId || selectedResources.length === 0) return null as null | {
      perResource: { id: ResourcesIds; humanAmount: number }[];
      totalKg: number;
      donkeys: { have: number; need: number };
    };
    const perResource = selectedResources
      .map((rid) => {
        const available = sourceBalances.get(rid) ?? 0;
        const cfg = resourceConfigs[rid] ?? { percent };
        const amt = Math.floor((Math.min(90, Math.max(5, cfg.percent)) / 100) * available);
        return { id: rid, humanAmount: amt };
      })
      .filter((x) => x.humanAmount > 0);
    const totalKg = getTotalResourceWeightKg(perResource.map((p) => ({ resourceId: p.id, amount: p.humanAmount })));
    const need = calculateDonkeysNeeded(totalKg);
    return { perResource, totalKg, donkeys: { have: donkeyAvailable, need } };
  }, [selectedSourceId, selectedResources, resourceConfigs, percent, sourceBalances, donkeyAvailable]);

  const addScheduled = useTransferAutomationStore((s) => s.add);

  const submit = useCallback(async () => {
    if (!components) return;
    if (!account || !account.address || account.address === "0x0") {
      toast.error("Connect wallet to transfer.");
      return;
    }
    if (selectedResources.length === 0) {
      toast.error("Select at least one resource.");
      return;
    }
    if (!selectedSourceId) {
      toast.error("Select a source location.");
      return;
    }
    if (!destinationId) {
      toast.error("Select a destination.");
      return;
    }

    // Military rule: if any military, enforce Realm->Realm
    const hasMilitary = selectedResources.some((rid) => isMilitaryResource(rid));

    if (hasMilitary) {
      const src = ownedSources.find((s: any) => s.entityId === selectedSourceId);
      const dst = destinations.find((d: any) => d.entityId === destinationId);
      if (!src || !dst || src.structure?.base?.category !== StructureType.Realm || dst.structure?.base?.category !== StructureType.Realm) {
        toast.error("Troops can only be transferred Realm ↔ Realm.");
        return;
      }
    }

    // donkey block
    if (percentPreview && percentPreview.donkeys.have < percentPreview.donkeys.need) {
      toast.error("Insufficient donkeys at source.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    if (!repeat) {
      // one-off: call send_resources_multiple
      try {
        const rm = new ResourceManager(components as any, selectedSourceId);
        const per = selectedResources
          .map((rid) => {
            const bal = rm.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n;
            const human = Number(bal) / RESOURCE_PRECISION;
            const cfg = resourceConfigs[rid] ?? { percent };
            const amt = Math.floor((Math.min(90, Math.max(5, cfg.percent)) / 100) * human);
            return { rid, amt };
          })
          .filter((x) => x.amt > 0);
        if (per.length === 0) {
          toast.error("Nothing to send.");
          return;
        }
        const resources: (bigint | number)[] = [];
        per.forEach((p) => {
          resources.push(p.rid, BigInt(p.amt * RESOURCE_PRECISION));
        });
        await systemCalls.send_resources_multiple({
          signer: account,
          calls: [
            {
              sender_entity_id: BigInt(selectedSourceId),
              recipient_entity_id: BigInt(destinationId),
              resources,
            },
          ],
        });
        toast.success("Transfer sent.");
        setStatusMessage("Transfer started");
      } catch (e) {
        console.error(e);
        toast.error("Transfer failed.");
        setStatusMessage("Transfer failed");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // repeat: execute now, then persist entry
    const src = ownedSources.find((s: any) => s.entityId === selectedSourceId);
    const dst = destinations.find((d: any) => d.entityId === destinationId);

    try {
      const rm = new ResourceManager(components as any, selectedSourceId);
      const immediatePer = selectedResources
        .map((rid) => {
          const bal = rm.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n;
          const human = Number(bal) / RESOURCE_PRECISION;
          const cfg = resourceConfigs[rid] ?? { percent };
          const amt = Math.floor((Math.min(90, Math.max(5, cfg.percent)) / 100) * human);
          return { rid, amt };
        })
        .filter((x) => x.amt > 0);
      if (immediatePer.length > 0) {
        const resourcesNow: (bigint | number)[] = [];
        immediatePer.forEach((p) => resourcesNow.push(p.rid, BigInt(p.amt * RESOURCE_PRECISION)));
        await systemCalls.send_resources_multiple({
          signer: account,
          calls: [
            {
              sender_entity_id: BigInt(selectedSourceId),
              recipient_entity_id: BigInt(destinationId),
              resources: resourcesNow,
            },
          ],
        });
        toast.success("Transfer sent and scheduled.");
        setStatusMessage("Transfer started and scheduled");
      } else {
        toast.warning("Nothing to send now. Scheduling for later.");
        setStatusMessage("Scheduled for later");
      }
    } catch (e) {
      console.error(e);
      toast.error("Immediate run failed. Scheduled for later.");
      setStatusMessage("Scheduled; immediate run failed");
    }

    addScheduled({
      sourceEntityId: String(selectedSourceId),
      sourceName: src ? getStructureName(src.structure, isBlitz).name : undefined,
      destinationEntityId: String(destinationId),
      destinationName: dst ? getStructureName(dst.structure, isBlitz).name : undefined,
      resourceIds: selectedResources,
      resourceConfigs: selectedResources.map((rid) => ({
        resourceId: rid,
        percent: resourceConfigs[rid]?.percent ?? percent,
      })),
      intervalMinutes: interval,
      active: true,
    });
    toast.success("Scheduled transfer created.");
    setIsSubmitting(false);
  }, [components, account, selectedResources, selectedSourceId, destinationId, percent, repeat, interval, ownedSources, destinations, addScheduled, currentDefaultTick, percentPreview, isBlitz]);

  const openAdvanced = useCallback(() => {
    toggleModal(<TransferAutomationAdvancedModal onClose={() => toggleModal(null)} />);
  }, [toggleModal]);

  return (
    <div className="p-3 md:p-4 space-y-3">
      <div>
        <h4 className="text-gold font-semibold">Transfer</h4>
        <p className="text-xxs text-gold/60">Select resources, source, destination and frequency.</p>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gold/70">Resources</div>
          <div className="flex items-center gap-1 rounded-full border border-gold/40 bg-brown/40 px-1 py-0.5 text-xxs font-semibold uppercase tracking-widest">
            <button
              type="button"
              onClick={() => setResourceFilter("all")}
              className={`rounded-full px-2 py-0.5 ${resourceFilter === "all" ? "bg-gold text-brown" : "text-gold/70 hover:text-gold"}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setResourceFilter("production")}
              className={`rounded-full px-2 py-0.5 ${resourceFilter === "production" ? "bg-gold text-brown" : "text-gold/70 hover:text-gold"}`}
            >
              Production
            </button>
            <button
              type="button"
              onClick={() => setResourceFilter("military")}
              className={`rounded-full px-2 py-0.5 ${resourceFilter === "military" ? "bg-gold text-brown" : "text-gold/70 hover:text-gold"}`}
            >
              Military
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from(availableResources)
            .filter((rid: any) => {
              if (resourceFilter === "military") return isMilitaryResource(rid as ResourcesIds);
              if (resourceFilter === "production") return !isMilitaryResource(rid as ResourcesIds);
              return true;
            })
            .sort((a: any, b: any) => a - b)
            .map((rid: ResourcesIds) => {
            const sel = selectedResources.includes(rid);
            const totalHuman = resourceTotals.get(rid) ?? 0;
            return (
              <button
                key={rid}
                type="button"
                onClick={() =>
                  setSelectedResources((prev) => (prev.includes(rid) ? prev.filter((r) => r !== rid) : [...prev, rid]))
                }
                className={`px-2 py-1 rounded border text-xs flex items-center gap-1 ${sel ? "border-gold text-gold bg-gold/10" : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold"}`}
                title={ResourcesIds[rid] as string}
              >
                <ResourceIcon resource={ResourcesIds[rid]} size="xs" />
                {ResourcesIds[rid]} <span className="text-[10px] text-gold/60">({totalHuman.toLocaleString()})</span>
              </button>
            );
          })
          }
        </div>
      </section>

      {selectedResources.length > 0 && (
      <section className="space-y-2">
        <div className="text-xs text-gold/70">Source Location</div>
        <input
          type="text"
          value={sourceSearch}
          onChange={(e) => setSourceSearch(e.target.value)}
          placeholder="Filter by name or ID"
          className="w-full px-2 py-1 text-xs rounded border border-gold/30 bg-black/30 text-gold/80 placeholder:text-gold/40 focus:border-gold/60 outline-none mb-2"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {eligibleSources
            .filter((ps: any) => {
              const q = sourceSearch.trim();
              if (!q) return true;
              const isNumeric = /^\d+$/.test(q);
              const name = getStructureName(ps.structure, isBlitz).name;
              if (isNumeric) return String(ps.entityId).includes(q);
              const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return norm(name).includes(norm(q));
            })
            .map((ps: any) => {
            const name = getStructureName(ps.structure, isBlitz).name;
            const isSel = selectedSourceId === ps.entityId;
            return (
              <button
                key={ps.entityId}
                type="button"
                className={`text-left px-2 py-2 rounded border ${isSel ? "border-gold text-gold bg-gold/10" : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold"}`}
                onClick={() => setSelectedSourceId(selectedSourceId === ps.entityId ? null : ps.entityId)}
              >
                <div className="text-sm font-semibold">{name}</div>
                <div className="text-xxs uppercase text-gold/60">{StructureType[ps.structure?.base?.category]}</div>
              </button>
            );
          })}
        </div>
      </section>
      )}

      {selectedResources.length > 0 && selectedSourceId && (
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gold/70">Destination</div>
          <label className="text-xxs text-gold/60 flex items-center gap-2">
            <input type="checkbox" checked={ownedDestOnly} onChange={(e) => setOwnedDestOnly(e.target.checked)} />
            Owned only
          </label>
        </div>
        <input
          type="text"
          value={destSearch}
          onChange={(e) => setDestSearch(e.target.value)}
          placeholder="Filter by name or ID"
          className="w-full px-2 py-1 text-xs rounded border border-gold/30 bg-black/30 text-gold/80 placeholder:text-gold/40 focus:border-gold/60 outline-none mb-2"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {destinations.map((ps: any) => {
            const name = getStructureName(ps.structure, isBlitz).name;
            const isSel = destinationId === ps.entityId;
            return (
              <button
                key={`dst-${ps.entityId}`}
                type="button"
                className={`text-left px-2 py-2 rounded border ${isSel ? "border-gold text-gold bg-gold/10" : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold"}`}
                onClick={() => setDestinationId(destinationId === ps.entityId ? null : ps.entityId)}
              >
                <div className="text-sm font-semibold">{name}</div>
                <div className="text-xxs uppercase text-gold/60">{StructureType[ps.structure?.base?.category]}</div>
              </button>
            );
          })}
        </div>
      </section>
      )}

      {selectedResources.length > 0 && selectedSourceId && (
      <section className="space-y-2">
        <div className="text-xs text-gold/70">Per-resource Amounts</div>
        <div className="grid grid-cols-3 gap-2">
          {selectedResources.map((rid) => {
            const cfg = resourceConfigs[rid] ?? { percent };
            const available = sourceBalances.get(rid) ?? 0;
            const willSend = Math.floor((Math.min(90, Math.max(5, cfg.percent)) / 100) * available);
            return (
              <div key={`cfg-${rid}`} className="rounded border border-gold/20 bg-black/20 p-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-xs text-gold/80">
                    <ResourceIcon resource={ResourcesIds[rid]} size="xs" />
                    <div className="font-semibold">{ResourcesIds[rid]}</div>
                  </div>
                  <div className="text-xxs text-gold/60">Avail: {available.toLocaleString()}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xxs text-gold/60">{cfg.percent}%</div>
                    <div className="text-xxs text-gold/60">Will send: {willSend.toLocaleString()}</div>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={90}
                    step={5}
                    value={cfg.percent}
                    onChange={(e) => setResourceConfigs((prev) => ({ ...prev, [rid]: { percent: Math.min(90, Math.max(5, parseInt(e.target.value))) } }))}
                    className="w-full accent-gold"
                  />
                </div>
              </div>
            );
          })}
        </div>
        {percentPreview && (
          <div className="text-xxs text-gold/60">
            {percentPreview.perResource.map((p) => (
              <span key={p.id} className="mr-2">{p.humanAmount.toLocaleString()} {ResourcesIds[p.id]} </span>
            ))}
            <span
              className={
                percentPreview.donkeys.need > percentPreview.donkeys.have
                  ? "text-danger/80"
                  : "text-gold/70"
              }
            >
              • Donkeys {percentPreview.donkeys.need.toLocaleString()} used / {percentPreview.donkeys.have.toLocaleString()} available
            </span>
          </div>
        )}

        {percentPreview && percentPreview.donkeys.need > percentPreview.donkeys.have && (
          <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger/80">
            <span>
              Insufficient donkeys at source to carry this transfer. Reduce the load or add more donkeys.
            </span>
          </div>
        )}
      </section>
      )}

      {selectedResources.length > 0 && selectedSourceId && (
      <section className="space-y-2">
        <div className="flex items-center gap-4 text-xs text-gold/70">
          <label className="flex items-center gap-2">
            <input type="radio" name="freq" checked={!repeat} onChange={() => setRepeat(false)} /> One-off
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="freq" checked={repeat} onChange={() => setRepeat(true)} /> Repeat
          </label>
        </div>
        {repeat && (
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gold/70">Interval</div>
              <div className="text-xxs text-gold/60">{interval} min</div>
            </div>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={interval}
              onChange={(e) => setIntervalMinutes(parseInt(e.target.value))}
              className="w-full accent-gold"
            />
          </div>
          )}
      </section>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gold/20">
        <div className="flex items-center gap-3">
          {selectedResources.length > 0 && selectedSourceId && (
            <>
              <Button
                variant="primary"
                size="md"
                onClick={submit}
                isLoading={isSubmitting}
                disabled={
                  isSubmitting ||
                  selectedResources.length === 0 ||
                  !selectedSourceId ||
                  !destinationId ||
                  (percentPreview ? percentPreview.donkeys.need > percentPreview.donkeys.have : false)
                }
              >
                {repeat ? "Schedule" : "Transfer"}
              </Button>
              {statusMessage && (
                <span className="text-xxs text-gold/70">{statusMessage}</span>
              )}
            </>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={openAdvanced}>Advanced</Button>
      </div>
    </div>
  );
};
