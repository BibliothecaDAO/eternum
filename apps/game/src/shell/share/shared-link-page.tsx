import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { isShareChannel } from "@realms-world/identity";
import { useParams, useSearchParams } from "react-router-dom";

import { identityClient } from "@/hooks/context/identity-session";
import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { AppButton, AppNotice } from "@/ui/design-system/kit/app-elements";
import { SHARED_LINK_WORDS } from "@/ui/design-system/kit/words";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { ageOf } from "../play/ages";

/** A shared link's code as identity makes it; anything else in the address is no link. */
const SHARE_CODE = /^[A-Za-z0-9]{8}$/;

/**
 * A shared link's landing (`/s/<code>`), where a friend lands from a player's post: who shared which day, what Frontier
 * is, and the way in. Opening it records this browser's visit with identity, with the channel the link was posted from
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
  const notice = !valid || opened.isError ? <AppNotice tone="warn" line={SHARED_LINK_WORDS.unknown} /> : undefined;
  return (
    <SharedFrame notice={notice}>
      <img src={AGE_LOCKUP.frontier} alt={ageOf("frontier").name} className="h-28 w-auto" />
      {opened.data && (
        <h1 className="text-app-title text-app-ink">
          {SHARED_LINK_WORDS.sharedDay(opened.data.name, opened.data.moment)}
        </h1>
      )}
      <p className="text-app-body text-app-muted">{SHARED_LINK_WORDS.pitch}</p>
    </SharedFrame>
  );
};

/**
 * The landing on Frontier's painting, its one verb at a phone's foot or under its words on a desktop. It has no page
 * title: Frontier's crest above the words already names the game (owner, 9 November 2026: "double frontier feels
 * weird").
 */
const SharedFrame = ({ notice, children }: { notice: ReactNode; children: ReactNode }) => {
  const phone = useLayout() === "phone";
  const verb = (
    <div className="flex justify-center">
      <AppButton kind="primary" size="lg" icon="play" step to="/">
        {SHARED_LINK_WORDS.play}
      </AppButton>
    </div>
  );
  return (
    <PageFrame painting="frontier-mist" stage notice={notice} foot={phone ? verb : undefined}>
      <div className="mx-auto flex max-w-[28rem] flex-col items-center gap-5 pt-4 text-center">
        {children}
        {!phone && verb}
      </div>
    </PageFrame>
  );
};
