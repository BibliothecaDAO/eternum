import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudCost, HudIconButton, HudRanked } from "@/ui/design-system/kit/hud-elements";
import { inTime, rankedText } from "@/ui/design-system/kit/words";
import type { OrderTip, RefusedOrder } from "@/ui/features/frontier/hud/order-tip";
import { formatHeldAgainst, formatWait } from "@bibliothecadao/types";

/**
 * The surface a tap opens on a tile the selected army can explore or move to where the HUD carries no verb (a Blitz
 * phone), or a desktop's right-click on one it could but not now.
 */
export const ORDER_PREVIEW_SURFACE = "order-preview";

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

const RefusedLine = ({ refused }: { refused: RefusedOrder }) => {
  if ("line" in refused)
    return (
      <span
        className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-semibold"
        data-refused-order
        role="alert"
      >
        <span aria-hidden className="size-2 flex-none rounded-full bg-[color:var(--hud-bad)]" />
        {refused.line}
      </span>
    );
  const { cost, held, wait } = refused.cost;
  const pair = formatHeldAgainst(held, cost);
  return (
    <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-semibold" data-refused-order role="alert">
      <Icon name={refused.of} size={16} />
      <span>
        <span className="text-[color:var(--hud-bad)]">{pair.held}</span>/{pair.need}
      </span>
      {wait !== undefined && <span className="font-normal">· {inTime(formatWait(wait))}</span>}
    </span>
  );
};
