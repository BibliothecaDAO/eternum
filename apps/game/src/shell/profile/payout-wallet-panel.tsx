import { WALLET_WORDS } from "@/ui/design-system/kit/words";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { SIGN_IN_CODE_LENGTH, type SignInOptions } from "@realms-world/identity";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { shortAddress } from "@/ui/design-system/kit/address";
import { AppButton, AppChip, AppChoice, AppCode, AppNotice } from "@/ui/design-system/kit/app-elements";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { failureSentence } from "@/ui/modules/identity/identity-failures";

import { useLayout } from "../frame/layout";
import { Loading } from "../loading";

const WalletPicker = lazy(() =>
  import("@/shell/value/wallet-actions").then((module) => ({ default: module.WalletPicker })),
);

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
 * The payout wallet (design 3): linking or replacing takes the new wallet's signature and a 6-digit code sent to the
 * account's email; unlinking takes the code alone, so a player who lost the wallet can still unlink it. A linked wallet
 * receives at once. A player with no wallet is sent to Ready, whose email wallet needs no install. We create no wallet
 * and hold no key.
 */
export const PayoutWalletPanel = ({
  wallet,
  email,
  onChanged,
}: {
  /** The linked wallet's address; null when the account has none. */
  wallet: string | null;
  email: string;
  onChanged: () => void;
}) => {
  const [step, setStep] = useState<Step>(wallet === null ? { kind: "choose" } : { kind: "linked" });
  const changed = () => {
    setStep({ kind: "linked" });
    onChanged();
  };
  return (
    <div className="flex flex-col gap-4">
      {step.kind === "code" && step.change.kind === "unlink" && (
        <p className="text-app-heading text-app-ink">{WALLET_WORDS.unlinkTitle}</p>
      )}
      {step.kind === "linked" && wallet !== null ? (
        <Linked
          address={wallet}
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
          <Step icon="download" word={WALLET_WORDS.needOne} onClick={() => onStep({ kind: "need" })} />
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
          <p className="text-app-body text-app-muted">{WALLET_WORDS.backFromReady}</p>
          <Step icon="refresh" word={WALLET_WORDS.anotherWallet} onClick={() => onStep({ kind: "pick" })} />
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
      <AppChoice
        icon="backpack"
        title={WALLET_WORDS.haveOne}
        detail={WALLET_WORDS.haveOneLine}
        onClick={() => onStep({ kind: "pick" })}
      />
      <AppChoice
        icon="download"
        title={WALLET_WORDS.needOne}
        detail={layout === "phone" ? WALLET_WORDS.needOneLinePhone : WALLET_WORDS.needOneLine}
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
        <AppChoice
          icon="download"
          title={WALLET_WORDS.inThisBrowser}
          detail={WALLET_WORDS.addExtension}
          onClick={addExtension}
        />
        <AppChoice
          icon="mail"
          title={WALLET_WORDS.byEmailTitle}
          detail={WALLET_WORDS.noInstallShort}
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
          ["mail", WALLET_WORDS.emailStep],
          ["check", WALLET_WORDS.approveStep],
          ["backpack", WALLET_WORDS.codeStep],
        ] as const
      ).map(([icon, word], index) => (
        <li
          key={word}
          className="relative flex flex-col items-center gap-2 rounded-xl border border-app-line-strong bg-app-well px-1.5 pb-2.5 pt-4 text-center text-app-label text-app-ink"
        >
          <span className="absolute -left-1.5 -top-2.5 flex size-[26px] items-center justify-center rounded-full border border-app-gold bg-app-dark text-app-label text-app-gold">
            {index + 1}
          </span>
          <SemanticIcon name={icon} size={36} />
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

  const send = useCallback(async () => {
    setSent(false);
    setError(null);
    try {
      await identityClient.sendSignInCode(email);
      setSent(true);
    } catch (cause) {
      setError(failureSentence("send-code", cause));
    }
  }, [email]);
  // Sent when the step opens; New code sends again.
  useEffect(() => {
    void send();
  }, [send]);

  const spend = async (entered: string) => {
    setBusy(true);
    setError(null);
    try {
      if (change.kind === "link") await identityClient.linkWallet({ ...change.proof, code: entered });
      else await identityClient.unlinkWallet(entered);
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
      <AppNotice line={sent ? `${WALLET_WORDS.codeSentTo} ${email}` : WALLET_WORDS.sending} />
      <AppCode
        label={WALLET_WORDS.stepCode}
        code={code}
        length={SIGN_IN_CODE_LENGTH}
        refused={error !== null}
        disabled={!sent || busy}
        onType={type}
      />
      {busy && change.kind === "link" && <AppNotice line={WALLET_WORDS.confirmInWallet} />}
      {change.kind === "unlink" && <AppNotice tone="warn" line={WALLET_WORDS.nothingPaysOut} />}
      {error && <p className="text-app-body text-app-bad">{error}</p>}
      <Step
        icon="refresh"
        word={WALLET_WORDS.newCode}
        onClick={() => {
          setCode("");
          void send();
        }}
      />
    </>
  );
};

/** A linked wallet, which receives at once; Replace and Unlink each take a new code. */
const Linked = ({ address, onReplace, onUnlink }: { address: string; onReplace: () => void; onUnlink: () => void }) => (
  <>
    <Track at={STEPS.length} />
    <WalletCard address={address} chip={{ icon: "check", word: WALLET_WORDS.canReceive }} />
    <PrizesGoHere />
    <div className="grid grid-cols-2 gap-3">
      <AppButton kind="secondary" icon="refresh" onClick={onReplace}>
        {WALLET_WORDS.replace}
      </AppButton>
      <AppButton kind="secondary" tone="bad" icon="lock" onClick={onUnlink}>
        {WALLET_WORDS.unlink}
      </AppButton>
    </div>
  </>
);

const STEPS: { icon: IconMeaning; word: string }[] = [
  { icon: "backpack", word: WALLET_WORDS.stepWallet },
  { icon: "mail", word: WALLET_WORDS.stepCode },
];

/** Wallet, then email code: the step under way lit, those behind ticked, -1 for none begun, past the last for done. */
const Track = ({ at }: { at: number }) => (
  <ol className="flex items-start justify-between px-1">
    {STEPS.map(({ icon, word }, index) => (
      <li key={word} className="flex flex-1 items-start last:flex-none">
        <span
          className={cn(
            "flex w-[84px] flex-col items-center gap-1.5 text-app-label",
            index <= at ? "text-app-ink" : "text-app-muted",
          )}
        >
          <span
            className={cn(
              "relative flex size-[54px] items-center justify-center rounded-full border-2 bg-app-dark",
              index < at
                ? "border-app-good"
                : index === at
                  ? "border-app-gold"
                  : "border-dashed border-app-line-strong opacity-60",
            )}
          >
            <SemanticIcon name={icon} size={28} />
            {index < at && (
              <span className="absolute -bottom-1 -right-1.5 flex size-6 items-center justify-center rounded-full border border-app-good bg-app-dark">
                <SemanticIcon name="check" size={16} />
              </span>
            )}
          </span>
          {word}
        </span>
        {index < STEPS.length - 1 && (
          <span
            className={cn(
              "mt-[27px] h-0.5 flex-1",
              index < at ? "bg-app-good" : "border-t-2 border-dashed border-app-line-strong",
            )}
          />
        )}
      </li>
    ))}
  </ol>
);

const WalletCard = ({ address, chip }: { address: string; chip: { icon: IconMeaning; word: string } | null }) => (
  <div className="flex min-h-[64px] items-center gap-3 rounded-xl border border-app-line-strong bg-app-well px-3.5">
    <SemanticIcon name="backpack" size={38} />
    <span className="whitespace-nowrap text-app-strong text-app-ink">{shortAddress(address)}</span>
    {chip && (
      <span className="ml-auto">
        <AppChip tone="good" icon={chip.icon}>
          {chip.word}
        </AppChip>
      </span>
    )}
  </div>
);

const ReadyName = ({ line }: { line: string }) => (
  <p className="flex items-baseline gap-2.5">
    <span className="text-app-title text-app-ink">{WALLET_WORDS.ready}</span>
    <span className="text-app-body text-app-muted">{line}</span>
  </p>
);

const PrizesGoHere = () => (
  <p className="flex items-center gap-2 text-app-body text-app-muted">
    <SemanticIcon name="lords" size={26} />
    <SemanticIcon name="reward-chest" size={26} />
    <SemanticIcon name="victory" size={26} />
    <span className="ml-1">{WALLET_WORDS.prizesGoHere}</span>
  </p>
);

const KeysStay = () => (
  <p className="flex items-center gap-2.5 text-app-body text-app-muted">
    <SemanticIcon name="lock" size={22} />
    {WALLET_WORDS.keysStay}
  </p>
);

/** A side step: another wallet, a new code, a wallet to get first. */
const Step = ({ icon, word, onClick }: { icon: IconMeaning; word: string; onClick: () => void }) => (
  <span>
    <AppButton kind="quiet" icon={icon} onClick={onClick}>
      {word}
    </AppButton>
  </span>
);
