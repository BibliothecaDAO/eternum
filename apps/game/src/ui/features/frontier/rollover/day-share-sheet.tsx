import "./day-share-sheet.css";

import { configManager, getStructureName } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatShort } from "@bibliothecadao/types";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useGame } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePlayerName, usePlayerNames } from "@/hooks/use-player-profile";
import { getActiveGame } from "@/runtime/world";
import { useLayout } from "@/shell/frame/layout";
import { ageOf } from "@/shell/play/ages";
import { DayCard, type SharedDay } from "@/shell/share/day-card";
import { useShareLink, useShareTally } from "@/shell/share/own-shares";
import { usePreparedCard } from "@/shell/share/prepared-card";
import { shareHint, StepNumber, useShareSteps } from "@/shell/share/share-steps";
import { HudButton, HudIconButton, HudModalLayer, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { CLOSE, DAY_SHARE_WORDS, SHARE_WORDS } from "@/ui/design-system/kit/words";
import { CARD_CUTS, canShareCardFile, cardJpeg, type CardCut } from "@/utils/card-image";

import type { usePlayerDay } from "../log/player-day";
import { useClosingRankChange } from "./day-ranks";
import { dayBest, dayPostText, dayTrail } from "./day-share";
import { SystemShare } from "./system-share";

/**
 * Sharing a Frontier day, from the day-done card or Today's page of an ended day (useDayShare), in the HUD's modal
 * layer: the day's card at the size it is shared, fitted to the screen, then the two steps (Copy image, Post on X). A
 * phone whose share sheet takes images also gets Share above them, to any app (owner, 7 November 2026: the day's card
 * goes past X; the season's recap stays X only). A desktop draws the wide cut, a phone the tall one, as the season's
 * recap does; the link always unfurls as the wide cut, which a phone draws out of sight for it. The post's link is the
 * player's own for this day (identity's shared links, made as the sheet opens so a post opens within the press), with
 * the channel it was posted from; while it is made, or where it cannot be, the post links the game itself. Nothing
 * leaves the device until the player presses a way to post: that press publishes the card the link unfurls as
 * (useCardPublication).
 */
export const DayShareSheet = ({ shared, onClose }: { shared: SharedDay; onClose: () => void }) => {
  const phone = useLayout() === "phone";
  const cut: CardCut = phone ? "tall" : "wide";
  const systemShare = phone && canShareCardFile();
  const size = CARD_CUTS[cut];
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const [wideOutOfSight, setWideOutOfSight] = useState<HTMLDivElement | null>(null);
  const [frame, width] = useWidth();
  const link = useShareLink({ kind: "frontier-day", ...shared.game, moment: shared.day });
  // The card is made into an image once it shows all it will: whose day it is, and its closing rank once Herald answers.
  const drawn = usePlayerName(shared.player)?.state !== "waiting" && shared.rank !== undefined;
  // What the card is drawn from: the day as shared (plain values, compared by what they say) and the names reader.
  const names = usePlayerNames();
  const drawnFrom = [JSON.stringify(shared), names];
  const publish = useCardPublication(link, cut === "wide" ? card : wideOutOfSight, drawnFrom, drawn);
  const line = dayPostText({ ...shared, game: ageOf("frontier").name });
  const fileName = DAY_SHARE_WORDS.fileName(shared.day);
  const steps = useShareSteps({
    card,
    size,
    fileName,
    line,
    url: link.url("x"),
    ready: drawn,
    onPost: () => {
      publish();
      link.posted();
    },
  });
  return (
    <HudModalLayer onClose={onClose}>
      <section role="dialog" aria-modal="true" aria-label={DAY_SHARE_WORDS.share} className="day-share">
        <div className="day-share__layout">
          <header className="day-share__head">
            <h1 className="text-hud-display">{DAY_SHARE_WORDS.share}</h1>
            <HudIconButton icon="close" label={CLOSE} kind="quiet" onClick={onClose} />
          </header>
          <div
            ref={frame}
            data-surface="shell"
            className="day-share__frame"
            data-cut={cut}
            style={{ aspectRatio: `${size.width} / ${size.height}` }}
          >
            <div className="day-share__scaler" style={{ transform: `scale(${(width ?? size.width) / size.width})` }}>
              <DayCard cardRef={setCard} cut={cut} shared={shared} />
            </div>
          </div>
          {cut === "tall" && (
            <div data-surface="shell" className="day-share__out-of-sight" aria-hidden>
              <DayCard cardRef={setWideOutOfSight} cut="wide" shared={shared} />
            </div>
          )}
          <footer className="day-share__foot">
            <ShareTally />
            {systemShare && (
              <span className="day-share__system">
                <SystemShare
                  card={card}
                  size={size}
                  fileName={fileName}
                  line={line}
                  url={link.url("system")}
                  drawnFrom={[...drawnFrom, cut]}
                  ready={drawn && link.code !== undefined}
                  onPress={publish}
                  onShared={link.posted}
                />
              </span>
            )}
            <p className="day-share__hint text-hud-label text-hud-muted">{shareHint()}</p>
            <span className="day-share__steps">
              <HudButton kind="secondary" icon="copy" busy={steps.making} onClick={steps.take}>
                <StepNumber number={1} />
                {steps.word}
              </HudButton>
              <HudButton
                kind={systemShare ? "secondary" : "primary"}
                icon="twitter"
                busy={steps.posting}
                onClick={steps.post}
              >
                <StepNumber number={2} />
                {SHARE_WORDS.post}
              </HudButton>
              {steps.failed && <HudNotice tone="bad" line={SHARE_WORDS.failed} />}
            </span>
          </footer>
        </div>
      </section>
    </HudModalLayer>
  );
};

/** What sharing a day reads of the player's day (usePlayerDay). */
type PlayedDay = Pick<ReturnType<typeof usePlayerDay>, "history" | "totals" | "stories">;

/**
 * Sharing an ended day of a realm, for the day-done card and for Today's page of that day: the way to open its sheet,
 * absent when the day is not the signed-in player's to share, and the sheet while open. The realm is the card's one
 * source for whose day it is and what the card names: its owner, its name and its Order. Only the player's own realm's
 * day is theirs to share (Today also shows a watched realm's), only one they played (a day with none of their own
 * stories has nothing to share), and only whole: its card never shows a total the player's history only half gives.
 */
export const useDayShare = (realm: NativeRows["Structure"] | null, endedDay: number | undefined, played: PlayedDay) => {
  const { setup } = useGame();
  const signedIn = useAccountStore((state) => state.account?.address ?? null);
  const own = realm !== null && signedIn !== null && BigInt(realm.owner) === BigInt(signedIn);
  const rank = useClosingRankChange(own ? endedDay : undefined);
  const [openFor, setOpenFor] = useState<number | null>(null);
  const chainId = getActiveGame()?.chainId;
  const shared: SharedDay | null =
    own && endedDay !== undefined && chainId && played.history === "whole" && played.stories.length > 0
      ? {
          player: signedIn,
          game: { chainId, gameId: configManager.getActiveGameId() },
          day: endedDay,
          totals: played.totals,
          rank,
          trail: dayTrail(played.stories),
          best: dayBest(played.stories, played.totals.reveals ?? 0),
          realm: realmOnCard(realm, setup.store),
        }
      : null;
  return {
    onShare: shared ? () => setOpenFor(shared.day) : undefined,
    sheet: shared && openFor === shared.day && <DayShareSheet shared={shared} onClose={() => setOpenFor(null)} />,
  };
};

/** The realm as the card names it: its name, and its Order where it was given one. */
const realmOnCard = (realm: NativeRows["Structure"], store: NativeFactStore): SharedDay["realm"] => ({
  name: getStructureName(realm, store).name,
  order: realm.metadata.order > 0 ? realm.metadata.order : undefined,
});

/**
 * The card the link unfurls as, published by the player's press of a way to post (Post on X, Share) and by nothing
 * else, and only ever the card as drawn at that press. The wide card's JPEG is made ahead from the values it is drawn
 * from (usePreparedCard); a press asks for that snapshot, and it is handed to identity once made, usually before the
 * post's page has opened. A card not yet whole, or changed since the press, is not published: the link keeps the
 * game's own preview until a press finds a whole card. One upload per snapshot, however often it is pressed; a press
 * after the card changed publishes the new one. Uploads go one after another, so the link keeps the last press's card,
 * and a failed one lets the next press try again. Closing the sheet without a press publishes nothing.
 */
const useCardPublication = (
  link: ReturnType<typeof useShareLink>,
  card: HTMLDivElement | null,
  drawnFrom: readonly unknown[],
  ready: boolean,
) => {
  const prepared = usePreparedCard(card, drawnFrom, ready, (node) => cardJpeg(node, CARD_CUTS.wide));
  const [asked, setAsked] = useState<{ snapshot: unknown } | null>(null);
  const published = useRef<unknown>(null);
  const uploads = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    const { snapshot, image } = prepared;
    if (asked?.snapshot !== snapshot || !image || published.current === snapshot) return;
    published.current = snapshot;
    uploads.current = uploads.current
      .then(() => link.publish(image))
      .catch(() => {
        if (published.current === snapshot) published.current = null;
      });
  }, [asked, prepared, link]);
  return () => link.code && setAsked({ snapshot: prepared.snapshot });
};

/** What the player's shared days brought so far (identity's count), said once they brought a visit; nothing before. */
const ShareTally = () => {
  const tally = useShareTally();
  if (!tally || tally.visits === 0) return null;
  return (
    <p className="day-share__tally text-hud-label text-hud-gold">
      {DAY_SHARE_WORDS.brought(formatShort(tally.visits), formatShort(tally.joined))}
    </p>
  );
};

/** The frame's width as laid out, which the card is scaled to; null until measured. */
const useWidth = () => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width] as const;
};
