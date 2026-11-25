import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { getActiveGame } from "@/runtime/world";
import { useOwnInvite } from "@/shell/share/own-shares";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { INVITE_WORDS } from "@/ui/design-system/kit/words";
import { openXPost } from "@/utils/x-post";
import { type NativeRows } from "@bibliothecadao/eternum/game-client";
import { aspectName, ordersOfAspect, type AspectId } from "@bibliothecadao/types";
import { useState } from "react";

const INVITE_MODELS = ["HomeAspect"] as const;

/**
 * Invite a friend to the player's Aspect (U13): its name and its four Orders' crests, then Post on X or Copy link with
 * the player's own invite link, which lands the friend on the Aspect's name and offers it to them first at founding.
 * Nothing for a home that joined no Aspect (a game without Aspects).
 */
export const AspectInvite = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  useNativeRevision(INVITE_MODELS);
  const joined = setup.store.get("HomeAspect", { game_id: realm.game_id, home: realm.entity_id });
  if (!joined || !getActiveGame()) return null;
  return <InviteToAspect />;
};

const InviteToAspect = () => {
  const link = useOwnInvite();
  if (link.aspect === null)
    return link.failed ? <HudNotice tone="bad" line={INVITE_WORDS.failed} retry={link.retry} /> : null;
  return <InviteLink link={link} aspect={link.aspect} />;
};

const InviteLink = ({ link, aspect }: { link: ReturnType<typeof useOwnInvite>; aspect: AspectId }) => {
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  const name = aspectName(aspect);
  const waiting = link.code === undefined && !link.failed ? INVITE_WORDS.making : undefined;
  const post = () => {
    openXPost(INVITE_WORDS.line(name), link.url("x"));
    link.posted();
  };
  const copy = () =>
    navigator.clipboard.writeText(link.url("system")).then(
      () => setCopied("copied"),
      () => setCopied("failed"),
    );
  return (
    <section aria-label={INVITE_WORDS.title(name)} className="flex flex-col gap-2">
      <span className="flex items-center gap-2.5">
        <AspectMark aspect={aspect} size={28} decorative />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-hud-strong text-hud-ink">{INVITE_WORDS.title(name)}</span>
          <span className="flex items-center gap-1.5">
            {ordersOfAspect(aspect).map(({ orderId }) => (
              <Icon key={orderId} name={orderMeaning(orderId)} size={20} />
            ))}
          </span>
        </span>
      </span>
      <span className="flex gap-2">
        <HudButton
          kind="secondary"
          size="sm"
          icon="share"
          busy={waiting}
          disabled={link.code === undefined}
          onClick={post}
        >
          {INVITE_WORDS.post}
        </HudButton>
        <HudButton
          kind="secondary"
          size="sm"
          icon="copy"
          busy={waiting}
          disabled={link.code === undefined}
          onClick={copy}
        >
          {copied === "copied" ? INVITE_WORDS.copied : INVITE_WORDS.copy}
        </HudButton>
      </span>
      {link.failed && <HudNotice tone="bad" line={INVITE_WORDS.failed} retry={link.retry} />}
      {copied === "failed" && <HudNotice tone="bad" line={INVITE_WORDS.copyFailed} />}
    </section>
  );
};
