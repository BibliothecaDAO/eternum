import { SIGN_IN_CODE_LENGTH, type SignInOptions } from "@realms-world/identity";
import { lazy, type ReactNode, Suspense, useEffect, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { shortAddress } from "@/ui/design-system/kit/address";
import { Button } from "@/ui/design-system/kit/button";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { formatClockTime, formatDuration } from "@/ui/design-system/kit/time";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { failureSentence } from "@/ui/modules/identity/identity-failures";

import { useLayout } from "../frame/layout";
import { Loading } from "../loading";
import { CodeBoxes } from "../sign-in/fields";
import { WALLET_WORDS } from "../words";
import { holdShare, type PayoutWallet } from "@/hooks/context/payout-wallet";

const WalletPicker = lazy(() =>
  import("@/ui/modules/identity/wallet-actions").then((module) => ({ default: module.WalletPicker })),
);

// The identity service's wallet changes, each proven by the code it emailed, typed as the service takes them. An
// older client that sends no code is never reached: the panel shows only when the service holds payout wallets.
const walletChanges: {
  linkWallet: (options: SignInOptions & { code: string }) => Promise<string>;
  unlinkWallet: (code: string) => Promise<void>;
} = identityClient;

/** Ready's extension in this browser's store. */
const READY_EXTENSION = navigator.userAgent.includes("Firefox")
  ? "https://addons.mozilla.org/en-US/firefox/addon/argent-x/"
  : "https://chromewebstore.google.com/detail/dlcobpjiigpikoobohmabehhmhfoodbb";

/** A wallet change waiting for its code: linking the wallet just proven, or unlinking. */
type Change = { kind: "link"; proof: SignInOptions } | { kind: "unlink" };

type Step =
  | { kind: "linked" }
  | { kind: "choose" }
  | { kind: "pick" }
  | { kind: "need" }
  | { kind: "back" }
  | { kind: "code"; change: Change };

/**
 * The payout wallet (design 5g): link, replace or unlink, each with the wallet's signature and a 6-digit code sent to
 * the account's email; a newly linked wallet receives nothing for 24 hours. A player with no wallet is sent to Ready,
 * whose email wallet needs no install. We create no wallet and hold no key.
 */
export const PayoutWalletPanel = ({
  wallet,
  email,
  now,
  onChanged,
}: {
  wallet: PayoutWallet;
  email: string;
  now: number;
  onChanged: () => void;
}) => {
  const [step, setStep] = useState<Step>(wallet.status === "no_wallet" ? { kind: "choose" } : { kind: "linked" });
  const changed = () => {
    setStep({ kind: "linked" });
    onChanged();
  };
  return (
    <div className="flex flex-col gap-4">
      <Title icon={step.kind === "code" && step.change.kind === "unlink" ? "Lk" : "Wt"}>
        {step.kind === "code" && step.change.kind === "unlink" ? WALLET_WORDS.unlinkTitle : WALLET_WORDS.payoutWallet}
      </Title>
      {step.kind === "linked" && wallet.status !== "no_wallet" ? (
        <Linked
          wallet={wallet}
          email={email}
          now={now}
          onReplace={() => setStep({ kind: "choose" })}
          onUnlink={() => setStep({ kind: "code", change: { kind: "unlink" } })}
        />
      ) : (
        <Linking step={step} email={email} onStep={setStep} onChanged={changed} />
      )}
    </div>
  );
};

const Linking = ({
  step,
  email,
  onStep,
  onChanged,
}: {
  step: Step;
  email: string;
  onStep: (step: Step) => void;
  onChanged: () => void;
}) => {
  const layout = useLayout();
  const pick = (proof: SignInOptions) => onStep({ kind: "code", change: { kind: "link", proof } });
  switch (step.kind) {
    case "code":
      return <CodeStep change={step.change} email={email} onDone={onChanged} />;
    case "pick":
      return (
        <>
          <Track at={0} />
          <Suspense fallback={<Loading />}>
            <WalletPicker onProof={pick} />
          </Suspense>
          <Chip icon="In" word={WALLET_WORDS.needOne} onClick={() => onStep({ kind: "need" })} />
        </>
      );
    case "need":
      return layout === "phone" ? <ReadyByEmail onProof={pick} /> : <GetReady onStep={onStep} onProof={pick} />;
    case "back":
      return (
        <>
          <Track at={0} />
          <Suspense fallback={<Loading />}>
            <WalletPicker only={["argentX"]} onProof={pick} />
          </Suspense>
          <p className="font-body text-[15px] text-kit-muted">{WALLET_WORDS.backFromReady}</p>
          <Chip icon="Sp" word={WALLET_WORDS.anotherWallet} onClick={() => onStep({ kind: "pick" })} />
        </>
      );
    default:
      return <Choose layout={layout} onStep={onStep} />;
  }
};

/** No wallet yet: the player has one, or goes to Ready for one. */
const Choose = ({ layout, onStep }: { layout: "phone" | "desktop"; onStep: (step: Step) => void }) => (
  <>
    <Track at={-1} />
    <PrizesGoHere />
    <div className="grid grid-cols-2 gap-3">
      <ChoiceTile
        icon="Wt"
        word={WALLET_WORDS.haveOne}
        line={WALLET_WORDS.haveOneLine}
        lit
        onClick={() => onStep({ kind: "pick" })}
      />
      <ChoiceTile
        icon="In"
        word={WALLET_WORDS.needOne}
        line={layout === "phone" ? WALLET_WORDS.needOneLinePhone : WALLET_WORDS.needOneLine}
        onClick={() => onStep({ kind: "need" })}
      />
    </div>
  </>
);

/** Desktop: Ready's extension in this browser, or Ready's email wallet, which opens at once. */
const GetReady = ({ onStep, onProof }: { onStep: (step: Step) => void; onProof: (proof: SignInOptions) => void }) => {
  const [byEmail, setByEmail] = useState(false);
  if (byEmail) return <ReadyByEmail onProof={onProof} />;
  const addExtension = () => {
    window.open(READY_EXTENSION, "_blank", "noopener,noreferrer");
    onStep({ kind: "back" });
  };
  return (
    <>
      <ReadyName line={WALLET_WORDS.formerlyArgent} />
      <div className="grid grid-cols-2 gap-3">
        <ChoiceTile
          icon="In"
          word={WALLET_WORDS.inThisBrowser}
          line={WALLET_WORDS.addExtension}
          lit
          onClick={addExtension}
        />
        <ChoiceTile
          icon="Em"
          word={WALLET_WORDS.byEmailTitle}
          line={WALLET_WORDS.noInstallShort}
          onClick={() => setByEmail(true)}
        />
      </div>
      <KeysStay />
    </>
  );
};

/** Ready's email wallet: Ready's own page signs the player up or in; the wallet then signs and our code follows. */
const ReadyByEmail = ({ onProof }: { onProof: (proof: SignInOptions) => void }) => (
  <>
    <ReadyName line={WALLET_WORDS.noInstall} />
    <ol className="grid grid-cols-3 gap-2.5">
      {(
        [
          ["Em", WALLET_WORDS.emailStep],
          ["Ok", WALLET_WORDS.approveStep],
          ["Wt", WALLET_WORDS.codeStep],
        ] as const
      ).map(([icon, word], index) => (
        <li
          key={word}
          className="relative flex flex-col items-center gap-2 rounded-[14px] border border-kit-line2 bg-kit-ground/50 px-1.5 pb-2.5 pt-4 text-center font-ui text-[14px] text-kit-cream"
        >
          <span className="absolute -left-1.5 -top-2.5 flex size-[26px] items-center justify-center rounded-full border border-kit-gold bg-kit-ink font-body text-[13px] font-extrabold text-kit-gold2">
            {index + 1}
          </span>
          <KitIcon code={icon} size={36} />
          {word}
        </li>
      ))}
    </ol>
    <Suspense fallback={<Loading />}>
      <WalletPicker only={["argentWebWallet"]} onProof={onProof} />
    </Suspense>
    <KeysStay />
  </>
);

/**
 * The emailed code: sent when the step opens, entered in six boxes, and spent on the change the moment the sixth digit
 * lands. A link then asks the wallet for its signature.
 */
const CodeStep = ({ change, email, onDone }: { change: Change; email: string; onDone: () => void }) => {
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSent(false);
    setError(null);
    try {
      await identityClient.sendSignInCode(email);
      setSent(true);
    } catch (cause) {
      setError(failureSentence("send-code", cause));
    }
  };
  useEffect(() => {
    void send();
    // Sent once when the step opens; New code sends again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spend = async (entered: string) => {
    setBusy(true);
    setError(null);
    try {
      if (change.kind === "link") await walletChanges.linkWallet({ ...change.proof, code: entered });
      else await walletChanges.unlinkWallet(entered);
      onDone();
    } catch (cause) {
      setError(failureSentence(change.kind, cause));
    } finally {
      setBusy(false);
    }
  };
  const type = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, SIGN_IN_CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === SIGN_IN_CODE_LENGTH) void spend(digits);
  };

  return (
    <>
      {change.kind === "link" && <Track at={1} />}
      {change.kind === "link" && <WalletCard address={change.proof.address} chip={null} />}
      <Line icon="Em">
        {sent ? (
          <>
            {WALLET_WORDS.codeSentTo} <b>{email}</b>
          </>
        ) : (
          WALLET_WORDS.sending
        )}
      </Line>
      <CodeBoxes code={code} refused={error !== null} disabled={!sent || busy} onType={type} />
      {busy && change.kind === "link" && <Line icon="Wt">{WALLET_WORDS.confirmInWallet}</Line>}
      {change.kind === "unlink" && <Line icon="St">{WALLET_WORDS.nothingPaysOut}</Line>}
      {error && <p className="font-body text-[15px] text-kit-red">{error}</p>}
      <Chip
        icon="Sp"
        word={WALLET_WORDS.newCode}
        onClick={() => {
          setCode("");
          void send();
        }}
      />
    </>
  );
};

/** A linked wallet: on its hold with the time left, or ready; Replace and Unlink each take a new code. */
const Linked = ({
  wallet,
  email,
  now,
  onReplace,
  onUnlink,
}: {
  wallet: Exclude<PayoutWallet, { status: "no_wallet" }>;
  email: string;
  now: number;
  onReplace: () => void;
  onUnlink: () => void;
}) => (
  <>
    <Track at={wallet.status === "on_hold" ? 2 : 3} />
    <WalletCard
      address={wallet.address}
      chip={
        wallet.status === "on_hold"
          ? { icon: "Hg", word: WALLET_WORDS.onHold, tone: "hold" }
          : { icon: "Ok", word: WALLET_WORDS.canReceive, tone: "ok" }
      }
    />
    {wallet.status === "on_hold" ? (
      <div className="flex items-center gap-5">
        <HoldRing share={holdShare(wallet.until, now)} left={formatDuration((wallet.until - now) / 1000)} />
        <div className="flex flex-col gap-3">
          <Line icon="Lo">
            {WALLET_WORDS.receivesFrom} <b>{formatClockTime(wallet.until / 1000)}</b>
          </Line>
          <Line icon="Em">
            {WALLET_WORDS.noticeSentTo} <b>{email}</b>
          </Line>
        </div>
      </div>
    ) : (
      <PrizesGoHere />
    )}
    <div className="grid grid-cols-2 gap-3">
      <Button role="outline" word={WALLET_WORDS.replace} icon="Sp" onClick={onReplace} />
      <Button role="outline" word={WALLET_WORDS.unlink} icon="Lk" onClick={onUnlink} />
    </div>
  </>
);

const STEPS: { icon: IconCode; word: string }[] = [
  { icon: "Wt", word: WALLET_WORDS.stepWallet },
  { icon: "Em", word: WALLET_WORDS.stepCode },
  { icon: "Hg", word: WALLET_WORDS.stepHold },
];

/** Wallet, email code, hold: the step under way lit, those behind ticked, -1 for none begun, 3 for all done. */
const Track = ({ at }: { at: number }) => (
  <ol className="flex items-start justify-between px-1">
    {STEPS.map(({ icon, word }, index) => (
      <li key={word} className="flex flex-1 items-start last:flex-none">
        <span
          className={cn(
            "flex w-[84px] flex-col items-center gap-1.5 font-ui text-[14px]",
            index <= at ? "text-kit-cream" : "text-kit-muted",
          )}
        >
          <span
            className={cn(
              "relative flex size-[54px] items-center justify-center rounded-full border-2 bg-kit-ink",
              index < at
                ? "border-kit-sage"
                : index === at
                  ? "border-kit-gold ring-4 ring-kit-gold/20"
                  : "border-dashed border-kit-line2 opacity-60",
            )}
          >
            <KitIcon code={icon} size={28} />
            {index < at && (
              <span className="absolute -bottom-1 -right-1.5 flex size-6 items-center justify-center rounded-full border border-kit-sage bg-kit-ink">
                <KitIcon code="Ok" size={16} />
              </span>
            )}
          </span>
          {word}
        </span>
        {index < STEPS.length - 1 && (
          <span
            className={cn(
              "mt-[27px] h-0.5 flex-1",
              index < at ? "bg-kit-sage" : "border-t-2 border-dashed border-kit-line2",
            )}
          />
        )}
      </li>
    ))}
  </ol>
);

const HoldRing = ({ share, left }: { share: number; left: string }) => {
  const length = 2 * Math.PI * 56;
  return (
    <span className="relative flex size-[120px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 128 128" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r="56" className="fill-kit-ink stroke-kit-line" strokeWidth="9" />
        <circle
          cx="64"
          cy="64"
          r="56"
          className="fill-none stroke-kit-gold"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - share)}
        />
      </svg>
      <span className="relative flex flex-col items-center leading-tight">
        <b className="font-body text-[20px] font-extrabold text-kit-cream">{left}</b>
        <span className="font-ui text-[13px] text-kit-muted">{WALLET_WORDS.left}</span>
      </span>
    </span>
  );
};

const WalletCard = ({
  address,
  chip,
}: {
  address: string;
  chip: { icon: IconCode; word: string; tone: "ok" | "hold" } | null;
}) => (
  <div className="flex min-h-[64px] items-center gap-3 rounded-[14px] border border-kit-line2 bg-kit-ground/60 px-3.5">
    <KitIcon code="Wt" size={38} />
    <span className="whitespace-nowrap font-body text-[18px] font-bold text-kit-cream">{shortAddress(address)}</span>
    {chip && (
      <span
        className={cn(
          "ml-auto inline-flex h-9 items-center gap-1.5 rounded-full border bg-kit-ink pl-2 pr-3 font-body text-[15px] font-bold",
          chip.tone === "ok" ? "border-kit-sage text-kit-sage" : "border-kit-amber text-kit-gold2",
        )}
      >
        <KitIcon code={chip.icon} size={20} />
        {chip.word}
      </span>
    )}
  </div>
);

const ChoiceTile = ({
  icon,
  word,
  line,
  lit = false,
  onClick,
}: {
  icon: IconCode;
  word: string;
  line: string;
  lit?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2.5 py-4 text-center",
      lit ? "border-kit-gold bg-kit-gold/10" : "border-kit-line2 bg-kit-ground/60",
    )}
  >
    <KitIcon code={icon} size={52} />
    <span className="font-ui text-[19px] text-kit-cream">{word}</span>
    <span className="font-body text-[13px] font-semibold text-kit-muted">{line}</span>
  </button>
);

const ReadyName = ({ line }: { line: string }) => (
  <p className="flex items-baseline gap-2.5">
    <span className="font-display text-[34px] text-kit-cream">{WALLET_WORDS.ready}</span>
    <span className="font-ui text-[15px] text-kit-muted">{line}</span>
  </p>
);

const PrizesGoHere = () => (
  <p className="flex items-center gap-2 font-ui text-[19px] text-kit-muted">
    <KitIcon code="Lo" size={26} />
    <KitIcon code="Ch" size={26} />
    <KitIcon code="Tp" size={26} />
    <span className="ml-1">{WALLET_WORDS.prizesGoHere}</span>
  </p>
);

const KeysStay = () => <Line icon="Lk">{WALLET_WORDS.keysStay}</Line>;

const Title = ({ icon, children }: { icon: IconCode; children: string }) => (
  <h2 className="flex items-center gap-2.5 border-b border-kit-line pb-3 font-ui text-[19px] text-kit-cream">
    <KitIcon code={icon} size={26} />
    {children}
  </h2>
);

const Line = ({ icon, children }: { icon: IconCode; children: ReactNode }) => (
  <p className="flex items-center gap-2.5 font-body text-[16px] text-kit-cream">
    <KitIcon code={icon} size={24} />
    <span>{children}</span>
  </p>
);

const Chip = ({ icon, word, onClick }: { icon: IconCode; word: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-kit-line2 bg-kit-ink pl-2 pr-3 font-body text-[15px] font-bold text-kit-muted"
  >
    <KitIcon code={icon} size={20} />
    {word}
  </button>
);
