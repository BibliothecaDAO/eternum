import { MarketClass } from "@/pm/class";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

export const MarketImage = ({ market, className }: { market: MarketClass; className?: string }) => {
  const src =
    (market as any).image_url || (market as any).imageUrl || (market as any).image || (market as any).cover || null;
  const alt = market.title || "Market image";
  const content = src ? (
    <img alt={alt} src={src} className="h-full w-full object-cover" />
  ) : (
    <span className="text-sm text-white/70">{(market.title || "Market").slice(0, 1).toUpperCase()}</span>
  );

  return <div className={cx("flex items-center justify-center bg-white/5", className)}>{content}</div>;
};
