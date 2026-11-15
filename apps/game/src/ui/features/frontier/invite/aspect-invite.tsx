import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { getActiveGame } from "@/runtime/world";
import { useShareLink } from "@/shell/share/own-shares";
import { Icon } from "@/ui/design-system/icon";
import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudNotice, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { INVITE_WORDS } from "@/ui/design-system/kit/words";
import { openXPost } from "@/utils/x-post";
import { type NativeRows } from "@bibliothecadao/eternum/game-client";
import { aspectName, aspects, type AspectId, orders } from "@bibliothecadao/types";
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
  const aspect = joined && aspects.find(({ id }) => id === joined.aspect)?.id;
  const game = getActiveGame();
  if (!aspect || !game) return null;
  return <InviteToAspect aspect={aspect} chainId={game.chainId} gameId={realm.game_id} />;
};

const InviteToAspect = ({ aspect, chainId, gameId }: { aspect: AspectId; chainId: string; gameId: number }) => {
  const link = useShareLink({ kind: "aspect", chainId, gameId, moment: aspect });
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  const name = aspectName(aspect);
  const waiting = link.code === undefined ? INVITE_WORDS.making : undefined;
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
    <HudPanel label={INVITE_WORDS.title(name)} collapsible={false} bodyClassName="flex flex-col gap-2">
      <span className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-0.5">
          {orders
            .filter((order) => order.aspect === aspect)
            .map(({ orderId }) => (
              <Icon key={orderId} name={orderMeaning(orderId)} size={24} />
            ))}
        </span>
        <span className="text-hud-strong text-hud-ink">{INVITE_WORDS.title(name)}</span>
      </span>
      <span className="flex gap-2">
        <HudButton kind="primary" size="sm" icon="share" busy={waiting} onClick={post}>
          {INVITE_WORDS.post}
        </HudButton>
        <HudButton kind="secondary" size="sm" icon="copy" busy={waiting} onClick={copy}>
          {copied === "copied" ? INVITE_WORDS.copied : INVITE_WORDS.copy}
        </HudButton>
      </span>
      {link.failed && <HudNotice tone="bad" line={INVITE_WORDS.failed} retry={link.retry} />}
      {copied === "failed" && <HudNotice tone="bad" line={INVITE_WORDS.copyFailed} />}
    </HudPanel>
  );
};
