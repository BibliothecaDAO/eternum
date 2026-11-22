import { aspectName, type AspectId } from "@bibliothecadao/types";
import { cn } from "./atoms/lib/utils";
import { aspectArtUrl } from "./icon-meaning";

export function AspectMark({
  aspect,
  size = 32,
  decorative = false,
  className,
}: {
  aspect: AspectId;
  size?: number;
  decorative?: boolean;
  className?: string;
}) {
  const name = aspectName(aspect);
  return (
    <img
      src={aspectArtUrl(aspect, "emblem", size)}
      data-aspect-mark={aspect}
      alt={decorative ? "" : name}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      draggable={false}
      className={cn("inline-block aspect-square shrink-0 object-contain", className)}
    />
  );
}
