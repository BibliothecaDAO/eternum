import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useTransferAutomationStore } from "@/hooks/store/use-transfer-automation-store";
import { useTransferPanelDraftStore } from "@/hooks/store/use-transfer-panel-draft-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
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
import {
  CapacityConfig,
  ClientComponents,
  RESOURCE_PRECISION,
  ResourcesIds,
  Structure,
  StructureType,
  getResourceTiers,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Castle, Crown, Pickaxe, Sparkles, Star, Tent } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const ESSENCE_SITE_ALLOWED_RESOURCES = new Set<ResourcesIds>([ResourcesIds.Donkey, ResourcesIds.Essence]);

const SOURCE_ALLOWED_CATEGORIES = new Set<StructureType>([
  StructureType.Realm,
  StructureType.Village,
  StructureType.FragmentMine,
]);
const DEST_ALLOWED_CATEGORIES = SOURCE_ALLOWED_CATEGORIES;

const isFragmentMine = (structure: Structure | undefined) => structure?.category === StructureType.FragmentMine;
const isRealm = (structure: Structure | undefined) => structure?.category === StructureType.Realm;
const isAllowedSource = (structure: Structure) => SOURCE_ALLOWED_CATEGORIES.has(structure.category);
const isAllowedDestination = (structure: Structure) => DEST_ALLOWED_CATEGORIES.has(structure.category);

const getStructureIcon = (category: StructureType, isBlitz: boolean) => {
  switch (category) {
    case StructureType.Realm:
      return Crown;
    case StructureType.Village:
      return isBlitz ? Tent : Castle;
    case StructureType.FragmentMine:
      return Pickaxe;
    case StructureType.Hyperstructure:
      return Sparkles;
    default:
      return Castle;
  }
};

interface TransferAutomationPanelProps {
  initialSourceId?: number | null;
}

export const TransferAutomationPanel = ({ initialSourceId }: TransferAutomationPanelProps) => {
  const playerStructures = useUIStore((s) => s.playerStructures);
  const { currentDefaultTick } = useBlockTimestamp();
  const isBlitz = getIsBlitz();
  const { favorites } = useFavoriteStructures();
  const favoriteDestinationIds = useMemo(() => new Set(favorites), [favorites]);

  const ownedSources = useMemo<Structure[]>(() => {
    return playerStructures.filter((structure) => isAllowedSource(structure));
  }, [playerStructures]);

  // Aggregate available resources across owned sources (balance > 0)
  const {
    setup: { components, systemCalls },
    account: { account },
  } = useDojo();

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
  const allowMultiDestination = selectedResources.length > 0;
  const actualDestinationCount = allowMultiDestination ? destinationIds.length : Math.min(destinationIds.length, 1);
  const destinationCountForLimits = allowMultiDestination ? Math.max(1, destinationIds.length || 1) : 1;

  const hasMilitarySelection = useMemo(
    () => selectedResources.some((rid) => isMilitaryResource(rid)),
    [selectedResources],
  );
  const hasNonDonkeySelection = useMemo(
    () => selectedResources.some((rid) => rid !== ResourcesIds.Donkey),
    [selectedResources],
  );

  const resourcePriorityMap = useMemo(() => {
    const resourceTiers = getResourceTiers(getIsBlitz());
    const tierOrder = [
      "lords",
      "relics",
      "essence",
      "labor",
      "military",
      "transport",
      "food",
      "common",
      "uncommon",
      "rare",
      "unique",
      "mythic",
    ] as const;

    const map = new Map<ResourcesIds, { group: number; position: number }>();
    tierOrder.forEach((key, groupIndex) => {
      const ids = (resourceTiers as Record<string, ResourcesIds[]>)[key] ?? [];
      ids.forEach((id, index) => {
        const isMaterialGroup = groupIndex >= tierOrder.indexOf("common");
        map.set(id, { group: groupIndex, position: isMaterialGroup ? id : index });
      });
    });
    return map;
  }, []);

  const getResourcePriority = useCallback(
    (resourceId: ResourcesIds) => {
      const match = resourcePriorityMap.get(resourceId);
      if (match) return match;
      return { group: resourcePriorityMap.size + 1, position: resourceId };
    },
    [resourcePriorityMap],
  );

  const resourceTotals = useMemo(() => {
    const totals = new Map<ResourcesIds, number>();
    if (!components) return totals;
    const clientComponents = components as ClientComponents;
    const sourcesToUse =
      selectedSourceId !== null
        ? ownedSources.filter((ps) => Number(ps.entityId) === Number(selectedSourceId))
        : ownedSources;

    for (const ps of sourcesToUse) {
      const entityKey = getEntityIdFromKeys([BigInt(ps.entityId)]);
      const resourceComponent = getComponentValue(clientComponents.Resource, entityKey);
      if (!resourceComponent) continue;

      const balances = ResourceManager.getResourceBalancesWithProduction(resourceComponent, currentDefaultTick);
      const category = ps.category;

      for (const { resourceId, amount } of balances) {
        const rid = resourceId as ResourcesIds;
        if (amount <= 0) continue;
        if (isMilitaryResource(rid) && category !== StructureType.Realm) {
          continue;
        }
        const human = Number(amount) / RESOURCE_PRECISION;
        if (human > 0) {
          totals.set(rid, (totals.get(rid) ?? 0) + human);
        }
      }
    }
    return totals;
  }, [components, ownedSources, currentDefaultTick, selectedSourceId]);

  const availableResources = useMemo(() => new Set(resourceTotals.keys()), [resourceTotals]);

  useEffect(() => {
    if (initialSourceId === null || initialSourceId === undefined) return;
    setSelectedSourceId((prev) => (prev === initialSourceId ? prev : initialSourceId));
  }, [initialSourceId]);

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

    try {
      const next: Record<number, { amount: number }> = {};
      if (Array.isArray(draft.resourceConfigs) && draft.resourceConfigs.length > 0) {
        draft.resourceConfigs.forEach((cfg) => {
          const rid = cfg.resourceId as ResourcesIds;
          next[rid] = { amount: Math.max(0, Math.floor(cfg.amount ?? 0)) };
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
    return ownedSources.filter((ps) => isRealm(ps));
  }, [ownedSources, hasMilitarySelection]);

  const eligibleSources = useMemo(() => {
    if (!components) return filteredOwnedSources;
    if (selectedResources.length === 0) return filteredOwnedSources;
    const clientComponents = components as ClientComponents;
    const eligible: Structure[] = [];
    const balanceSums = new Map<number, number>();

    for (const ps of filteredOwnedSources) {
      const rm = new ResourceManager(clientComponents, ps.entityId);
      let sum = 0;
      let hasAllResources = true;
      for (const rid of selectedResources) {
        const bal = rm.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n;
        if (Number(bal) <= 0) {
          hasAllResources = false;
          break;
        }
        sum += Number(bal);
      }
      if (hasAllResources) {
        eligible.push(ps);
        balanceSums.set(Number(ps.entityId), sum);
      }
    }

    eligible.sort(
      (a, b) => (balanceSums.get(Number(b.entityId)) ?? 0) - (balanceSums.get(Number(a.entityId)) ?? 0),
    );
    return eligible;
  }, [components, filteredOwnedSources, selectedResources, currentDefaultTick]);

  const selectedSource = useMemo(() => {
    if (!selectedSourceId) return null;
    return ownedSources.find((ps) => Number(ps.entityId) === Number(selectedSourceId)) ?? null;
  }, [ownedSources, selectedSourceId]);

  // Destinations: owned realms + villages (toggle does not affect source list)
  const ownedDestinations = useMemo<Structure[]>(() => {
    return playerStructures.filter((structure) => isAllowedDestination(structure));
  }, [playerStructures]);

  const filteredOwnedDestinations = useMemo(() => {
    if (!hasMilitarySelection) return ownedDestinations;
    return ownedDestinations.filter((ps) => isRealm(ps));
  }, [ownedDestinations, hasMilitarySelection]);

  const destinationLookup = useMemo(() => {
    const map = new Map<number, Structure>();
    ownedDestinations.forEach((ps) => {
      map.set(Number(ps.entityId), ps);
    });
    return map;
  }, [ownedDestinations]);

  const [destSearch, setDestSearch] = useState("");
  const allowEssenceDestinationPayload = useMemo(
    () => selectedResources.every((rid) => ESSENCE_SITE_ALLOWED_RESOURCES.has(rid)),
    [selectedResources],
  );

  const destinations = useMemo(() => {
    const baseList = ownedDestOnly ? filteredOwnedDestinations : filteredOwnedDestinations; // placeholder for future public list
    const q = destSearch.trim();
    const isNumeric = /^\d+$/.test(q);
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, "");
    const filtered = baseList
      .filter((ps) => Number(ps.entityId) !== Number(selectedSourceId))
      .filter((ps) => (allowEssenceDestinationPayload ? true : !isFragmentMine(ps)));
    const searched = !q
      ? filtered
      : filtered.filter((ps) => {
          const name = getStructureName(ps.structure, isBlitz).name;
          if (isNumeric) {
            return String(ps.entityId).includes(q);
          }
          return norm(name).includes(norm(q));
        });
    return [...searched].sort((a, b) => {
      const aFav = favoriteDestinationIds.has(Number(a.entityId));
      const bFav = favoriteDestinationIds.has(Number(b.entityId));
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [
    ownedDestOnly,
    filteredOwnedDestinations,
    destSearch,
    isBlitz,
    selectedSourceId,
    allowEssenceDestinationPayload,
    favoriteDestinationIds,
  ]);

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
    const allowedIds = new Set(filteredOwnedDestinations.map((ps) => Number(ps.entityId)));
    setDestinationIds((prev) => prev.filter((id) => allowedIds.has(id)));
  }, [hasMilitarySelection, filteredOwnedDestinations]);

  useEffect(() => {
    if (!hasMilitarySelection) return;
    if (!selectedSourceId) return;
    const stillAllowed = filteredOwnedSources.some((ps) => Number(ps.entityId) === Number(selectedSourceId));
    if (!stillAllowed) {
      setSelectedSourceId(null);
    }
  }, [hasMilitarySelection, selectedSourceId, filteredOwnedSources]);

  useEffect(() => {
    if (allowEssenceDestinationPayload) return;
    setDestinationIds((prev) =>
      prev.filter((id) => {
        const destination = destinationLookup.get(id);
        return destination ? !isFragmentMine(destination) : false;
      }),
    );
  }, [allowEssenceDestinationPayload, destinationLookup]);

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
      const rm = new ResourceManager(components as ClientComponents, selectedSourceId);
      for (const rid of selectedResources) {
        const bal = rm.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n;
        map.set(rid, Math.max(0, Math.floor(Number(bal) / RESOURCE_PRECISION)));
      }
    } catch {
      // ignore balance fetch errors
    }
    return map;
  }, [components, selectedSourceId, selectedResources, currentDefaultTick]);

  // Donkey availability separate to avoid re-computation on slider changes
  const donkeyAvailable = useMemo(() => {
    if (!components || !selectedSourceId) return 0;
    try {
      const rm = new ResourceManager(components as ClientComponents, selectedSourceId);
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

  const restrictToEssencePayload = selectedSource?.category === StructureType.FragmentMine;

  const visibleResourceIds = useMemo(() => {
    return Array.from(availableResources)
      .filter((rid) => {
        if (restrictToEssencePayload && !ESSENCE_SITE_ALLOWED_RESOURCES.has(rid as ResourcesIds)) {
          return false;
        }
        if (resourceFilter === "military") return isMilitaryResource(rid as ResourcesIds);
        if (resourceFilter === "production") return !isMilitaryResource(rid as ResourcesIds);
        return true;
      })
      .sort((a, b) => {
        const ra = a as ResourcesIds;
        const rb = b as ResourcesIds;
        const priA = getResourcePriority(ra);
        const priB = getResourcePriority(rb);
        if (priA.group !== priB.group) return priA.group - priB.group;
        if (priA.position !== priB.position) return priA.position - priB.position;
        return ra - rb;
      });
  }, [availableResources, restrictToEssencePayload, resourceFilter, getResourcePriority]);

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

  const perTransferDonkeyNeed = transferPreview?.donkeys.need ?? 0;
  const aggregatedDonkeyNeed =
    transferPreview && hasNonDonkeySelection
      ? actualDestinationCount > 0
        ? transferPreview.donkeys.need * actualDestinationCount
        : perTransferDonkeyNeed
      : 0;
  const donkeyShortage = Boolean(
    transferPreview && actualDestinationCount > 0 && transferPreview.donkeys.have < aggregatedDonkeyNeed,
  );

  useEffect(() => {
    if (selectedResources.length === 0) return;
    setResourceConfigs((prev) => {
      let mutated = false;
      const next = { ...prev };
      for (const rid of selectedResources) {
        const existing = prev[rid];
        if (!existing) continue;
        let available = sourceBalances.get(rid) ?? 0;
        if (rid === ResourcesIds.Donkey) {
          available = Math.max(0, available - aggregatedDonkeyNeed);
        }
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
  }, [
    selectedResources,
    sourceBalances,
    donkeyAvailable,
    donkeyCapacityKgPerUnit,
    destinationCountForLimits,
    aggregatedDonkeyNeed,
  ]);

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

    const resolvedDestinations = resolvedDestinationIds
      .map((id) => destinationLookup.get(id))
      .filter((structure): structure is Structure => Boolean(structure));

    if (resolvedDestinations.length !== resolvedDestinationIds.length) {
      toast.error("Selected destination is no longer available.");
      return;
    }

    const hasMilitary = selectedResources.some((rid) => isMilitaryResource(rid));

    if (hasMilitary) {
      const src = ownedSources.find((structure) => Number(structure.entityId) === Number(selectedSourceId));
      const invalid =
        !src ||
        src.category !== StructureType.Realm ||
        resolvedDestinations.some((dst) => dst.category !== StructureType.Realm);
      if (invalid) {
        toast.error("Troops can only be transferred Realm ↔ Realm.");
        return;
      }
    }

    const essenceDestinationInvalid =
      !allowEssenceDestinationPayload && resolvedDestinations.some((dst) => isFragmentMine(dst));
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

    const src = ownedSources.find((structure) => Number(structure.entityId) === Number(selectedSourceId));

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

  return (
    <div className="p-3 md:p-4 space-y-3">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
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
          <Button variant="outline" size="xs" forceUppercase={false} onClick={resetPanel}>
            Reset
          </Button>
        </div>
        {restrictToEssencePayload && (
          <p className="text-xxs text-gold/60">Essence rifts can only transfer Donkeys and Essence.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {visibleResourceIds.map((rid) => {
              const resourceId = rid as ResourcesIds;
              const sel = selectedResources.includes(resourceId);
              const totalHuman = resourceTotals.get(rid) ?? 0;
              return (
                <button
                  key={resourceId}
                  type="button"
                  onClick={() =>
                    setSelectedResources((prev) =>
                      prev.includes(resourceId) ? prev.filter((r) => r !== resourceId) : [...prev, resourceId],
                    )
                  }
                  className={`px-2 py-1 rounded border text-xs flex items-center gap-1 ${sel ? "border-gold text-gold bg-gold/10" : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold"}`}
                  title={ResourcesIds[resourceId] as string}
                >
                  <ResourceIcon resource={ResourcesIds[resourceId]} size="xs" />
                  {ResourcesIds[resourceId]}{" "}
                  <span className="text-[10px] text-gold/60">({totalHuman.toLocaleString()})</span>
                </button>
              );
            })}
        </div>
      </section>

      <section className="space-y-2">
        <input
          type="text"
          value={sourceSearch}
          onChange={(e) => setSourceSearch(e.target.value)}
          placeholder="Filter by name or ID"
          className="w-full px-2 py-1 text-xs rounded border border-gold/30 bg-black/30 text-gold/80 placeholder:text-gold/40 focus:border-gold/60 outline-none mb-2"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {eligibleSources
            .filter((ps) => {
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
            .map((ps) => {
              const name = getStructureName(ps.structure, isBlitz).name;
              const entityId = Number(ps.entityId);
              const isSel = selectedSourceId === entityId;
              const Icon = getStructureIcon(ps.category, isBlitz);
              return (
                <button
                  key={ps.entityId}
                  type="button"
                  className={`text-left px-2 py-2 rounded border ${isSel ? "border-gold text-gold bg-gold/10" : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold"}`}
                  onClick={() => setSelectedSourceId(isSel ? null : entityId)}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gold" aria-hidden />
                    <div className="text-sm font-semibold">{name}</div>
                  </div>
                </button>
              );
            })}
        </div>
      </section>

      {selectedResources.length > 0 && selectedSourceId && (
        <section className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-gold/70">
              {allowMultiDestination && actualDestinationCount > 0 ? `${actualDestinationCount} selected` : ""}
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
            {destinations.map((ps) => {
              const name = getStructureName(ps.structure, isBlitz).name;
              const entityId = Number(ps.entityId);
              const isSel = destinationIds.includes(entityId);
              const Icon = getStructureIcon(ps.category, isBlitz);
              const isFavorite = favoriteDestinationIds.has(entityId);
              return (
                <button
                  key={`dst-${ps.entityId}`}
                  type="button"
                  className={`text-left px-2 py-2 rounded border ${isSel ? "border-gold text-gold bg-gold/10" : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold"}`}
                  onClick={() => toggleDestinationSelection(entityId)}
                >
                  <div className="flex items-center gap-2">
                    {isFavorite && <Star className="h-4 w-4 fill-current text-gold" aria-hidden />}
                    <Icon className="h-4 w-4 text-gold" aria-hidden />
                    <div className="text-sm font-semibold">{name}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {selectedResources.length > 0 && selectedSourceId && (
        <section className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {selectedResources.map((rid) => {
              const cfg = resourceConfigs[rid] ?? { amount: 0 };
              let available = sourceBalances.get(rid) ?? 0;
              if (rid === ResourcesIds.Donkey) {
                available = Math.max(0, available - aggregatedDonkeyNeed);
              }
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
                    <input
                      type="number"
                      inputMode="numeric"
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
                      className="mt-2 w-full rounded border border-gold/30 bg-black/40 px-2 py-1 text-xs text-gold/80 placeholder:text-gold/40 focus:border-gold/60 focus:outline-none disabled:opacity-50"
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
                    onChange={(e) => {
                      const rawValue = Number.parseInt(e.target.value, 10);
                      const nextValue = Number.isFinite(rawValue) ? rawValue : 1;
                      setIntervalMinutes(Math.max(1, Math.min(30, nextValue)));
                    }}
                    className="w-32 accent-gold"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={30}
                    step={1}
                    value={interval}
                    onChange={(e) => {
                      const rawValue = Number.parseInt(e.target.value, 10);
                      const nextValue = Number.isFinite(rawValue) ? rawValue : 1;
                      setIntervalMinutes(Math.max(1, Math.min(30, nextValue)));
                    }}
                    className="w-16 rounded border border-gold/30 bg-black/40 px-2 py-1 text-xxs text-gold/80 placeholder:text-gold/40 focus:border-gold/60 focus:outline-none"
                  />
                  <span className="text-xxs text-gold/60">min</span>
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
      </div>
    </div>
  );
};
