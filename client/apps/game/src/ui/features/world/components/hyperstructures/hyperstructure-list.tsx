import clsx from "clsx";
import { ReactNode } from "react";

interface HyperstructureListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  header?: ReactNode;
  description?: ReactNode;
  emptyState?: ReactNode;
  className?: string;
  itemsWrapperClassName?: string;
}

export function HyperstructureList<T>({
  items,
  renderItem,
  header,
  description,
  emptyState,
  className,
  itemsWrapperClassName,
}: HyperstructureListProps<T>) {
  if (items.length === 0) {
    return <div className={className}>{emptyState ?? null}</div>;
  }

  return (
    <div className={clsx("space-y-3", className)}>
      {header}
      {description}
      <div className={clsx("space-y-2", itemsWrapperClassName)}>
        {items.map((item, index) => renderItem(item, index))}
      </div>
    </div>
  );
}
