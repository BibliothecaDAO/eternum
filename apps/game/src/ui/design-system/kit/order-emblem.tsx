import { Icon } from "@/ui/design-system/icon";
import { iconDefinition, iconUrl, orderMeaning } from "@/ui/design-system/icon-meaning";
export const orderEmblem = (order: number): { art: string; name: string } => {
  const meaning = orderMeaning(order);
  return { art: iconUrl(meaning), name: iconDefinition(meaning).label };
};
export const OrderEmblem = ({ order, size = 24 }: { order: number; size?: number }) => (
  <Icon name={orderMeaning(order)} size={size} alt={iconDefinition(orderMeaning(order)).label} />
);
