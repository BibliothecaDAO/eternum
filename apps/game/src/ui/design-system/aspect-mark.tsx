import { aspectName, type AspectId } from "@bibliothecadao/types";
import { Icon } from "./icon";
import { aspectMeaning } from "./icon-meaning";

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
  return (
    <Icon
      name={aspectMeaning(aspect)}
      size={size}
      data-aspect-mark={aspect}
      alt={decorative ? "" : aspectName(aspect)}
      className={className}
    />
  );
}
