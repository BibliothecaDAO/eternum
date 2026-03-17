import { MarketClass } from "@/pm/class";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

type MarketImageFields = {
  image_url?: string | null;
  imageUrl?: string | null;
  image?: string | null;
  cover?: string | null;
};

export const MarketImage = ({ market, className }: { market: MarketClass; className?: string }) => {
  const imageFields = market as MarketClass & MarketImageFields;
  const src = imageFields.image_url || imageFields.imageUrl || imageFields.image || imageFields.cover || null;
  const alt = market.title || "Market image";
  const content = src ? (
    <img alt={alt} src={src} className="h-full w-full object-cover" />
  ) : (
    <span className="text-sm text-lightest/70">{(market.title || "Market").slice(0, 1).toUpperCase()}</span>
  );

  return <div className={cx("flex items-center justify-center bg-brown/45", className)}>{content}</div>;
};
