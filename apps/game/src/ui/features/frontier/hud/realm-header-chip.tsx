import "./frontier-bar.css";

import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { homeIcon, type HomeKind } from "@/ui/design-system/home-icons";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { OrderLine, resolvedOrder } from "@/ui/design-system/kit/order-emblem";
import { aspectName, type AspectId } from "@bibliothecadao/types";
import type { CSSProperties } from "react";

type MedallionSize = "sm" | "md" | "lg" | "emblem";

const MEDALLION_ICON_SIZE: Record<MedallionSize, number> = {
  sm: 19,
  md: 28,
  lg: 30,
  emblem: 28,
};

export const AspectMedallion = ({
  aspect,
  fallbackIcon,
  fallbackAlt,
  tip,
  decorative = true,
  size = "md",
}: {
  aspect?: AspectId;
  fallbackIcon: IconMeaning;
  fallbackAlt?: string;
  tip?: string;
  decorative?: boolean;
  size?: MedallionSize;
}) => {
  const iconSize = MEDALLION_ICON_SIZE[size];
  const style = aspect !== undefined ? (aspectVariables(aspect) as CSSProperties) : undefined;
  return (
    <span
      className="frontier-aspect-medallion"
      data-size={size}
      data-aspect={aspect}
      data-tip={tip}
      style={style}
      aria-hidden={decorative || undefined}
    >
      {aspect !== undefined ? (
        <AspectMark aspect={aspect} size={iconSize} decorative={decorative} />
      ) : (
        <Icon name={fallbackIcon} size={iconSize} alt={decorative ? undefined : fallbackAlt} />
      )}
    </span>
  );
};

const realmLabel = (name: string, orderId: number | undefined, aspect: AspectId | undefined): string =>
  [name, resolvedOrder(orderId)?.fullOrderName, aspect !== undefined ? aspectName(aspect) : undefined]
    .filter(Boolean)
    .join(", ");

export const RealmHeaderChip = ({
  name,
  level = 0,
  kind = "realm",
  fallbackIcon,
  aspect,
  orderId,
  expanded,
  onPress,
}: {
  name: string;
  level?: number;
  kind?: HomeKind;
  fallbackIcon?: IconMeaning;
  aspect?: AspectId;
  orderId?: number;
  expanded?: boolean;
  onPress?: () => void;
}) => (
  <button
    type="button"
    className="frontier-realm-chip"
    aria-label={realmLabel(name, orderId, aspect)}
    aria-expanded={expanded}
    onClick={onPress}
  >
    <AspectMedallion aspect={aspect} fallbackIcon={fallbackIcon ?? homeIcon(kind, level)} size="lg" />
    <span className="frontier-realm-chip__text">
      <span className="frontier-realm-chip__name">{name}</span>
      <OrderLine orderId={orderId} size={14} className="frontier-realm-chip__order" />
    </span>
  </button>
);

export const RealmEmblem = ({
  name,
  fallbackIcon,
  aspect,
  orderId,
  expanded,
  onPress,
}: {
  name: string;
  fallbackIcon: IconMeaning;
  aspect?: AspectId;
  orderId?: number;
  expanded?: boolean;
  onPress?: () => void;
}) => (
  <button
    type="button"
    className="frontier-phone-emblem"
    aria-label={realmLabel(name, orderId, aspect)}
    aria-expanded={expanded}
    onClick={onPress}
  >
    <AspectMedallion aspect={aspect} fallbackIcon={fallbackIcon} size="emblem" />
  </button>
);
