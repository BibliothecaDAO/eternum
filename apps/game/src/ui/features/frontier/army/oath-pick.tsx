import { useState } from "react";
import type { Account } from "starknet";
import { heldOaths, oathCards, oathColours } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useGame } from "@/hooks/context/game-context";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { HudButton, HudCard } from "@/ui/design-system/kit/hud-elements";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { toast } from "@/ui/features/event-feed/notify";
import { oathName } from "./oath-names";

const colourClass = {
  red: "border-hud-bad text-hud-bad",
  blue: "border-hud-ally text-hud-ally",
  gold: "border-hud-gold text-hud-gold",
} satisfies Record<(typeof oathColours)[number]["colour"], string>;

export function ArmyOathPick({ explorerId, progress }: { explorerId: number; progress: NativeRows["ArmyProgress"] }) {
  const { setup, account } = useGame();
  const allowed = useUIStore(canIssueOrders);
  const sending = useInFlight("army", explorerId) !== undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const held = heldOaths(progress.oaths);
  const full = held.length === progress.oath_slots;
  const choose = (oath: number | null, replace: number | null = null) =>
    sendOnce("army", explorerId, { order: "use" }, () =>
      setup.systemCalls.choose_oath({
        signer: account.account as unknown as Account,
        explorerId,
        expectedPick: progress.oath_pick,
        oath,
        replace,
      }),
    ).catch((error: unknown) => toast.failed(error, "The Oath could not be chosen."));

  return (
    <section aria-label="Choose an Oath" className="flex flex-col gap-2" data-oath-pick={progress.oath_pick}>
      <span className="text-hud-label text-hud-ink">
        {picked === null ? "Choose an Oath" : "Choose an Oath to replace"}
      </span>
      {picked === null ? (
        <div className="grid grid-cols-3 gap-1">
          {oathCards(progress.oath_pick).map((id, index) => (
            <div
              key={id}
              data-oath-id={id}
              className={`min-w-0 rounded border-t-4 ${colourClass[oathColours[index]!.colour]}`}
            >
              <HudCard
                size="sm"
                title={oathName(id)}
                picture={<OrderEmblem order={id} size={40} />}
                detail={<span className={colourClass[oathColours[index]!.colour]}>{oathColours[index]!.name}</span>}
                disabled={!allowed || sending}
                onClick={() => (full ? setPicked(id) : void choose(id))}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {held.map((id) => (
            <HudButton
              key={id}
              kind="secondary"
              disabled={!allowed || sending}
              onClick={() => void choose(picked, id)}
              data-replace-oath={id}
              aria-label={`Replace ${oathName(id)}`}
            >
              <OrderEmblem order={id} />
              {oathName(id)}
            </HudButton>
          ))}
          <HudButton kind="secondary" disabled={sending} onClick={() => setPicked(null)}>
            Back
          </HudButton>
        </div>
      )}
      <HudButton kind="secondary" disabled={!allowed || sending} onClick={() => void choose(null)}>
        Keep my Oaths
      </HudButton>
    </section>
  );
}
