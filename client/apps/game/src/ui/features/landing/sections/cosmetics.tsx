import { CosmeticGallery, CosmeticShowcase } from "@/ui/features/landing/cosmetics/components";
import {
  COSMETIC_ITEMS,
  type CosmeticItem,
} from "@/ui/features/landing/cosmetics/config/cosmetics.data";
import {
  COSMETIC_MODEL_BY_EPOCH_ITEM,
  DEFAULT_COSMETIC_MODEL_PATH,
} from "@/ui/features/landing/cosmetics/config/cosmetic-model-map";
import { useToriiCosmetics } from "@/ui/features/landing/cosmetics/lib/use-torii-cosmetics";
import { useEffect, useMemo, useState } from "react";

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
  const [selectedId, setSelectedId] = useState<string | null>(COSMETIC_ITEMS[0]?.id ?? null);
  const [searchTerm, setSearchTerm] = useState("");

  const toriiItems = useMemo<CosmeticItem[]>(() => {
    if (!toriiCosmetics || toriiCosmetics.length === 0) {
      return [];
    }

    const fallbackModelPath = COSMETIC_ITEMS[0]?.modelPath ?? DEFAULT_COSMETIC_MODEL_PATH;

    return toriiCosmetics.map((asset, index): CosmeticItem => {
      const name = asset.metadata?.name ?? asset.tokenName ?? `Cosmetic ${index + 1}`;
      const description = asset.metadata?.description ?? "Cosmetic item discovered on-chain.";
      const slugBase = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const normalisedId = `${slugBase || "cosmetic"}-${index}`;
      const epochItemValueRaw = asset.metadata?.attributes?.find(
        (attribute) => attribute.trait_type === "Epoch Item",
      )?.value;
      const epochItemKey = epochItemValueRaw?.toString().trim();
      const mappedModelPath = epochItemKey ? COSMETIC_MODEL_BY_EPOCH_ITEM[epochItemKey] ?? null : null;
      const resolvedModelPath = mappedModelPath ?? fallbackModelPath;

      return {
        id: normalisedId,
        name,
        description,
        modelPath: resolvedModelPath,
        metadata: asset.metadata,
        tokenSymbol: asset.tokenSymbol,
        balance: asset.balance,
        attributes: asset.metadata?.attributes ?? [],
        image: resolveAssetImage(asset.metadata?.image ?? null),
      };
    });
  }, [toriiCosmetics]);

  const baseItems = toriiItems.length > 0 ? toriiItems : COSMETIC_ITEMS;

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (query.length === 0) {
      return baseItems;
    }

    return baseItems.filter((item) => {
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

  return (
    <section className="flex w-full flex-col gap-6 xl:flex-row container  h-[70vh]">
      <div className="w-full xl:w-1/2 rounded-3xl border border-white/10 bg-black/60 p-6 backdrop-blur panel-wood overflow-y-auto space-y-4">
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

      <aside className="w-full rounded-3xl panel-wood border-white/10 bg-black/70 p-6 backdrop-blur xl:w-1/2 xl:min-w-[26rem]">
        <CosmeticShowcase item={selectedItem} />
      </aside>
    </section>
  );
};
