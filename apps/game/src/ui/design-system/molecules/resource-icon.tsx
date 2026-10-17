import type { ResourcesIds } from "@bibliothecadao/types";
import clsx from "clsx";
import { Icon } from "../icon";
import { iconDefinition, resourceMeaning } from "../icon-meaning";

type Props = {
  resource: ResourcesIds;
  size: keyof (typeof STYLES)["size"];
  className?: string;
  label?: boolean;
  withTooltip?: boolean;
  containerClassName?: string;
  tooltipText?: string;
};

const STYLES = {
  size: {
    xs: "w-2 h-2 md:w-4 md:h-4",
    sm: "w-4 h-4 md:w-6 md:h-6",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12 md:w-16 md:h-16",
    xxl: "w-16 h-16 md:w-20 md:h-20",
  },
} as const;

/** A resource's picture; its name, or `tooltipText`, shows on the app's one tooltip, above everything around it. */
export const ResourceIcon = ({ withTooltip = true, tooltipText, ...props }: Props) => {
  const meaning = resourceMeaning(props.resource);
  const name = iconDefinition(meaning).label;
  return (
    <div
      data-tip={withTooltip ? tooltipText || name : undefined}
      className={clsx("relative flex items-center justify-center rounded-xl", props.className)}
    >
      {/* A flex box, so the picture fills it exactly: as an inline image it would sit on the text baseline, low. */}
      <div className={clsx("relative flex items-center justify-center", STYLES.size[props.size], props.className)}>
        <Icon
          name={meaning}
          size={props.size === "xxl" ? 80 : props.size === "xl" ? 64 : 32}
          className="h-full w-full"
        />
      </div>

      {props.label && <span className="self-center ml-4 text-center">{name}</span>}
    </div>
  );
};
