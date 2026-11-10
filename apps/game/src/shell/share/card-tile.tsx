import { Icon, type IconMeaning } from "@/ui/design-system/icon";

/**
 * One number on a shared card: its painting filling the tile, the figure, and its name under it. The season recap's
 * haul and sites and the day's card draw their numbers with it (season-recap.css styles it).
 */
export const CardTile = ({ icon, value, label }: { icon: IconMeaning; value: string; label: string }) => (
  <span className="season-card__tile">
    <Icon name={icon} size={72} />
    <b>{value}</b>
    <small>{label}</small>
  </span>
);
