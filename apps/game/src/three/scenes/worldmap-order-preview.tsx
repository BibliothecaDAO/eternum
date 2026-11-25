import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudCost, HudIconButton, HudRanked } from "@/ui/design-system/kit/hud-elements";
import { type Reason, shortfallFace } from "@/ui/design-system/kit/reasons";
import { rankedText } from "@/ui/design-system/kit/words";
import type { OrderTip } from "@/ui/features/frontier/hud/order-tip";
import type { OrderRefusal } from "@bibliothecadao/eternum";

/**
 * The surface a tap opens on a tile the selected army can explore or move to where the HUD carries no verb (a Blitz
 * phone), or a desktop's right-click on one it could but not now.
 */
export const ORDER_PREVIEW_SURFACE = "order-preview";

export type RefusedOrder = { why: OrderRefusal["reason"]; reason: Reason };

/**
 * A move or explore at its tile, as the attack's preview is: the order, what it costs, and its verb, which sends it. An
 * order the army can't take now shows why, its verb disabled.
 */
export const OrderPreview = ({
  tip,
  refused,
  onSend,
}: {
  tip: OrderTip;
  refused?: RefusedOrder;
  onSend?: () => void;
}) => {
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const send = () => {
    closeSurface();
    onSend?.();
  };
  return (
    <div
      className={`flex w-60 max-w-full flex-col gap-2 px-2.5 pb-2.5 pt-2 ${refused ? "border-t-2 border-[color:var(--hud-bad)]" : ""}`}
    >
      <div className="flex items-center gap-2">
        {refused ? <RefusedLine refused={refused} /> : tip.cost && <HudCost line={tip.cost} />}
        <span className="ml-auto">
          <HudIconButton
            icon="close"
            label={`Close ${rankedText(tip.line)}`}
            kind="quiet"
            size="sm"
            onClick={closeSurface}
          />
        </span>
      </div>
      <HudButton kind="primary" size="sm" disabled={!onSend} onClick={send}>
        <HudRanked words={tip.line} />
      </HudButton>
    </div>
  );
};

const RefusedLine = ({ refused: { why, reason } }: { refused: RefusedOrder }) => {
  if (reason.kind === "failed")
    return (
      <span
        className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-semibold"
        data-refused-order={why}
        role="alert"
      >
        <span aria-hidden className="size-2 flex-none rounded-full bg-[color:var(--hud-bad)]" />
        {reason.line}
      </span>
    );
  const face = shortfallFace(reason);
  return (
    <span
      className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-semibold"
      data-refused-order={why}
      data-held={reason.held}
      data-need={reason.need}
      data-wait={reason.wait}
      role="alert"
    >
      {face.icon && <Icon name={face.icon} size={16} />}
      <span>
        <span className="text-[color:var(--hud-bad)]">{face.held}</span> / {face.need}
      </span>
      {face.wait && <span className="font-normal">· {face.wait}</span>}
    </span>
  );
};
