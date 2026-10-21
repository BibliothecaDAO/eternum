import { rewardChestMeaning } from "@/ui/design-system/domain-icon-meaning";
import { REWARD_WORDS } from "@/ui/design-system/kit/words";
import { formatExact, formatDate } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { lazy, type ReactNode, Suspense, useState } from "react";

import { AppButton, AppChip, AppFigure, AppPanel } from "@/ui/design-system/kit/app-elements";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { getChestAssetFromAttributesRaw } from "@/ui/features/cosmetics/chest-opening/utils/cosmetics";

import { Loading } from "../loading";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { useNowSeconds } from "../use-now";
import { CHEST_DRAW_BLOCKS, type ChestContent } from "@realms-world/value-ledger/codecs";
import { type EnvironmentLedger, lordsOf, openChestCalls } from "../value/ledger";
import {
  entryMultipleOf,
  type PlayedGameKeys,
  type Reward,
  rewardState,
  useFinishOnceDrawn,
  useReward,
} from "./reward";

const WalletSign = lazy(() =>
  import("@/shell/value/wallet-actions").then((module) => ({ default: module.WalletSign })),
);

/**
 * After a paid Blitz: the rated game's MMR change with the sword or shield applied, and the mystery chest the result
 * minted for the player's rank band. Both belong to the seat's wallet, the one the shard's roster froze at slot close,
 * whatever the payout wallet is now.
 * A sealed chest shows its band and, where that band draws tokens, how many times the entry they are. Open is one
 * signature from that wallet; the draw then waits for Starknet's next blocks, shown filling, is finished by the relay the
 * moment it can be, and the reveal plays inside this panel. A chest not opened stays in the collection,
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
      <p className="flex flex-wrap items-center gap-3 text-app-title">
        <span className="text-app-muted">{formatExact(mmrBefore)}</span>
        <SemanticIcon name="arrow-right" size={22} />
        <span className="text-app-ink">{formatExact(mmrAfter)}</span>
        <span className="ml-auto flex items-center gap-2">
          <AppChip tone={gain ? "good" : "bad"}>
            {gain ? "+" : "−"}
            {formatExact(Math.abs(mmrAfter - mmrBefore))}
          </AppChip>
          {flag && (
            <AppChip icon={flag.icon} tone="gold">
              {flag.word}
            </AppChip>
          )}
        </span>
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
  const band = reward.chest?.band;
  const chestIcon = rewardChestMeaning(band, state === "opening" || state === "opened");

  if (state === "pending")
    return (
      <Plate icon={chestIcon} title={REWARD_WORDS.chest}>
        <ChestArt band={band} dim />
        <RewardLine icon="hourglass">{REWARD_WORDS.arrives}</RewardLine>
      </Plate>
    );
  if (state === "opened")
    return (
      <Plate icon={chestIcon} title={REWARD_WORDS.chest}>
        <Stage>
          {reward.content ? <Prize content={reward.content} entryFee={reward.token.entryFee} /> : <Loading />}
        </Stage>
      </Plate>
    );
  if (state === "opening")
    return (
      <Plate icon={chestIcon} title={REWARD_WORDS.chest}>
        <Stage>
          <DrawingChest icon={chestIcon} chestId={reward.result.chestId} blocksLeft={reward.drawBlocksLeft} />
        </Stage>
      </Plate>
    );
  if (state === "traded")
    return (
      <Plate icon={chestIcon} title={REWARD_WORDS.chest}>
        <ChestArt band={band} dim />
        <RewardLine icon="chronicles">{REWARD_WORDS.traded}</RewardLine>
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
    <Plate icon={chestIcon} title={REWARD_WORDS.chest}>
      <ChestArt band={band} glow={state === "sealed"} />
      {reward.token.shares > 0 && (
        <p className="flex flex-wrap gap-2">
          <TokensUntil shares={reward.token.shares} seasonEnd={reward.seasonEnd} now={now} />
        </p>
      )}
      {open ?? (
        <AppButton kind="primary" size="lg" icon={chestIcon} step onClick={() => setSigning(true)}>
          {REWARD_WORDS.open}
        </AppButton>
      )}
    </Plate>
  );
};

/**
 * What a sealed chest of a token band can pay, as a multiple of its slot's entry and never an amount, and the one
 * rule it carries: only while its season runs.
 */
const TokensUntil = ({ shares, seasonEnd, now }: { shares: number; seasonEnd: number; now: number }) =>
  now < seasonEnd ? (
    <AppChip tone="gold" icon="lords">
      {REWARD_WORDS.entryUntil(shares, formatDate(seasonEnd))}
    </AppChip>
  ) : (
    <AppChip icon="lords">
      <s>{REWARD_WORDS.noLords}</s>
    </AppChip>
  );

/** What the chest delivered: an item, tokens as a multiple of the slot's entry with the sum sent, or a credit. */
const Prize = ({ content, entryFee }: { content: ChestContent; entryFee: bigint }) => {
  if (content.kind === "cosmetic") {
    const item = getChestAssetFromAttributesRaw(content.attributes);
    return (
      <Card>
        {item && <img src={item.imagePath} alt="" className="size-40 rounded-control object-cover" />}
        <AppChip tone="gold">
          <span className="capitalize">{item?.rarity ?? REWARD_WORDS.cosmetic}</span>
        </AppChip>
        <b className="text-app-title text-app-ink">{item?.name ?? REWARD_WORDS.cosmetic}</b>
        <AppChip tone="good" icon="check">
          {REWARD_WORDS.inCollection}
        </AppChip>
      </Card>
    );
  }
  if (content.kind === "lords") return <TokenPrize amount={content.amount} entryFee={entryFee} />;
  return (
    <Card>
      <SemanticIcon name={content.kind === "sword" ? "attack" : "defend"} size={96} />
      <b className="text-app-title text-app-ink">
        {content.kind === "sword" ? REWARD_WORDS.swordCredit : REWARD_WORDS.shieldCredit}
      </b>
      <AppChip icon="lords">{REWARD_WORDS.nextEntry}</AppChip>
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
      <AppFigure
        icon="lords"
        tone="gold"
        value={multiple === null ? sum : `${multiple}×`}
        label={multiple === null ? REWARD_WORDS.lords : REWARD_WORDS.theEntry}
      />
      {multiple !== null && (
        <AppChip tone="gold" icon="lords">
          {`${sum} ${REWARD_WORDS.lords}`}
        </AppChip>
      )}
      <AppChip tone="good" icon="check">
        {REWARD_WORDS.lordsSent}
      </AppChip>
    </Card>
  );
};

const ChestArt = ({ band, dim = false, glow = false }: { band?: number; dim?: boolean; glow?: boolean }) => (
  <div className={cn("relative flex h-48 items-center justify-center rounded-control", glow && "bg-halo")}>
    <SemanticIcon name={rewardChestMeaning(band)} size={176} className={cn(dim && "opacity-40 grayscale")} />
    <span className="absolute bottom-1 left-1">
      <AppChip icon="victory">{band === undefined ? REWARD_WORDS.chest : REWARD_WORDS.band[band]}</AppChip>
    </span>
  </div>
);

/**
 * A requested chest while its draw waits for new blocks: a bar filling block by block, the blocks left, and why the
 * wait is there. Once the draw can be finished the relay is asked to finish it, and the chest reads Opening.
 */
const DrawingChest = ({
  icon,
  chestId,
  blocksLeft,
}: {
  icon: IconMeaning;
  chestId: bigint;
  /** Null until the first read of the chain's head. */
  blocksLeft: number | null;
}) => {
  useFinishOnceDrawn(chestId, blocksLeft);
  const passed = blocksLeft === null ? 0 : CHEST_DRAW_BLOCKS - blocksLeft;
  return (
    <>
      <SemanticIcon name={icon} size={192} className="relative animate-pulse" />
      <span className="relative text-app-heading text-app-gold">
        {blocksLeft ? REWARD_WORDS.blocksLeft(blocksLeft) : REWARD_WORDS.opening}
      </span>
      <div
        role="progressbar"
        aria-label={REWARD_WORDS.draw}
        aria-valuemin={0}
        aria-valuemax={CHEST_DRAW_BLOCKS}
        aria-valuenow={passed}
        className="relative h-3 w-[70%] overflow-hidden rounded-full border border-app-line-strong bg-app-dark"
      >
        <span
          className="block h-full rounded-full bg-app-gold transition-[width] duration-700 ease-out"
          style={{ width: `${(passed / CHEST_DRAW_BLOCKS) * 100}%` }}
        />
      </div>
      <p className="relative w-[80%] text-center text-app-body text-app-muted">{REWARD_WORDS.drawFair}</p>
    </>
  );
};

const Stage = ({ children }: { children: ReactNode }) => (
  <div className="relative isolate flex min-h-[22rem] flex-col items-center justify-center gap-3 overflow-hidden rounded-control bg-app-well py-4">
    <span
      aria-hidden
      className="absolute left-1/2 top-[45%] -z-10 size-[56rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rays [mask-image:radial-gradient(circle,black,transparent_55%)]"
    />
    {children}
  </div>
);

const Card = ({ children }: { children: ReactNode }) => (
  <div className="relative flex w-[85%] flex-col items-center gap-3 px-4 py-5 text-center">{children}</div>
);

/** The reward's panels: its icon and title, then its parts one under another. */
const Plate = ({ icon, title, children }: { icon: IconMeaning; title: string; children: ReactNode }) => (
  <AppPanel icon={icon} title={title}>
    <div className="flex flex-col items-stretch gap-4">{children}</div>
  </AppPanel>
);

/** A line of where the reward stands, by its icon. */
const RewardLine = ({ icon, children }: { icon: IconMeaning; children: ReactNode }) => (
  <p className="flex items-center gap-2 text-app-body text-app-muted">
    <SemanticIcon name={icon} size={22} />
    <span>{children}</span>
  </p>
);
