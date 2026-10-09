import { lazy, type ReactNode, Suspense, useState } from "react";

import type { PayoutWallet } from "@/hooks/context/payout-wallet";
import { formatExact } from "@/ui/design-system/kit/amount";
import { formatDate } from "@/ui/design-system/kit/time";
import { Button } from "@/ui/design-system/kit/button";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { getChestAssetFromAttributesRaw } from "@/ui/features/cosmetics/chest-opening/utils/cosmetics";

import { mainnetProvider } from "@/runtime/mainnet-rpc";

import { Loading } from "../loading";
import { useNowSeconds } from "../use-now";
import { type ChestContent, lordsOf, openChestCalls } from "../value/ledger";
import { NoStrkLine } from "../value/no-strk-line";
import { REWARD_WORDS } from "../words";
import { type GameLedger, type Reward, rewardState, useReward } from "./reward";

const WalletSign = lazy(() =>
  import("@/ui/modules/identity/wallet-actions").then((module) => ({ default: module.WalletSign })),
);

/** Each rank band's chest, sealed or opened (0 the top 10 percent .. 4 the bottom 25). */
const chestArt = (band: number, opened: boolean) =>
  `/images/blitz-chests/band-${band}-${opened ? "opened" : "sealed"}.webp`;

/**
 * After a paid Blitz: the rated game's MMR change with the sword or shield applied, and the mystery chest the result
 * minted for the player's rank band. A sealed chest shows its band and nothing else. Open is one signature from the
 * payout wallet; the draw then lands by itself about ten blocks later, and the reveal plays inside this panel. Keep
 * leaves it in the collection to trade.
 */
export const RewardPanel = ({ ledger, wallet }: { ledger: GameLedger; wallet: PayoutWallet }) => {
  const reward = useReward(ledger, wallet.status === "no_wallet" ? null : wallet.address);
  if (wallet.status === "no_wallet" || !reward.data) return null;
  return (
    <div className="flex flex-col gap-4">
      {reward.data.result.rank > 0 && <RatingChange reward={reward.data} />}
      <ChestPlate
        ledger={ledger}
        owner={wallet.address}
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
    ? reward.registration.sword && { icon: "At" as const, word: "×2" }
    : reward.registration.shield && { icon: "Sd" as const, word: "½" };
  return (
    <Plate icon="R3" title={REWARD_WORDS.rating}>
      <p className="flex items-center gap-3 font-body text-[32px] font-extrabold tabular-nums">
        <span className="text-kit-muted">{formatExact(mmrBefore)}</span>
        <KitIcon code="Ar" size={22} />
        <span className="text-kit-cream">{formatExact(mmrAfter)}</span>
        <span className={cn("ml-auto text-[26px]", gain ? "text-kit-sage" : "text-kit-red")}>
          {gain ? "+" : "−"}
          {formatExact(Math.abs(mmrAfter - mmrBefore))}
        </span>
        {flag && (
          <span className="inline-flex items-center gap-1 font-body text-[18px] text-kit-gold2">
            <KitIcon code={flag.icon} size={26} />
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
  ledger: GameLedger;
  owner: string;
  reward: Reward;
  onRequested: () => void;
}) => {
  const now = useNowSeconds();
  const [kept, setKept] = useState(false);
  const [signing, setSigning] = useState(false);
  const state = rewardState(reward, owner);
  const band = reward.chest?.band ?? 0;

  if (state === "pending")
    return (
      <Plate icon="Ch" title={REWARD_WORDS.chest}>
        <ChestArt band={band} dim />
        <Line icon="Hg">{REWARD_WORDS.arrives}</Line>
      </Plate>
    );
  if (state === "opened")
    return (
      <Plate icon="Ch" title={REWARD_WORDS.chest}>
        <Stage>{reward.content ? <Prize content={reward.content} /> : <Loading />}</Stage>
      </Plate>
    );
  if (state === "opening")
    return (
      <Plate icon="Ch" title={REWARD_WORDS.chest}>
        <Stage>
          <img src={chestArt(band, true)} alt="" className="relative size-48 animate-pulse object-contain" />
          <span className="relative font-ui text-[20px] text-kit-gold2">{REWARD_WORDS.opening}</span>
        </Stage>
      </Plate>
    );
  if (state === "traded")
    return (
      <Plate icon="Ch" title={REWARD_WORDS.chest}>
        <ChestArt band={band} dim />
        <Line icon="Pc">{REWARD_WORDS.traded}</Line>
      </Plate>
    );
  const open = signing ? (
    <Suspense fallback={<Loading />}>
      <WalletSign
        owner={owner}
        calls={openChestCalls(ledger.address, ledger.chest, reward.result.chestId)}
        onSent={(hash) => {
          setSigning(false);
          // The request is the chest's last move from this wallet: read it again once it is on chain.
          void mainnetProvider().waitForTransaction(hash).finally(onRequested);
        }}
      />
    </Suspense>
  ) : null;
  return (
    <Plate icon="Ch" title={REWARD_WORDS.chest}>
      <ChestArt band={band} glow={state === "sealed" && !kept} />
      <p className="flex flex-wrap gap-2">
        <LordsUntil seasonEnd={reward.seasonEnd} now={now} />
        {kept && <Chip icon="Pc" word={REWARD_WORDS.tradeable} tone="text-kit-muted" />}
      </p>
      {state === "no-strk" && <NoStrkLine />}
      {open ?? (
        <div className={cn("grid gap-3", kept ? "grid-cols-1" : "grid-cols-2")}>
          <Button
            role={kept ? "outline" : "primary"}
            word={REWARD_WORDS.open}
            icon="Ch"
            disabled={state === "no-strk"}
            onClick={() => setSigning(true)}
          />
          {!kept && <Button role="outline" word={REWARD_WORDS.keep} icon="Wt" onClick={() => setKept(true)} />}
        </div>
      )}
    </Plate>
  );
};

/** The one rule a sealed chest carries: it can pay LORDS only while its season runs. */
const LordsUntil = ({ seasonEnd, now }: { seasonEnd: number; now: number }) =>
  now < seasonEnd ? (
    <Chip icon="Lo" word={REWARD_WORDS.lordsUntil(formatDate(seasonEnd))} tone="text-kit-gold2" />
  ) : (
    <Chip icon="Lo" word={REWARD_WORDS.noLords} tone="text-kit-muted" struck />
  );

/** What the chest delivered: an item, LORDS (possibly none once its season's reserve ran out), or a credit. */
const Prize = ({ content }: { content: ChestContent }) => {
  if (content.kind === "cosmetic") {
    const item = getChestAssetFromAttributesRaw(content.attributes);
    return (
      <Card>
        {item && <img src={item.imagePath} alt="" className="size-40 rounded-xl object-cover" />}
        <span className="rounded-full border border-kit-line2 px-3 py-1 font-body text-[14px] font-bold capitalize text-kit-gold2">
          {item?.rarity ?? REWARD_WORDS.cosmetic}
        </span>
        <b className="font-display text-[30px] leading-tight text-kit-cream">{item?.name ?? REWARD_WORDS.cosmetic}</b>
        <Chip icon="Ok" word={REWARD_WORDS.inCollection} tone="text-kit-sage" />
      </Card>
    );
  }
  if (content.kind === "lords")
    return (
      <Card>
        <KitIcon code="Lo" size={96} />
        <b className="font-display text-[60px] leading-none text-kit-gold2">{formatExact(lordsOf(content.amount))}</b>
        <span className="font-ui text-[22px] text-kit-muted">{REWARD_WORDS.lords}</span>
        <Chip icon="Ok" word={REWARD_WORDS.lordsSent} tone="text-kit-sage" />
      </Card>
    );
  return (
    <Card>
      <KitIcon code={content.kind === "sword" ? "At" : "Sd"} size={96} />
      <b className="font-display text-[30px] leading-tight text-kit-cream">
        {content.kind === "sword" ? REWARD_WORDS.swordCredit : REWARD_WORDS.shieldCredit}
      </b>
      <Chip icon="Lo" word={REWARD_WORDS.nextEntry} tone="text-kit-muted" />
    </Card>
  );
};

const ChestArt = ({ band, dim = false, glow = false }: { band: number; dim?: boolean; glow?: boolean }) => (
  <div
    className={cn(
      "relative flex h-48 items-center justify-center rounded-xl",
      glow && "bg-[radial-gradient(circle,theme(colors.kit.gold/30%),transparent_65%)]",
    )}
  >
    <img src={chestArt(band, false)} alt="" className={cn("size-44 object-contain", dim && "opacity-40 grayscale")} />
    <span className="absolute bottom-1 left-1">
      <Chip icon="Tp" word={REWARD_WORDS.band[band] ?? REWARD_WORDS.band[0]} tone="text-kit-muted" />
    </span>
  </div>
);

const Stage = ({ children }: { children: ReactNode }) => (
  <div className="relative isolate flex min-h-[22rem] flex-col items-center justify-center gap-3 overflow-hidden rounded-xl bg-kit-ink py-4">
    <span
      aria-hidden
      className="absolute left-1/2 top-[45%] -z-10 size-[56rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[repeating-conic-gradient(theme(colors.kit.gold/18%)_0_6deg,transparent_6deg_18deg)] [mask-image:radial-gradient(circle,black,transparent_55%)]"
    />
    {children}
  </div>
);

const Card = ({ children }: { children: ReactNode }) => (
  <div className="relative flex w-[85%] flex-col items-center gap-2.5 rounded-2xl border-2 border-kit-gold bg-kit-plate/95 px-4 py-5 text-center">
    {children}
  </div>
);

const Plate = ({ icon, title, children }: { icon: IconCode; title: string; children: ReactNode }) => (
  <section className="plate flex flex-col gap-4 p-5">
    <h2 className="flex items-center gap-2.5 border-b border-kit-line pb-3 font-ui text-[19px] text-kit-cream">
      <KitIcon code={icon} size={26} />
      {title}
    </h2>
    {children}
  </section>
);

const Line = ({ icon, children }: { icon: IconCode; children: ReactNode }) => (
  <p className="flex items-center gap-2.5 font-body text-[16px] text-kit-muted">
    <KitIcon code={icon} size={24} />
    {children}
  </p>
);

const Chip = ({
  icon,
  word,
  tone,
  struck = false,
}: {
  icon: IconCode;
  word: string;
  tone: string;
  struck?: boolean;
}) => (
  <span
    className={cn(
      "inline-flex h-9 items-center gap-1.5 rounded-full border border-kit-line2 bg-kit-ink pl-2 pr-3 font-body text-[15px] font-bold",
      tone,
    )}
  >
    <span className={cn("relative", struck && "opacity-60")}>
      <KitIcon code={icon} size={20} />
      {struck && <span aria-hidden className="absolute left-0 top-1/2 h-0.5 w-5 -rotate-45 bg-kit-red" />}
    </span>
    {word}
  </span>
);
