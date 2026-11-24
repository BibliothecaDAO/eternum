import "./frontier-bar.css";

import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { homeIcon, type HomeKind } from "@/ui/design-system/home-icons";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { OrderLine, resolvedOrder } from "@/ui/design-system/kit/order-emblem";
import { aspectName, type AspectId } from "@bibliothecadao/types";
import type { CSSProperties } from "react";

const MEDALLION_ICON_SIZE: Record<"sm" | "md" | "lg", number> = {
  sm: 19,
  md: 28,
  lg: 30,
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
  size?: "sm" | "md" | "lg";
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

export const RealmHeaderChip = ({
  name,
  level = 0,
  kind = "realm",
  fallbackIcon,
  aspect,
  orderId,
  expanded,
  variant = "desktop",
  onPress,
}: {
  name: string;
  level?: number;
  kind?: HomeKind;
  fallbackIcon?: IconMeaning;
  aspect?: AspectId;
  orderId?: number;
  expanded?: boolean;
  variant?: "desktop" | "phone";
  onPress?: () => void;
}) => {
  const order = resolvedOrder(orderId);
  const parts = [name, order?.fullOrderName, aspect !== undefined ? aspectName(aspect) : undefined].filter(Boolean);
  const phone = variant === "phone";
  const prefix = phone ? "frontier-phone-realm-chip" : "frontier-realm-chip";
  return (
    <button
      type="button"
      className={phone ? `${prefix} pointer-events-auto` : prefix}
      aria-label={parts.join(", ")}
      aria-expanded={expanded}
      onClick={onPress}
    >
      <AspectMedallion
        aspect={aspect}
        fallbackIcon={fallbackIcon ?? homeIcon(kind, level)}
        size={phone ? "sm" : "lg"}
      />
      <span className={`${prefix}__text`}>
        <span className={`${prefix}__name`}>{name}</span>
        <OrderLine orderId={orderId} size={phone ? 12 : 14} className={`${prefix}__order`} />
      </span>
    </button>
  );
};
