import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "./atoms/lib/utils";
import { iconDefinition, iconUrl, type IconMeaning } from "./icon-meaning";
export type { IconMeaning } from "./icon-meaning";

export type IconMark = IconMeaning | readonly IconMeaning[];

/** A choice may name one thing or a group of things, using their existing paintings together. */
export function IconGroup({ name, size = 24 }: { name: IconMark; size?: number }) {
  const names = typeof name === "string" ? [name] : name;
  return (
    <span className="inline-flex shrink-0 items-center">
      {names.map((name) => (
        <Icon key={name} name={name} size={size} />
      ))}
    </span>
  );
}

type IconProps = Omit<ComponentPropsWithoutRef<"img">, "src" | "srcSet" | "name"> & {
  name: IconMeaning;
  size?: number | string;
};

export const Icon = forwardRef<HTMLImageElement, IconProps>(function Icon(
  { name, size = 24, width = size, height = size, alt = "", className, style, ...props },
  ref,
) {
  const { rotation } = iconDefinition(name);
  const pixels = typeof size === "number" && size > 64 ? 256 : typeof size === "number" && size > 32 ? 128 : 64;
  return (
    <img
      {...props}
      ref={ref}
      src={iconUrl(name, pixels)}
      data-icon={name}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={width}
      height={height}
      draggable={false}
      className={cn("inline-block aspect-square shrink-0 object-contain", className)}
      style={rotation ? { rotate: `${rotation}deg`, ...style } : style}
    />
  );
});

export function SvgIcon({
  name,
  size = 24,
  ...props
}: { name: IconMeaning; size?: number } & Omit<React.SVGProps<SVGImageElement>, "name" | "href">) {
  return (
    <image
      {...props}
      data-icon={name}
      href={iconUrl(name)}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
