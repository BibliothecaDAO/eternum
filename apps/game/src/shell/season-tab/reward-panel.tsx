import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { lazy, type ReactNode, Suspense, useState } from "react";

import { formatExact } from "@/ui/design-system/kit/amount";
import { formatDate } from "@/ui/design-system/kit/time";
import { Button } from "@/ui/design-system/kit/button";
import { IconLine } from "@/ui/design-system/kit/icon-line";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { getChestAssetFromAttributesRaw } from "@/ui/features/cosmetics/chest-opening/utils/cosmetics";

import { Loading } from "../loading";
import { ServiceFailure } from "../service-failure";
import { useNowSeconds } from "../use-now";
import type { ChestContent } from "@realms-world/value-ledger/codecs";
import { type EnvironmentLedger, lordsOf, openChestCalls } from "../value/ledger";
import { REWARD_WORDS } from "../words";
import { entryMultipleOf, type PlayedGameKeys, type Reward, rewardState, useReward } from "./reward";

const WalletSign = lazy(() =>
  import("@/ui/modules/identity/wallet-actions").then((module) => ({ default: module.WalletSign })),
);

/** Each rank band's chest, sealed or opened (0 the top 10 percent .. 4 the bottom 25). */
const chestArt = (band: number, opened: boolean) =>
  `/images/blitz-chests/band-${band}-${opened ? "opened" : "sealed"}.webp`;

/**
 * After a paid Blitz: the rated game's MMR change with the sword or shield applied, and the mystery chest the result
 * minted for the player's rank band. Both belong to the seat's wallet, the one the shard's roster froze at slot close,
 * whatever the payout wallet is now.
 * A sealed chest shows its band and, where that band draws tokens, how many times the entry they are. Open is one
 * signature from that wallet; the draw then lands by
 * itself about ten blocks later, and the reveal plays inside this panel. A chest not opened stays in the collection,
 * tradeable.
 * Nothing is drawn for an account that held no seat in the game.
 */
export const RewardPanel = ({
  ledger,
  keys,
  owner,
}: {
  ledger: EnvironmentLedger;
  keys: PlayedGameKeys;
  /** The seat's wallet from the shard's roster. */
  owner: string;
}) => {
  const reward = useReward(ledger, keys, owner);
  if (reward.isError)
    return <ServiceFailure service="ledger" error={reward.error} retry={() => void reward.refetch()} />;
  if (!reward.data) return null;
  return (
    <div className="flex flex-col gap-4">
      {reward.data.result.rank > 0 && <RatingChange reward={reward.data} />}
      <ChestPlate
        ledger={ledger.address}
        owner={owner}
        reward={reward.data}
        onRequested={() => void reward.refetch()}
      />
    </div>
  );
};

const RatingChange = ({ reward }: { reward: Reward }) => {
  const { mmrBefore, mmrAfter } = reward.result;
  const gain = mmrAfter >= mmrBefore;
  const flag = gain
    ? reward.registration.sword && { icon: "attack" as const, word: "×2" }
    : reward.registration.shield && { icon: "defend" as const, word: "½" };
  return (
    <Plate icon="rating-conqueror" title={REWARD_WORDS.rating}>
      <p className="flex items-center gap-3 font-body text-title font-extrabold tabular-nums">
        <span className="text-kit-muted">{formatExact(mmrBefore)}</span>
        <SemanticIcon name="arrow-right" size={22} />
        <span className="text-kit-cream">{formatExact(mmrAfter)}</span>
        <span className={cn("ml-auto text-heading", gain ? "text-kit-sage" : "text-kit-red")}>
          {gain ? "+" : "−"}
          {formatExact(Math.abs(mmrAfter - mmrBefore))}
        </span>
        {flag && (
          <span className="inline-flex items-center gap-1 font-body text-lg text-kit-gold2">
            <SemanticIcon name={flag.icon} size={26} />
            {flag.word}
          </span>
        )}
      </p>
    </Plate>
  );
};

const ChestPlate = ({
  ledger,
  owner,
  reward,
  onRequested,
}: {
  /** The environment's ledger address. */
  ledger: string;
  owner: string;
  reward: Reward;
  onRequested: () => void;
}) => {
  const now = useNowSeconds();
  const [signing, setSigning] = useState(false);
  const state = rewardState(reward, owner);
  const band = reward.chest?.band ?? 0;

  if (state === "pending")
    return (
      <Plate icon="chest" title={REWARD_WORDS.chest}>
        <ChestArt band={band} dim />
        <IconLine tone="muted" icon="hourglass">
          {REWARD_WORDS.arrives}
        </IconLine>
      </Plate>
    );
  if (state === "opened")
    return (
      <Plate icon="chest" title={REWARD_WORDS.chest}>
        <Stage>
          {reward.content ? <Prize content={reward.content} entryFee={reward.token.entryFee} /> : <Loading />}
        </Stage>
      </Plate>
    );
  if (state === "opening")
    return (
      <Plate icon="chest" title={REWARD_WORDS.chest}>
        <Stage>
          <img src={chestArt(band, true)} alt="" className="relative size-48 animate-pulse object-contain" />
          <span className="relative font-body text-xl text-kit-gold2">{REWARD_WORDS.opening}</span>
        </Stage>
      </Plate>
    );
  if (state === "traded")
    return (
      <Plate icon="chest" title={REWARD_WORDS.chest}>
        <ChestArt band={band} dim />
        <IconLine tone="muted" icon="chronicles">
          {REWARD_WORDS.traded}
        </IconLine>
      </Plate>
    );
  const open = signing ? (
    <Suspense fallback={<Loading />}>
      <WalletSign
        owner={owner}
        calls={openChestCalls(ledger, reward.collection, reward.result.chestId)}
        // The request is the chest's last move from this wallet: it is read again once the request is on chain.
        onLanded={() => {
          setSigning(false);
          onRequested();
        }}
      />
    </Suspense>
  ) : null;
  return (
    <Plate icon="chest" title={REWARD_WORDS.chest}>
      <ChestArt band={band} glow={state === "sealed"} />
      {reward.token.shares > 0 && (
        <p className="flex flex-wrap gap-2">
          <TokensUntil shares={reward.token.shares} seasonEnd={reward.seasonEnd} now={now} />
        </p>
      )}
      {open ?? <Button role="primary" word={REWARD_WORDS.open} icon="chest" onClick={() => setSigning(true)} />}
    </Plate>
  );
};

/**
 * What a sealed chest of a token band can pay, as a multiple of its slot's entry and never an amount, and the one
 * rule it carries: only while its season runs.
 */
const TokensUntil = ({ shares, seasonEnd, now }: { shares: number; seasonEnd: number; now: number }) =>
  now < seasonEnd ? (
    <Chip icon="lords" word={REWARD_WORDS.entryUntil(shares, formatDate(seasonEnd))} tone="text-kit-gold2" />
  ) : (
    <Chip icon="lords" word={REWARD_WORDS.noLords} tone="text-kit-muted" struck />
  );

/** What the chest delivered: an item, tokens as a multiple of the slot's entry with the sum sent, or a credit. */
const Prize = ({ content, entryFee }: { content: ChestContent; entryFee: bigint }) => {
  if (content.kind === "cosmetic") {
    const item = getChestAssetFromAttributesRaw(content.attributes);
    return (
      <Card>
        {item && <img src={item.imagePath} alt="" className="size-40 rounded-control object-cover" />}
        <span className="rounded-full border border-kit-line2 px-3 py-1 font-body text-sm font-bold capitalize text-kit-gold2">
          {item?.rarity ?? REWARD_WORDS.cosmetic}
        </span>
        <b className="font-body text-[30px] font-bold leading-tight text-kit-cream">
          {item?.name ?? REWARD_WORDS.cosmetic}
        </b>
        <Chip icon="check" word={REWARD_WORDS.inCollection} tone="text-kit-sage" />
      </Card>
    );
  }
  if (content.kind === "lords") return <TokenPrize amount={content.amount} entryFee={entryFee} />;
  return (
    <Card>
      <SemanticIcon name={content.kind === "sword" ? "attack" : "defend"} size={96} />
      <b className="font-body text-[30px] font-bold leading-tight text-kit-cream">
        {content.kind === "sword" ? REWARD_WORDS.swordCredit : REWARD_WORDS.shieldCredit}
      </b>
      <Chip icon="lords" word={REWARD_WORDS.nextEntry} tone="text-kit-muted" />
    </Card>
  );
};

/**
 * Tokens from a chest: how many times the entry they are, with the sum sent beside. Where no entry fee divides the
 * sum, the sum stands alone.
 */
const TokenPrize = ({ amount, entryFee }: { amount: bigint; entryFee: bigint }) => {
  const multiple = entryMultipleOf(amount, entryFee);
  const sum = formatExact(lordsOf(amount));
  return (
    <Card>
      <SemanticIcon name="lords" size={96} />
      <b className="font-body text-[60px] font-bold leading-none tabular-nums text-kit-gold2">
        {multiple === null ? sum : `${multiple}×`}
      </b>
      <span className="font-body text-xl text-kit-muted">
        {multiple === null ? REWARD_WORDS.lords : REWARD_WORDS.theEntry}
      </span>
      {multiple !== null && <Chip icon="lords" word={`${sum} ${REWARD_WORDS.lords}`} tone="text-kit-gold2" />}
      <Chip icon="check" word={REWARD_WORDS.lordsSent} tone="text-kit-sage" />
    </Card>
  );
};

const ChestArt = ({ band, dim = false, glow = false }: { band: number; dim?: boolean; glow?: boolean }) => (
  <div
    className={cn(
      "relative flex h-48 items-center justify-center rounded-control",
      glow && "bg-[radial-gradient(circle,theme(colors.kit.gold/30%),transparent_65%)]",
    )}
  >
    <img src={chestArt(band, false)} alt="" className={cn("size-44 object-contain", dim && "opacity-40 grayscale")} />
    <span className="absolute bottom-1 left-1">
      <Chip icon="victory" word={REWARD_WORDS.band[band] ?? REWARD_WORDS.band[0]} tone="text-kit-muted" />
    </span>
  </div>
);

const Stage = ({ children }: { children: ReactNode }) => (
  <div className="relative isolate flex min-h-[22rem] flex-col items-center justify-center gap-3 overflow-hidden rounded-control bg-kit-ink py-4">
    <span
      aria-hidden
      className="absolute left-1/2 top-[45%] -z-10 size-[56rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[repeating-conic-gradient(theme(colors.kit.gold/18%)_0_6deg,transparent_6deg_18deg)] [mask-image:radial-gradient(circle,black,transparent_55%)]"
    />
    {children}
  </div>
);

const Card = ({ children }: { children: ReactNode }) => (
  <div className="relative flex w-[85%] flex-col items-center gap-2.5 rounded-plate border-2 border-kit-gold bg-kit-plate/95 px-4 py-5 text-center">
    {children}
  </div>
);

const Plate = ({ icon, title, children }: { icon: IconMeaning; title: string; children: ReactNode }) => (
  <section className="plate flex flex-col gap-4 p-5">
    <h2 className="flex items-center gap-2.5 border-b border-kit-line pb-3 font-body text-lg text-kit-cream">
      <SemanticIcon name={icon} size={26} />
      {title}
    </h2>
    {children}
  </section>
);

const Chip = ({
  icon,
  word,
  tone,
  struck = false,
}: {
  icon: IconMeaning;
  word: string;
  tone: string;
  struck?: boolean;
}) => (
  <span
    className={cn(
      "inline-flex h-9 items-center gap-1.5 rounded-full border border-kit-line2 bg-kit-ink pl-2 pr-3 font-body text-base font-bold",
      tone,
    )}
  >
    <span className={cn("relative", struck && "opacity-60")}>
      <SemanticIcon name={icon} size={20} />
      {struck && <span aria-hidden className="absolute left-0 top-1/2 h-0.5 w-5 -rotate-45 bg-kit-red" />}
    </span>
    {word}
  </span>
);
