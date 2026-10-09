import { lazy, type ReactNode, Suspense, useState } from "react";

import type { PayoutWallet } from "@/hooks/context/payout-wallet";
import { formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { getChestAssetFromAttributesRaw } from "@/ui/features/cosmetics/chest-opening/utils/cosmetics";

import { mainnetProvider } from "@/runtime/mainnet-rpc";

import { Loading } from "../loading";
import { type ChestContent, lordsOf, openChestCalls } from "../value/ledger";
import { NoStrkLine } from "../value/no-strk-line";
import { REWARD_WORDS } from "../words";
import { bandOf, type GameLedger, type Reward, rewardState, useReward } from "./reward";

const WalletSign = lazy(() =>
  import("@/ui/modules/identity/wallet-actions").then((module) => ({ default: module.WalletSign })),
);

const CHEST = "/images/relic-chest/chest-closed.png";
const CHEST_OPEN = "/images/relic-chest/chest-opened.png";

/**
 * After a paid Blitz: the rated game's MMR change with the sword or shield applied, and the chest the result minted
 * for the player's rank band, which the payout wallet opens with its own signature or keeps to trade. A sealed chest
 * shows its band and nothing else; the reveal plays inside this panel.
 */
export const RewardPanel = ({
  ledger,
  wallet,
  players,
}: {
  ledger: GameLedger;
  wallet: PayoutWallet;
  players: number;
}) => {
  const reward = useReward(ledger, wallet.status === "no_wallet" ? null : wallet.address);
  if (wallet.status === "no_wallet" || !reward.data) return null;
  return (
    <div className="flex flex-col gap-4">
      {reward.data.result.rank > 0 && <RatingChange reward={reward.data} />}
      <ChestPlate
        ledger={ledger}
        owner={wallet.address}
        reward={reward.data}
        players={players}
        onOpened={() => void reward.refetch()}
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
  players,
  onOpened,
}: {
  ledger: GameLedger;
  owner: string;
  reward: Reward;
  players: number;
  onOpened: () => void;
}) => {
  const [kept, setKept] = useState(false);
  const [signing, setSigning] = useState(false);
  const [opening, setOpening] = useState(false);
  const state = rewardState(reward);
  const band = REWARD_WORDS.band[bandOf(reward.result.rank, players)];
  const title = REWARD_WORDS.chest;

  if (state === "pending")
    return (
      <Plate icon="Ch" title={title}>
        <ChestArt dim />
        <Line icon="Hg">{REWARD_WORDS.arrives}</Line>
      </Plate>
    );
  if (state === "opened" && reward.chest)
    return (
      <Plate icon="Ch" title={title}>
        <Stage>
          <Prize content={reward.chest.content} />
        </Stage>
      </Plate>
    );
  if (opening)
    return (
      <Plate icon="Ch" title={title}>
        <Stage>
          <img
            src={CHEST_OPEN}
            alt=""
            className="relative size-52 object-contain drop-shadow-[0_0_40px_theme(colors.kit.gold)]"
          />
          <span className="relative font-ui text-[26px] text-kit-gold2">…</span>
        </Stage>
      </Plate>
    );
  if (state === "traded")
    return (
      <Plate icon="Ch" title={title}>
        <ChestArt dim band={band} />
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
          setOpening(true);
          // Read the chest again once the opening is on chain: its contents show then.
          void mainnetProvider().waitForTransaction(hash).finally(onOpened);
        }}
      />
    </Suspense>
  ) : null;
  return (
    <Plate icon="Ch" title={title}>
      <ChestArt band={band} glow={state === "sealed" && !kept} />
      {kept && (
        <p className="flex flex-wrap gap-2">
          <Chip icon="Ok" word={REWARD_WORDS.inCollection} tone="text-kit-sage" />
          <Chip icon="Pc" word={REWARD_WORDS.tradeable} tone="text-kit-muted" />
        </p>
      )}
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

/** What the chest held, fixed when it was minted. */
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

const ChestArt = ({ band, dim = false, glow = false }: { band?: string; dim?: boolean; glow?: boolean }) => (
  <div
    className={cn(
      "relative flex h-48 items-center justify-center rounded-xl",
      glow && "bg-[radial-gradient(circle,theme(colors.kit.gold/30%),transparent_65%)]",
    )}
  >
    <img src={CHEST} alt="" className={cn("size-44 object-contain", dim && "opacity-40 grayscale")} />
    {band && (
      <span className="absolute bottom-1 left-1">
        <Chip icon="Tp" word={band} tone="text-kit-muted" />
      </span>
    )}
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

const Chip = ({ icon, word, tone }: { icon: IconCode; word: string; tone: string }) => (
  <span
    className={cn(
      "inline-flex h-9 items-center gap-1.5 rounded-full border border-kit-line2 bg-kit-ink pl-2 pr-3 font-body text-[15px] font-bold",
      tone,
    )}
  >
    <KitIcon code={icon} size={20} />
    {word}
  </span>
);
