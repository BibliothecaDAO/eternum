import { ordersOfAspect, type AspectId } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { aspectCardUrl } from "@/ui/design-system/icon-meaning";
import { OrderEmblem } from "./order-emblem";

export const AppAspectCard = ({
  aspect,
  name,
  chosen,
  invited,
  busy = false,
  disabled = false,
  label,
  onClick,
  children,
}: {
  aspect: AspectId;
  name: string;
  chosen: boolean;
  invited?: string;
  busy?: boolean;
  disabled?: boolean;
  label?: string;
  onClick: () => void;
  children?: ReactNode;
}) => (
  <button
    type="button"
    className="app-aspect-card"
    data-aspect={name}
    data-aspect-id={aspect}
    aria-pressed={chosen}
    aria-busy={busy || undefined}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
  >
    <img src={aspectCardUrl(aspect)} alt="" aria-hidden className="app-aspect-card__art" />
    {invited && (
      <span data-aspect-invited className="app-choice__tag">
        {invited}
      </span>
    )}
    <span className="app-aspect-card__body">
      <span className="app-aspect-card__name">
        <AspectMark aspect={aspect} size={22} decorative />
        <span>{name}</span>
      </span>
      <span className="app-aspect-card__orders">
        {ordersOfAspect(aspect).map(({ orderId }) => (
          <OrderEmblem key={orderId} order={orderId} size={26} />
        ))}
      </span>
      {children && <span className="app-aspect-card__meta">{children}</span>}
      {busy && <span className="ui-spinner" aria-hidden="true" />}
    </span>
  </button>
);
