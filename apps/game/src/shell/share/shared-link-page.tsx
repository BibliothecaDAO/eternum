import { useQuery } from "@tanstack/react-query";
import { aspectName, catalogAspectId, orders, ordersOfAspect } from "@bibliothecadao/types";
import { isShareChannel, sharedMomentOf, type OpenedShare } from "@realms-world/identity";
import { useParams, useSearchParams } from "react-router-dom";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { AppButton, AppNotice } from "@/ui/design-system/kit/app-elements";
import { AppCountdownChip } from "@/ui/design-system/kit/clock-chip";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { ASPECT_STEP_WORDS, SHARED_LINK_WORDS } from "@/ui/design-system/kit/words";

import { useSeasonCalendar } from "../season-calendar";
import { StageFrame } from "../frame/stage-frame";
import { ageOf } from "../play/ages";
import { CreateAccount } from "../play/season-countdown";
import { seasonOpening } from "../season";
import { useNowSeconds } from "../use-now";

/** A shared link's code as identity makes it; anything else in the address is no link. */
const SHARE_CODE = /^[A-Za-z0-9]{8}$/;

type Invite = Extract<OpenedShare, { kind: "aspect" }>;

/**
 * A shared link's landing (`/s/<code>`), where a friend lands from a player's post: who shared which day, or invites
 * them to which Aspect, what Frontier is, and the way in. Opening it records this browser's visit with identity, with the channel the link was posted from
 * (`?via=`), the one record that later ties an account made here to the post (apps/realms/server/shares.ts); the page asks nothing else of the visitor. A link that leads
 * nowhere still leads into the game.
 */
export const SharedLinkPage = () => {
  const { code } = useParams();
  const [search] = useSearchParams();
  const via = search.get("via");
  const valid = code !== undefined && SHARE_CODE.test(code);
  const opened = useQuery({
    queryKey: ["sharedLink", code],
    queryFn: () => identityClient.openShare(code!, isShareChannel(via) ? via : null),
    enabled: valid,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const signedIn = useIdentitySession().status === "signed-in";
  const calendar = useSeasonCalendar();
  const now = useNowSeconds();
  const opening = calendar.data ? seasonOpening(calendar.data.phases, now) : null;
  const notice = !valid || opened.isError ? <AppNotice tone="warn" line={SHARED_LINK_WORDS.unknown} /> : undefined;
  const shared = opened.data;
  return (
    <StageFrame notice={notice} verb={opening && !signedIn ? <CreateAccount /> : <StartAdventure />}>
      <img src={AGE_LOCKUP.frontier} alt={ageOf("frontier").name} className="h-28 w-auto" />
      {shared?.kind === "aspect" ? (
        <InviteCard invite={shared} />
      ) : (
        shared && (
          <h1 className="text-app-title text-app-ink">
            {SHARED_LINK_WORDS.title(shared.name, sharedMomentOf(shared, aspectName))}
          </h1>
        )
      )}
      {opening && <AppCountdownChip prefix="starts" at={opening.startsAt} now={now} />}
      <p className="text-app-body text-app-muted">
        {shared?.kind === "aspect" ? <InviteLine invite={shared} /> : SHARED_LINK_WORDS.pitch}
      </p>
    </StageFrame>
  );
};

const InviteCard = ({ invite }: { invite: Invite }) => {
  const aspectOrders = ordersOfAspect(catalogAspectId(invite.moment));
  return (
    <section data-shared-invite className="app-well flex w-full items-center gap-3 p-4 text-left">
      <span className="grid shrink-0 grid-cols-2 gap-1">
        {aspectOrders.map(({ orderId }) => (
          <OrderEmblem key={orderId} order={orderId} size={32} />
        ))}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-app-label text-app-muted">{SHARED_LINK_WORDS.invites(invite.name)}</span>
        <h1 className="text-app-title text-app-ink">{ASPECT_STEP_WORDS.join(aspectName(invite.moment))}</h1>
        <span className="text-app-label text-app-muted">
          {[
            ...(invite.members === null ? [] : [ASPECT_STEP_WORDS.members(invite.members)]),
            SHARED_LINK_WORDS.orders(aspectOrders.map(({ orderName }) => orderName)),
          ].join(" · ")}
        </span>
      </span>
    </section>
  );
};

const InviteLine = ({ invite }: { invite: Invite }) => {
  const order = orders.find(({ orderId }) => orderId === invite.order);
  return (
    <>
      {SHARED_LINK_WORDS.allies}
      {order && <> {SHARED_LINK_WORDS.plays(invite.name, order.fullOrderName)}</>}
    </>
  );
};

const StartAdventure = () => (
  <div className="flex justify-center">
    <AppButton kind="primary" size="lg" icon="play" step to="/">
      {SHARED_LINK_WORDS.play}
    </AppButton>
  </div>
);
