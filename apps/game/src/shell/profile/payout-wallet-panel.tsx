import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { SIGN_IN_CODE_LENGTH, type SignInOptions } from "@realms-world/identity";
import { lazy, Suspense, useEffect, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { shortAddress } from "@/ui/design-system/kit/address";
import { Button } from "@/ui/design-system/kit/button";
import { IconLine } from "@/ui/design-system/kit/icon-line";
import { PanelTitle } from "@/ui/design-system/kit/panel";
import { Pill } from "@/ui/design-system/kit/pill";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { failureSentence } from "@/ui/modules/identity/identity-failures";

import { useLayout } from "../frame/layout";
import { Loading } from "../loading";
import { CodeBoxes } from "../sign-in/fields";
import { WALLET_WORDS } from "../words";

const WalletPicker = lazy(() =>
  import("@/ui/modules/identity/wallet-actions").then((module) => ({ default: module.WalletPicker })),
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
      <PanelTitle rule="line" icon={step.kind === "code" && step.change.kind === "unlink" ? "lock" : "backpack"}>
        {step.kind === "code" && step.change.kind === "unlink" ? WALLET_WORDS.unlinkTitle : WALLET_WORDS.payoutWallet}
      </PanelTitle>
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
          <p className="font-body text-base text-kit-muted">{WALLET_WORDS.backFromReady}</p>
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
      <ChoiceTile
        icon="backpack"
        word={WALLET_WORDS.haveOne}
        line={WALLET_WORDS.haveOneLine}
        lit
        onClick={() => onStep({ kind: "pick" })}
      />
      <ChoiceTile
        icon="download"
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
          icon="download"
          word={WALLET_WORDS.inThisBrowser}
          line={WALLET_WORDS.addExtension}
          lit
          onClick={addExtension}
        />
        <ChoiceTile
          icon="mail"
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
          ["mail", WALLET_WORDS.emailStep],
          ["check", WALLET_WORDS.approveStep],
          ["backpack", WALLET_WORDS.codeStep],
        ] as const
      ).map(([icon, word], index) => (
        <li
          key={word}
          className="relative flex flex-col items-center gap-2 rounded-well border border-kit-line2 bg-kit-ground/50 px-1.5 pb-2.5 pt-4 text-center font-body text-sm text-kit-cream"
        >
          <span className="absolute -left-1.5 -top-2.5 flex size-[26px] items-center justify-center rounded-full border border-kit-gold bg-kit-ink font-body text-sm font-extrabold text-kit-gold2">
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
      <IconLine tone="cream" icon="mail">
        {sent ? (
          <>
            {WALLET_WORDS.codeSentTo} <b>{email}</b>
          </>
        ) : (
          WALLET_WORDS.sending
        )}
      </IconLine>
      <CodeBoxes code={code} refused={error !== null} disabled={!sent || busy} onType={type} />
      {busy && change.kind === "link" && (
        <IconLine tone="cream" icon="backpack">
          {WALLET_WORDS.confirmInWallet}
        </IconLine>
      )}
      {change.kind === "unlink" && (
        <IconLine tone="cream" icon="stamina">
          {WALLET_WORDS.nothingPaysOut}
        </IconLine>
      )}
      {error && <p className="font-body text-base text-kit-red">{error}</p>}
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
      <Button role="outline" word={WALLET_WORDS.replace} icon="refresh" onClick={onReplace} />
      <Button role="outline" word={WALLET_WORDS.unlink} icon="lock" onClick={onUnlink} />
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
            "flex w-[84px] flex-col items-center gap-1.5 font-body text-sm",
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
            <SemanticIcon name={icon} size={28} />
            {index < at && (
              <span className="absolute -bottom-1 -right-1.5 flex size-6 items-center justify-center rounded-full border border-kit-sage bg-kit-ink">
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
              index < at ? "bg-kit-sage" : "border-t-2 border-dashed border-kit-line2",
            )}
          />
        )}
      </li>
    ))}
  </ol>
);

const WalletCard = ({ address, chip }: { address: string; chip: { icon: IconMeaning; word: string } | null }) => (
  <div className="flex min-h-[64px] items-center gap-3 rounded-well border border-kit-line2 bg-kit-ground/60 px-3.5">
    <SemanticIcon name="backpack" size={38} />
    <span className="whitespace-nowrap font-body text-lg font-bold text-kit-cream">{shortAddress(address)}</span>
    {chip && (
      <span className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-kit-sage bg-kit-ink pl-2 pr-3 font-body text-base font-bold text-kit-sage">
        <SemanticIcon name={chip.icon} size={20} />
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
  icon: IconMeaning;
  word: string;
  line: string;
  lit?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex flex-col items-center gap-1.5 rounded-plate border-2 px-2.5 py-4 text-center",
      lit ? "border-kit-gold bg-kit-gold/10" : "border-kit-line2 bg-kit-ground/60",
    )}
  >
    <SemanticIcon name={icon} size={52} />
    <span className="font-body text-lg text-kit-cream">{word}</span>
    <span className="font-body text-sm font-semibold text-kit-muted">{line}</span>
  </button>
);

const ReadyName = ({ line }: { line: string }) => (
  <p className="flex items-baseline gap-2.5">
    <span className="font-body text-title font-bold text-kit-cream">{WALLET_WORDS.ready}</span>
    <span className="font-body text-base text-kit-muted">{line}</span>
  </p>
);

const PrizesGoHere = () => (
  <p className="flex items-center gap-2 font-body text-lg text-kit-muted">
    <SemanticIcon name="lords" size={26} />
    <SemanticIcon name="chest" size={26} />
    <SemanticIcon name="victory" size={26} />
    <span className="ml-1">{WALLET_WORDS.prizesGoHere}</span>
  </p>
);

const KeysStay = () => (
  <IconLine tone="cream" icon="lock">
    {WALLET_WORDS.keysStay}
  </IconLine>
);

/** A side step as a pill: another wallet, a new code, a wallet to get first. */
const Step = ({ icon, word, onClick }: { icon: IconMeaning; word: string; onClick: () => void }) => (
  <Pill as="button" size="lg" tone="muted" icon={icon} onClick={onClick} className="w-fit">
    {word}
  </Pill>
);
