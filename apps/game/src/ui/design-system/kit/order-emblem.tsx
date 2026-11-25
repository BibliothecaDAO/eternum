import { catalogOrder } from "@bibliothecadao/types";
import { Icon } from "@/ui/design-system/icon";
import { iconUrl, orderMeaning } from "@/ui/design-system/icon-meaning";

const resolvedOrder = (orderId?: number) => (orderId && orderId > 0 ? catalogOrder(orderId) : undefined);

export const orderEmblem = (order: number): { art: string; name: string } => {
  const meaning = orderMeaning(order);
  return { art: iconUrl(meaning), name: catalogOrder(order).fullOrderName };
};

export const OrderEmblem = ({
  order,
  size = 24,
  decorative = false,
}: {
  order: number;
  size?: number;
  decorative?: boolean;
}) => <Icon name={orderMeaning(order)} size={size} alt={decorative ? "" : catalogOrder(order).fullOrderName} />;

export const OrderLine = ({
  orderId,
  size = 14,
  className,
}: {
  orderId?: number;
  size?: number;
  className?: string;
}) => {
  const order = resolvedOrder(orderId);
  if (!order) return null;
  return (
    <span className={className} data-order-id={order.orderId}>
      <OrderEmblem order={order.orderId} size={size} decorative />
      <span className="truncate">{order.fullOrderName}</span>
    </span>
  );
};
