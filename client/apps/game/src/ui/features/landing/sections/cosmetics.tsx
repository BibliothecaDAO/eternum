import { useLootChestOpeningStore } from "@/hooks/store/use-loot-chest-opening-store";
import { Tabs } from "@/ui/design-system/atoms/tab/tabs";
import { ChestOpeningExperience } from "@/ui/features/landing/chest-opening";
import { ChestEpoch } from "@/ui/features/landing/chest-opening/hooks/use-chest-opening-flow";
import { useOwnedChests } from "@/ui/features/landing/chest-opening/hooks/use-owned-chests";
import {
  COSMETIC_NAMES,
  DEFAULT_COSMETIC_MODEL_PATH,
  getLocalImageFromAttributesRaw,
  getModelPathFromAttributesRaw,
} from "@/ui/features/landing/chest-opening/utils/cosmetics";
import {
  ChestGallery,
  CollectionProgress,
  CosmeticGallery,
  CosmeticShowcase,
} from "@/ui/features/landing/cosmetics/components";
import { COSMETIC_ITEMS, type CosmeticItem } from "@/ui/features/landing/cosmetics/config/cosmetics.data";
import { useToriiCosmetics, useTotalCosmeticsSupply } from "@/ui/features/landing/cosmetics/lib/use-torii-cosmetics";
import { useCallback, useEffect, useMemo, useState } from "react";

const resolveAssetImage = (uri?: string | null): string | null => {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    const [, hash] = uri.split("ipfs://");
    const normalisedHash = hash.startsWith("ipfs/") ? hash.slice(5) : hash;
    return `https://ipfs.io/ipfs/${normalisedHash}`;
  }
  return uri;
};

export const LandingCosmetics = () => {
  const { data: toriiCosmetics, isLoading, isError } = useToriiCosmetics();
  const { data: totalSupply, isLoading: isLoadingSupply } = useTotalCosmeticsSupply();
  const [selectedId, setSelectedId] = useState<string | null>(COSMETIC_ITEMS[0]?.id ?? null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [openingChestId, setOpeningChestId] = useState<string | null>(null);

  // Chest opening state
  const { showLootChestOpening, setShowLootChestOpening } = useLootChestOpeningStore();
  const { ownedChests, isLoading: isLoadingChests, refetch: refetchChests } = useOwnedChests();

  const toriiItems = useMemo<CosmeticItem[]>(() => {
    if (!toriiCosmetics || toriiCosmetics.length === 0) {
      return [];
    }

    const fallbackModelPath = COSMETIC_ITEMS[0]?.modelPath ?? DEFAULT_COSMETIC_MODEL_PATH;

    return toriiCosmetics.map((asset, index): CosmeticItem => {
      // Find the Epoch Item attribute to get the cosmetic ID
      const epochItemValue = asset.metadata?.attributes?.find(
        (attribute) => attribute.trait_type === "Epoch Item",
      )?.value;
      // Look up the attributesRaw from COSMETIC_NAMES using the Epoch Item ID
      const cosmeticEntry = epochItemValue
        ? COSMETIC_NAMES.find((c) => c.id === epochItemValue.toString().trim())
        : null;
      // Use the name from COSMETIC_NAMES (human-readable) over metadata name (which might be an ID)
      const name = cosmeticEntry?.name ?? asset.metadata?.name ?? asset.tokenName ?? `Cosmetic ${index + 1}`;
      const description = asset.metadata?.description ?? "Cosmetic item discovered on-chain.";
      const slugBase = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const normalisedId = `${slugBase || "cosmetic"}-${index}`;
      const resolvedModelPath = cosmeticEntry
        ? getModelPathFromAttributesRaw(cosmeticEntry.attributesRaw)
        : fallbackModelPath;
      const slot = asset.metadata?.attributes?.find((attribute) => attribute.trait_type === "Type")?.value ?? null;
      // Use local image path based on attributesRaw (faster and more reliable than IPFS)
      const localImage = cosmeticEntry ? getLocalImageFromAttributesRaw(cosmeticEntry.attributesRaw) : null;

      return {
        id: normalisedId,
        name,
        description,
        modelPath: resolvedModelPath,
        metadata: asset.metadata,
        tokenSymbol: asset.tokenSymbol,
        balance: asset.balance,
        attributes: asset.metadata?.attributes ?? [],
        image: localImage ?? resolveAssetImage(asset.metadata?.image ?? null),
        tokenId: asset.tokenId,
        slot,
        count: asset.count, // Pre-grouped count from SQL
        attributesRaw: cosmeticEntry?.attributesRaw,
      };
    });
  }, [toriiCosmetics]);

  // Data is already grouped by SQL, no client-side grouping needed
  const baseItems = toriiItems.length > 0 ? toriiItems : COSMETIC_ITEMS;

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (query.length === 0) {
      return baseItems;
    }

    return baseItems.filter((item: CosmeticItem) => {
      const searchBuckets: string[] = [
        item.name,
        item.description,
        item.tokenSymbol ?? "",
        item.metadata?.name ?? "",
        item.metadata?.description ?? "",
      ];

      if (item.attributes) {
        for (const attribute of item.attributes) {
          searchBuckets.push(attribute.trait_type, attribute.value);
        }
      } else if (item.metadata?.attributes) {
        for (const attribute of item.metadata.attributes) {
          searchBuckets.push(attribute.trait_type, attribute.value);
        }
      }

      return searchBuckets.some((bucket) => bucket?.toLowerCase().includes(query));
    });
  }, [baseItems, searchTerm]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      if (selectedId !== null) {
        setSelectedId(null);
      }
      return;
    }

    const hasSelected = selectedId && filteredItems.some((item) => item.id === selectedId);
    if (!hasSelected) {
      setSelectedId(filteredItems[0]?.id ?? null);
    }
  }, [filteredItems, selectedId]);

  const selectedItem = useMemo<CosmeticItem | null>(() => {
    if (!selectedId) return null;
    return filteredItems.find((item) => item.id === selectedId) ?? null;
  }, [filteredItems, selectedId]);

  // Handle opening a chest from the gallery
  const handleOpenChest = useCallback(
    (chestId: string, _epoch: ChestEpoch) => {
      setOpeningChestId(chestId);
      setShowLootChestOpening(true);
    },
    [setShowLootChestOpening],
  );

  // Handle closing chest experience
  const handleCloseChestExperience = useCallback(() => {
    setShowLootChestOpening(false);
    setOpeningChestId(null);
    refetchChests();
  }, [setShowLootChestOpening, refetchChests]);

  // Calculate owned unique cosmetics count
  const ownedUniqueCount = toriiItems.length;

  return (
    <>
      <section className="container flex h-[70vh] w-full flex-col -mt-12">
        <Tabs variant="selection" selectedIndex={activeTab} onChange={setActiveTab} size="small" className="flex h-full flex-col">
          <Tabs.List className="mb-2 flex-shrink-0 max-w-md">
            <Tabs.Tab>Cosmetics</Tabs.Tab>
            <Tabs.Tab>Chests ({ownedChests.length})</Tabs.Tab>
            <Tabs.Tab disabled>
              <span title="Coming Soon">Elite Passes</span>
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panels className="min-h-0 flex-1">
            {/* Cosmetics Tab */}
            <Tabs.Panel className="h-full">
              <div className="flex h-full w-full flex-col gap-6 xl:flex-row">
                <div className="w-full space-y-4 overflow-y-auto rounded-3xl border border-white/10 bg-black/60 p-6 backdrop-blur panel-wood xl:w-1/2">
                  {/* Collection Progress */}
                  <CollectionProgress
                    ownedCount={ownedUniqueCount}
                    totalCount={totalSupply ?? COSMETIC_NAMES.length}
                    isLoading={isLoadingSupply}
                  />

                  <div className="space-y-2">
                    <label className="sr-only" htmlFor="cosmetic-search">
                      Search cosmetics
                    </label>
                    <input
                      id="cosmetic-search"
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by name, rarity, or trait"
                      className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-gold focus:outline-none focus:ring-0"
                    />

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {isLoading && <p className="text-white/60">Loading on-chain cosmetics…</p>}
                      {isError && !isLoading && (
                        <p className="text-rose-300">Failed to load on-chain cosmetics. Showing curated preview.</p>
                      )}
                      {!isLoading && !isError && toriiItems.length === 0 && (
                        <p className="text-white/50">Showing curated preview set.</p>
                      )}
                    </div>
                  </div>

                  <CosmeticGallery items={filteredItems} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} />
                </div>

                <aside className="relative flex h-full w-full flex-col overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-black/70 to-black/95 p-6 shadow-2xl backdrop-blur xl:w-1/2 xl:min-w-[26rem]">
                  <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/5" aria-hidden />
                  <CosmeticShowcase item={selectedItem} />
                </aside>
              </div>
            </Tabs.Panel>

            {/* Chests Tab */}
            <Tabs.Panel className="h-full">
              <div className="h-full overflow-y-auto rounded-3xl border border-white/10 bg-black/60 p-6 backdrop-blur panel-wood">
                <ChestGallery
                  chests={ownedChests}
                  onOpenChest={handleOpenChest}
                  isLoading={isLoadingChests}
                  openingChestId={openingChestId}
                />
              </div>
            </Tabs.Panel>

            {/* Elite Passes Tab (Coming Soon) */}
            <Tabs.Panel className="h-full">
              <div className="flex h-full items-center justify-center rounded-3xl border border-white/10 bg-black/60 backdrop-blur panel-wood">
                <p className="text-white/50">Coming Soon</p>
              </div>
            </Tabs.Panel>
          </Tabs.Panels>
        </Tabs>
      </section>

      {/* Chest Opening Experience Modal */}
      {showLootChestOpening && <ChestOpeningExperience onClose={handleCloseChestExperience} />}
    </>
  );
};
