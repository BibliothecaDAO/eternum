import clsx from "clsx";
import { Icon } from "../icon";
import { iconDefinition, resourceMeaning } from "../icon-meaning";

type Props = {
  resource: string | number;
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

export const ResourceIcon = ({ withTooltip = true, tooltipText, ...props }: Props) => {
  const meaning = resourceMeaning(props.resource);
  const name = iconDefinition(meaning).label;
  const content = (
    <div className={`flex paper relative group rounded-xl justify-center ${props.className}`}>
      <div className={`relative ${clsx(STYLES.size[props.size], props.className)} `}>
        <Icon
          name={meaning}
          size={props.size === "xxl" ? 80 : props.size === "xl" ? 64 : 32}
          className="h-full w-full"
        />
      </div>

      {props.label && <span className="self-center ml-4 text-center">{name}</span>}
      {withTooltip && (
        <div className="absolute -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-brown rounded-lg max-w-[380px] px-3 group-hover:flex z-[70]">
          <span className="relative z-10 px-3 py-2 text-sm leading-snug whitespace-normal rounded shadow-lg bg-gray-1000 text-gold-100">
            {tooltipText || name}
          </span>
          <div className="z-[65] w-3 h-3 bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 absolute rotate-45 bg-brown" />
        </div>
      )}
    </div>
  );
  return content;
};
