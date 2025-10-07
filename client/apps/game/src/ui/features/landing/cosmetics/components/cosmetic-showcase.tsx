import { CosmeticItem } from "@/ui/features/landing/cosmetics/config/cosmetics.data";
import { CosmeticModelViewer } from "./cosmetic-model-viewer";

interface CosmeticShowcaseProps {
  item: CosmeticItem | null;
}

export const CosmeticShowcase = ({ item }: CosmeticShowcaseProps) => {
  const attributes = item?.attributes ?? item?.metadata?.attributes ?? [];
  const tokenSymbol = item?.tokenSymbol;
  return (
    <section className="flex h-full flex-col justify-between gap-6">
      <div className="relative flex-1 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-black/20 to-black/70 transition [cursor:grab] hover:border-gold/40 active:[cursor:grabbing] min-h-[320px]">
        {item ? (
          <div className="h-full w-full">
            <CosmeticModelViewer modelPath={item.modelPath} variant="showcase" autoRotate />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            Select a cosmetic to preview.
          </div>
        )}
        {item?.image && (
          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-2xl border border-white/15 bg-black/55 p-2 backdrop-blur">
            <img
              src={item.image}
              alt={`${item.name ?? "Cosmetic"} thumbnail`}
              className="h-12 w-12 rounded-xl object-cover"
              loading="lazy"
            />
            <div className="max-w-[12rem] text-xs text-white/70">
              <p className="font-semibold text-white">Metadata Render</p>
              <p className="line-clamp-2">{item.name}</p>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-10 bottom-6 h-28 rounded-full bg-black/60 blur-3xl" />
      </div>

      <footer className="space-y-2">
        <h3 className="text-2xl font-semibold text-white">{item?.name ?? "Select a cosmetic"}</h3>
        <p className="text-sm leading-relaxed text-white/70">
          {item?.description ?? "Highlight cosmetics to inspect materials, lighting passes, and rarity modifiers."}
        </p>

        <div className="space-y-3 pt-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-white/60">Attributes</h4>
            {attributes.length > 0 ? (
              <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {attributes.map((attribute) => (
                  <div
                    key={`${attribute.trait_type}-${attribute.value}`}
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                  >
                    <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
                      {attribute.trait_type}
                    </dt>
                    <dd className="text-sm font-medium text-white">{attribute.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-xs text-white/50">No on-chain attribute metadata available.</p>
            )}
          </div>

          {(tokenSymbol || item?.balance) && (
            <div className="flex flex-wrap gap-4 text-xs text-white/60">
              {tokenSymbol && (
                <span>
                  Symbol: <span className="font-semibold text-white">{tokenSymbol}</span>
                </span>
              )}
              {item?.balance && (
                <span>
                  Balance: <span className="font-semibold text-white">{item.balance}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </footer>
    </section>
  );
};
