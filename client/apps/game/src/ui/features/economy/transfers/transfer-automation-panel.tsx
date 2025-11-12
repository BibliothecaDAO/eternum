import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useTransferAutomationStore } from "@/hooks/store/use-transfer-automation-store";
import { useTransferPanelDraftStore } from "@/hooks/store/use-transfer-panel-draft-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import {
  calculateDonkeysNeeded,
  configManager,
  getIsBlitz,
  getStructureName,
  getTotalResourceWeightKg,
  isMilitaryResource,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { CapacityConfig, RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TransferAutomationAdvancedModal } from "./transfer-automation-modal";

const ALL_RESOURCE_IDS = Object.values(ResourcesIds).filter((v) => typeof v === "number") as ResourcesIds[];
const ESSENCE_SITE_ALLOWED_RESOURCES = new Set<ResourcesIds>([ResourcesIds.Donkey, ResourcesIds.Essence]);

export const TransferAutomationPanel = () => {
  const playerStructures = useUIStore((s) => s.playerStructures);
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
      const category = ps.structure?.base?.category;
      for (const rid of ALL_RESOURCE_IDS) {
        try {
          if (isMilitaryResource(rid) && category !== StructureType.Realm) {
            continue;
          }
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
  const [resourceConfigs, setResourceConfigs] = useState<Record<number, { amount: number }>>({});
  const [resourceFilter, setResourceFilter] = useState<"all" | "production" | "military">("all");
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [ownedDestOnly, setOwnedDestOnly] = useState(true);
  const [sourceSearch, setSourceSearch] = useState("");
  const [destinationIds, setDestinationIds] = useState<number[]>([]);
  const [repeat, setRepeat] = useState(false);
  const [interval, setIntervalMinutes] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const allowMultiDestination = selectedResources.length === 1;
  const actualDestinationCount = allowMultiDestination ? destinationIds.length : Math.min(destinationIds.length, 1);
  const destinationCountForLimits = allowMultiDestination ? Math.max(1, destinationIds.length || 1) : 1;

  const hasMilitarySelection = useMemo(
    () => selectedResources.some((rid) => isMilitaryResource(rid)),
    [selectedResources],
  );

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

    const sourceId = Number(draft.sourceEntityId);
    setSelectedSourceId(sourceId);
    const draftDestinationId = Number(draft.destinationEntityId);
    setDestinationIds(Number.isFinite(draftDestinationId) ? [draftDestinationId] : []);
    setSelectedResources(draft.resourceIds || []);
    setRepeat(true);
    setIntervalMinutes(draft.intervalMinutes);

    if (!components) return;

    try {
      const next: Record<number, { amount: number }> = {};
      if (Array.isArray(draft.resourceConfigs) && draft.resourceConfigs.length > 0) {
        draft.resourceConfigs.forEach((cfg) => {
          const rid = cfg.resourceId as ResourcesIds;
          next[rid] = { amount: Math.max(0, Math.floor((cfg as any).amount ?? 0)) };
        });
      } else {
        (draft.resourceIds || []).forEach((rid) => {
          next[rid as ResourcesIds] = { amount: 0 };
        });
      }
      setResourceConfigs(next);
    } catch {
      const next: Record<number, { amount: number }> = {};
      (draft.resourceIds || []).forEach((rid) => {
        next[rid as ResourcesIds] = { amount: 0 };
      });
      setResourceConfigs(next);
    } finally {
      setDraft(null);
    }
  }, [draft, setDraft]);

  const filteredOwnedSources = useMemo(() => {
    if (!hasMilitarySelection) return ownedSources;
    return ownedSources.filter((ps: any) => ps.structure?.base?.category === StructureType.Realm);
  }, [ownedSources, hasMilitarySelection]);

  const eligibleSources = useMemo(() => {
    if (!components) return filteredOwnedSources as any[];
    if (selectedResources.length === 0) return filteredOwnedSources as any[];
    return filteredOwnedSources
      .filter((ps: any) => {
        const rm = new ResourceManager(components as any, ps.entityId);
        for (const rid of selectedResources) {
          const bal = rm.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n;
          if (Number(bal) <= 0) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => {
        const rma = new ResourceManager(components as any, a.entityId);
        const rmb = new ResourceManager(components as any, b.entityId);
        const suma = selectedResources.reduce(
          (acc, rid) => acc + Number(rma.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n),
          0,
        );
        const sumb = selectedResources.reduce(
          (acc, rid) => acc + Number(rmb.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n),
          0,
        );
        return sumb - suma;
      });
  }, [components, filteredOwnedSources, selectedResources, currentDefaultTick]);

  const selectedSource = useMemo(() => {
    if (!selectedSourceId) return null;
    return ownedSources.find((ps: any) => ps.entityId === selectedSourceId) ?? null;
  }, [ownedSources, selectedSourceId]);

  // Destinations: owned realms + villages (toggle does not affect source list)
  const ownedDestinations = useMemo(() => {
    // Essence rifts share the FragmentMine category, so include it to enable donkey transfers to rifts.
    const allowed = new Set<StructureType>([StructureType.Realm, StructureType.Village, StructureType.FragmentMine]);
    return playerStructures.filter((s: any) => allowed.has(s.structure?.base?.category));
  }, [playerStructures]);

  const filteredOwnedDestinations = useMemo(() => {
    if (!hasMilitarySelection) return ownedDestinations;
    return ownedDestinations.filter((ps: any) => ps.structure?.base?.category === StructureType.Realm);
  }, [ownedDestinations, hasMilitarySelection]);

  const destinationLookup = useMemo(() => {
    const map = new Map<number, any>();
    ownedDestinations.forEach((ps: any) => {
      map.set(ps.entityId, ps);
    });
    return map;
  }, [ownedDestinations]);

  const [destSearch, setDestSearch] = useState("");
  const allowEssenceDestinationPayload = useMemo(
    () => selectedResources.every((rid) => ESSENCE_SITE_ALLOWED_RESOURCES.has(rid)),
    [selectedResources],
  );

  const destinations = useMemo(() => {
    const baseList = ownedDestOnly ? filteredOwnedDestinations : filteredOwnedDestinations; // extend later for public
    const q = destSearch.trim();
    const isNumeric = /^\d+$/.test(q);
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, "");
    let list = baseList
      .filter((ps: any) => ps.entityId !== selectedSourceId)
      .filter((ps: any) =>
        allowEssenceDestinationPayload ? true : ps.structure?.base?.category !== StructureType.FragmentMine,
      );
    if (!q) return list;
    return list.filter((ps: any) => {
      const name = getStructureName(ps.structure, isBlitz).name;
      if (isNumeric) {
        return String(ps.entityId).includes(q);
      }
      return norm(name).includes(norm(q));
    });
  }, [ownedDestOnly, filteredOwnedDestinations, destSearch, isBlitz, selectedSourceId, allowEssenceDestinationPayload]);

  // Force single destination selection when multiple resources are selected
  useEffect(() => {
    if (allowMultiDestination) return;
    setDestinationIds((prev) => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, 1);
    });
  }, [allowMultiDestination]);

  // If source equals currently selected destination, clear that destination
  useEffect(() => {
    if (!selectedSourceId) return;
    setDestinationIds((prev) => {
      if (!prev.includes(selectedSourceId)) return prev;
      return prev.filter((id) => id !== selectedSourceId);
    });
  }, [selectedSourceId]);

  useEffect(() => {
    if (!hasMilitarySelection) return;
    if (!selectedSourceId) return;
    const stillAllowed = filteredOwnedSources.some((ps: any) => ps.entityId === selectedSourceId);
    if (!stillAllowed) {
      setSelectedSourceId(null);
    }
  }, [hasMilitarySelection, selectedSourceId, filteredOwnedSources]);

  useEffect(() => {
    if (!hasMilitarySelection && allowEssenceDestinationPayload) return;
    const allowedIds = new Set(
      filteredOwnedDestinations
        .filter((ps: any) => {
          const category = ps.structure?.base?.category;
          if (hasMilitarySelection && category !== StructureType.Realm) return false;
          if (!allowEssenceDestinationPayload && category === StructureType.FragmentMine) return false;
          return true;
        })
        .map((ps: any) => ps.entityId),
    );
    setDestinationIds((prev) => {
      const next = prev.filter((id) => allowedIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [hasMilitarySelection, allowEssenceDestinationPayload, filteredOwnedDestinations]);

  // Ensure resourceConfigs exist for selected resources and remove stale ones
  useEffect(() => {
    setResourceConfigs((prev) => {
      const next: Record<number, { amount: number }> = {};
      for (const rid of selectedResources) {
        const existing = prev[rid];
        if (existing) {
          next[rid] = existing;
        } else {
          next[rid] = { amount: 0 };
        }
      }
      return next;
    });
  }, [selectedResources]);

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

  const donkeyCapacityKgPerUnit = useMemo(() => {
    try {
      return configManager.getCapacityConfigKg(CapacityConfig.Donkey);
    } catch {
      return 0;
    }
  }, []);

  const restrictToEssencePayload = selectedSource?.structure?.base?.category === StructureType.FragmentMine;

  const hasRestrictedResourcesSelected = useMemo(
    () =>
      Boolean(restrictToEssencePayload && selectedResources.some((rid) => !ESSENCE_SITE_ALLOWED_RESOURCES.has(rid))),
    [restrictToEssencePayload, selectedResources],
  );

  useEffect(() => {
    if (!hasRestrictedResourcesSelected) return;
    setSelectedResources((prev) => {
      const filtered = prev.filter((rid) => ESSENCE_SITE_ALLOWED_RESOURCES.has(rid));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [hasRestrictedResourcesSelected]);

  useEffect(() => {
    if (selectedResources.length === 0) return;
    setResourceConfigs((prev) => {
      let mutated = false;
      const next = { ...prev };
      for (const rid of selectedResources) {
        const existing = prev[rid];
        if (!existing) continue;
        const available = sourceBalances.get(rid) ?? 0;
        let weightPerUnit = 0;
        try {
          weightPerUnit = configManager.getResourceWeightKg(rid as ResourcesIds);
        } catch {
          weightPerUnit = 0;
        }
        const totalCarryKg = donkeyCapacityKgPerUnit * donkeyAvailable;
        const donkeyLimited = weightPerUnit > 0 ? Math.floor(totalCarryKg / weightPerUnit) : available;
        const perDestinationResourceCap = Math.floor(available / destinationCountForLimits);
        const perDestinationDonkeyCap = Math.floor(donkeyLimited / destinationCountForLimits);
        const maxAmount = Math.max(0, Math.min(perDestinationResourceCap, perDestinationDonkeyCap));
        const desired = Math.max(0, Math.floor(existing.amount ?? 0));
        const clamped = Math.max(0, Math.min(maxAmount, desired));
        if (clamped !== desired) {
          next[rid] = { amount: clamped };
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [selectedResources, sourceBalances, donkeyAvailable, donkeyCapacityKgPerUnit, destinationCountForLimits]);

  // Computed preview for absolute amounts and donkey capacity (fast path)
  const transferPreview = useMemo(() => {
    if (!selectedSourceId || selectedResources.length === 0)
      return null as null | {
        perResource: { id: ResourcesIds; humanAmount: number }[];
        totalKg: number;
        donkeys: { have: number; need: number };
      };
    const perResource = selectedResources
      .map((rid) => {
        const available = sourceBalances.get(rid) ?? 0;
        const cfg = resourceConfigs[rid] ?? { amount: 0 };
        const amt = Math.max(0, Math.min(available, Math.floor(cfg.amount)));
        return { id: rid, humanAmount: amt };
      })
      .filter((x) => x.humanAmount > 0);
    const totalKg = getTotalResourceWeightKg(perResource.map((p) => ({ resourceId: p.id, amount: p.humanAmount })));
    const need = calculateDonkeysNeeded(totalKg);
    return { perResource, totalKg, donkeys: { have: donkeyAvailable, need } };
  }, [selectedSourceId, selectedResources, resourceConfigs, sourceBalances, donkeyAvailable]);

  const addScheduled = useTransferAutomationStore((s) => s.add);

  const toggleDestinationSelection = useCallback(
    (entityId: number) => {
      setDestinationIds((prev) => {
        const exists = prev.includes(entityId);
        if (allowMultiDestination) {
          return exists ? prev.filter((id) => id !== entityId) : [...prev, entityId];
        }
        return exists ? [] : [entityId];
      });
    },
    [allowMultiDestination],
  );

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

    const resolvedDestinationIds = allowMultiDestination ? destinationIds : destinationIds.slice(0, 1);

    if (resolvedDestinationIds.length === 0) {
      toast.error("Select at least one destination.");
      return;
    }

    const resolvedDestinations = resolvedDestinationIds.map((id) => destinationLookup.get(id)).filter(Boolean) as any[];

    if (resolvedDestinations.length !== resolvedDestinationIds.length) {
      toast.error("Selected destination is no longer available.");
      return;
    }

    const hasMilitary = selectedResources.some((rid) => isMilitaryResource(rid));

    if (hasMilitary) {
      const src = ownedSources.find((s: any) => s.entityId === selectedSourceId);
      const invalid = resolvedDestinations.some(
        (dst: any) =>
          !dst ||
          !src ||
          src.structure?.base?.category !== StructureType.Realm ||
          dst.structure?.base?.category !== StructureType.Realm,
      );
      if (invalid) {
        toast.error("Troops can only be transferred Realm ↔ Realm.");
        return;
      }
    }

    const essenceDestinationInvalid =
      !allowEssenceDestinationPayload &&
      resolvedDestinations.some((dst: any) => dst.structure?.base?.category === StructureType.FragmentMine);
    if (essenceDestinationInvalid) {
      toast.error("Essence rifts only accept Donkeys and Essence.");
      return;
    }

    if (!transferPreview) {
      toast.error("Unable to compute transfer amounts.");
      return;
    }

    const perTransferDonkeyNeed = transferPreview.donkeys.need;
    const totalDonkeysNeeded = perTransferDonkeyNeed * resolvedDestinationIds.length;
    if (resolvedDestinationIds.length > 0 && transferPreview.donkeys.have < totalDonkeysNeeded) {
      toast.error("Insufficient donkeys at source.");
      return;
    }

    const currentAmounts = transferPreview.perResource;
    if (currentAmounts.length === 0) {
      toast.error("Nothing to send.");
      return;
    }

    const buildResourcePayload = () => {
      const payload: (bigint | number)[] = [];
      currentAmounts.forEach((p) => {
        payload.push(p.id, BigInt(p.humanAmount * RESOURCE_PRECISION));
      });
      return payload;
    };

    setIsSubmitting(true);
    setStatusMessage(null);

    if (!repeat) {
      try {
        const baseResources = buildResourcePayload();
        const calls = resolvedDestinationIds.map((id) => ({
          sender_entity_id: BigInt(selectedSourceId),
          recipient_entity_id: BigInt(id),
          resources: [...baseResources],
        }));
        await systemCalls.send_resources_multiple({
          signer: account,
          calls,
        });
        toast.success(resolvedDestinationIds.length > 1 ? "Transfers sent." : "Transfer sent.");
        setStatusMessage(resolvedDestinationIds.length > 1 ? "Transfers started" : "Transfer started");
      } catch (e) {
        console.error(e);
        toast.error("Transfer failed.");
        setStatusMessage("Transfer failed");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const src = ownedSources.find((s: any) => s.entityId === selectedSourceId);

    let immediateRunTimestamp: number | undefined;
    try {
      if (currentAmounts.length > 0) {
        const baseResources = buildResourcePayload();
        const calls = resolvedDestinationIds.map((id) => ({
          sender_entity_id: BigInt(selectedSourceId),
          recipient_entity_id: BigInt(id),
          resources: [...baseResources],
        }));
        await systemCalls.send_resources_multiple({
          signer: account,
          calls,
        });
        immediateRunTimestamp = Date.now();
        toast.success(
          resolvedDestinationIds.length > 1 ? "Transfers sent and scheduled." : "Transfer sent and scheduled.",
        );
        setStatusMessage(
          resolvedDestinationIds.length > 1 ? "Transfers started and scheduled" : "Transfer started and scheduled",
        );
      } else {
        toast.warning("Nothing to send now. Scheduling for later.");
        setStatusMessage("Scheduled for later");
      }
    } catch (e) {
      console.error(e);
      toast.error("Immediate run failed. Scheduled for later.");
      setStatusMessage("Scheduled; immediate run failed");
    }

    const configsForEntry = selectedResources
      .map((rid) => ({
        resourceId: rid,
        amount: Math.max(0, Math.floor(resourceConfigs[rid]?.amount ?? 0)),
      }))
      .filter((cfg) => cfg.amount > 0);

    resolvedDestinationIds.forEach((id) => {
      const dst = destinationLookup.get(id);
      addScheduled({
        sourceEntityId: String(selectedSourceId),
        sourceName: src ? getStructureName(src.structure, isBlitz).name : undefined,
        destinationEntityId: String(id),
        destinationName: dst ? getStructureName(dst.structure, isBlitz).name : undefined,
        resourceIds: configsForEntry.map((cfg) => cfg.resourceId),
        resourceConfigs: configsForEntry,
        intervalMinutes: interval,
        active: true,
        lastRunAt: immediateRunTimestamp,
      });
    });
    toast.success(resolvedDestinationIds.length > 1 ? "Scheduled transfers created." : "Scheduled transfer created.");
    setIsSubmitting(false);
  }, [
    components,
    account,
    selectedResources,
    selectedSourceId,
    destinationIds,
    repeat,
    interval,
    ownedSources,
    addScheduled,
    transferPreview,
    isBlitz,
    resourceConfigs,
    systemCalls,
    destinationLookup,
    allowMultiDestination,
    allowEssenceDestinationPayload,
  ]);

  const perTransferDonkeyNeed = transferPreview?.donkeys.need ?? 0;
  const aggregatedDonkeyNeed =
    transferPreview && actualDestinationCount > 0
      ? transferPreview.donkeys.need * actualDestinationCount
      : perTransferDonkeyNeed;
  const donkeyShortage = Boolean(
    transferPreview && actualDestinationCount > 0 && transferPreview.donkeys.have < aggregatedDonkeyNeed,
  );

  const resetPanel = useCallback(() => {
    setSelectedResources([]);
    setResourceConfigs({});
    setResourceFilter("all");
    setSelectedSourceId(null);
    setOwnedDestOnly(true);
    setSourceSearch("");
    setDestinationIds([]);
    setDestSearch("");
    setRepeat(false);
    setIntervalMinutes(30);
    setStatusMessage(null);
  }, []);

  const openAdvanced = useCallback(() => {
    toggleModal(<TransferAutomationAdvancedModal />);
  }, [toggleModal]);

  return (
    <div className="p-3 md:p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-gold font-semibold">Transfer</h4>
          <p className="text-xxs text-gold/60">Select resources, source, destination and frequency.</p>
        </div>
        <Button variant="outline" size="xs" forceUppercase={false} onClick={resetPanel}>
          Reset
        </Button>
      </div>

      <section className="space-y-2">
        <div className="flex items-center">
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
        {restrictToEssencePayload && (
          <p className="text-xxs text-gold/60">Essence rifts can only transfer Donkeys and Essence.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {Array.from(availableResources)
            .filter((rid: any) => {
              if (restrictToEssencePayload && !ESSENCE_SITE_ALLOWED_RESOURCES.has(rid as ResourcesIds)) {
                return false;
              }
              if (resourceFilter === "military") return isMilitaryResource(rid as ResourcesIds);
              if (resourceFilter === "production") return !isMilitaryResource(rid as ResourcesIds);
              return true;
            })
            .sort((a: any, b: any) => a - b)
            .map((rid: any) => {
              const sel = selectedResources.includes(rid);
              const totalHuman = resourceTotals.get(rid) ?? 0;
              return (
                <button
                  key={rid}
                  type="button"
                  onClick={() =>
                    setSelectedResources((prev) =>
                      prev.includes(rid) ? prev.filter((r) => r !== rid) : [...prev, rid],
                    )
                  }
                  className={`px-2 py-1 rounded border text-xs flex items-center gap-1 ${sel ? "border-gold text-gold bg-gold/10" : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold"}`}
                  title={ResourcesIds[rid] as string}
                >
                  <ResourceIcon resource={ResourcesIds[rid]} size="xs" />
                  {ResourcesIds[rid]} <span className="text-[10px] text-gold/60">({totalHuman.toLocaleString()})</span>
                </button>
              );
            })}
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
                const norm = (s: string) =>
                  s
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-gold/70">
              Destination
              {allowMultiDestination && actualDestinationCount > 0 ? ` (${actualDestinationCount} selected)` : ""}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xxs text-gold/60">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={ownedDestOnly} onChange={(e) => setOwnedDestOnly(e.target.checked)} />
                Owned only
              </label>
            </div>
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
              const isSel = destinationIds.includes(ps.entityId);
              return (
                <button
                  key={`dst-${ps.entityId}`}
                  type="button"
                  className={`text-left px-2 py-2 rounded border ${isSel ? "border-gold text-gold bg-gold/10" : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold"}`}
                  onClick={() => toggleDestinationSelection(ps.entityId)}
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
          <div className="flex flex-col gap-1 text-xs text-gold/70">
            <div>
              Per-resource Amounts
              {allowMultiDestination && actualDestinationCount > 1 && (
                <span className="ml-1 text-xxs text-gold/50">(per destination)</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {selectedResources.map((rid) => {
              const cfg = resourceConfigs[rid] ?? { amount: 0 };
              const available = sourceBalances.get(rid) ?? 0;
              let weightPerUnit = 0;
              try {
                weightPerUnit = configManager.getResourceWeightKg(rid as ResourcesIds);
              } catch {
                weightPerUnit = 0;
              }
              const totalCarryKg = donkeyCapacityKgPerUnit * donkeyAvailable;
              const donkeyLimited = weightPerUnit > 0 ? Math.floor(totalCarryKg / weightPerUnit) : available;
              const perDestinationResourceCap = Math.floor(available / destinationCountForLimits);
              const perDestinationDonkeyCap = Math.floor(donkeyLimited / destinationCountForLimits);
              const maxAmount = Math.max(0, Math.min(perDestinationResourceCap, perDestinationDonkeyCap));
              const selectedAmount = Math.max(0, Math.min(maxAmount, Math.floor(cfg.amount ?? 0)));
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
                    <div className="flex items-center justify-between mb-1 text-xxs text-gold/60">
                      <span>
                        Selected: {selectedAmount.toLocaleString()} / {maxAmount.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        className="text-gold hover:text-white"
                        onClick={() =>
                          setResourceConfigs((prev) => ({
                            ...prev,
                            [rid]: { amount: maxAmount },
                          }))
                        }
                        disabled={maxAmount === 0}
                      >
                        Max
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, maxAmount)}
                      step={1}
                      value={selectedAmount}
                      onChange={(e) => {
                        const rawValue = Number.parseInt(e.target.value, 10);
                        const nextValue = Number.isFinite(rawValue) ? rawValue : 0;
                        setResourceConfigs((prev) => ({
                          ...prev,
                          [rid]: { amount: Math.max(0, Math.min(maxAmount, nextValue)) },
                        }));
                      }}
                      className="w-full accent-gold"
                      disabled={maxAmount === 0}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {transferPreview && (
            <div className="space-y-1 text-xxs text-gold/60">
              <span className={donkeyShortage ? "text-danger/80" : "text-gold/70"}>
                Donkeys {aggregatedDonkeyNeed.toLocaleString()} used / {transferPreview.donkeys.have.toLocaleString()}{" "}
                available
              </span>
            </div>
          )}

          {transferPreview && donkeyShortage && (
            <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger/80">
              <span>
                Insufficient donkeys to cover all selected destinations. Reduce the load or add more donkeys at the
                source.
              </span>
            </div>
          )}
        </section>
      )}

      {selectedResources.length > 0 && selectedSourceId && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-xs text-gold/70">
            <label className="flex items-center gap-2">
              <input type="radio" name="freq" checked={!repeat} onChange={() => setRepeat(false)} /> One-off
            </label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="freq" checked={repeat} onChange={() => setRepeat(true)} /> Repeat
              </label>
              {repeat && (
                <>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    step={1}
                    value={interval}
                    onChange={(e) => setIntervalMinutes(parseInt(e.target.value, 10))}
                    className="w-32 accent-gold"
                  />
                  <span className="text-xxs text-gold/60 w-12 text-right">{interval} min</span>
                </>
              )}
            </div>
          </div>
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
                  actualDestinationCount === 0 ||
                  donkeyShortage
                }
              >
                {repeat ? "Schedule" : "Transfer"}
              </Button>
              {statusMessage && <span className="text-xxs text-gold/70">{statusMessage}</span>}
            </>
          )}
        </div>
        <Button variant="outline" onClick={openAdvanced}>
          Advanced
        </Button>
      </div>
    </div>
  );
};
