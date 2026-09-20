import { cn } from "@/ui/design-system/atoms/lib/utils";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentType } from "react";

export type GameIconProps = Omit<ComponentPropsWithoutRef<"img">, "src" | "srcSet"> & {
  size?: number | string;
};

export type GameIcon = ComponentType<GameIconProps>;

/** Decorative by default: the owning control supplies its accessible name. */
export function createGameIcon(src: string, rotation = 0): GameIcon {
  const Icon = forwardRef<HTMLImageElement, GameIconProps>(function GameImageIcon(
    { size = 24, width = size, height = size, className, alt = "", style, ...props },
    ref,
  ) {
    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        width={width}
        height={height}
        draggable={false}
        className={cn("inline-block shrink-0 object-contain", className)}
        style={rotation ? { rotate: `${rotation}deg`, ...style } : style}
        {...props}
      />
    );
  });
  return Icon;
}
