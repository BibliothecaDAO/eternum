import { iconUrl, type IconMeaning } from "../../../game/src/ui/design-system/icon-meaning";

export const GameIcon = ({ name, label, size = 24 }: { name: IconMeaning; label?: string; size?: number }) => (
  <img
    className="docs-icon"
    src={iconUrl(name, 128)}
    alt={label ?? ""}
    title={label}
    width={size}
    height={size}
    loading="lazy"
  />
);
