import { WALLET_WORDS } from "@/ui/design-system/kit/words";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import {
  IdentityRequestError,
  isSameStarknetAddress,
  SIGN_IN_CODE_LENGTH,
  type NewPasskey,
  type SignInOptions,
} from "@realms-world/identity";
import { PAYOUT_WALLET_CHANGE_SECONDS } from "@realms-world/value-ledger/payout-wallet";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { noteDefaultWallet, useDefaultWallet } from "@/hooks/context/default-wallet";
import { identityClient, identityUsername, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { shortAddress } from "@/ui/design-system/kit/address";
import { AppButton, AppChip, AppChoice, AppCode, AppNotice } from "@/ui/design-system/kit/app-elements";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { failureSentence } from "@/ui/modules/identity/identity-failures";
import { createPasskey } from "@/ui/modules/identity/passkey";

import { l2Provider } from "@/runtime/l2-rpc";

import { Loading } from "../loading";
import { WalletUnread } from "@/shell/value/wallet-unread";
import { RealmsWalletFunds } from "./realms-wallet-funds";
import { RealmsWalletRecovery, RecoverStart } from "./realms-wallet-recovery";

const WalletPicker = lazy(() =>
  import("@/shell/value/wallet-actions").then((module) => ({ default: module.WalletPicker })),
);

/**
 * A wallet change waiting for its code: linking the wallet just proven, unlinking, making the account's default wallet
 * its payout wallet (a sign-in minutes old needs none: CreateWallet), or starting its recovery with a new passkey.
 */
type Change =
  | { kind: "link"; proof: SignInOptions }
  | { kind: "unlink" }
  /** The passkey just made, which the server keeps only once the code lets the wallet in; none when it has one. */
  | { kind: "default"; passkey: NewPasskey | undefined }
  | { kind: "recover"; passkey: NewPasskey };

type Step =
  | { kind: "linked" }
  | { kind: "choose" }
  | { kind: "pick" }
  | { kind: "recover" }
  | { kind: "code"; change: Change };

/**
 * The payout wallet (design 3): linking or replacing takes the new wallet's signature and a 6-digit code sent to the
 * account's email; unlinking takes the code alone, so a player who lost the wallet can still unlink it. The first wallet
 * receives at once; a replacement's first payout waits out the co-signer's hold. A player with no wallet makes the
 * default wallet: a Ready 0.5 account their passkey owns, with the Realms guardian (apps/realms/server/
 * default-wallet-plugin.ts). We hold no key that can move it.
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
  const { wallet: defaultWallet, failed: walletUnread, retry: readWalletAgain } = useDefaultWallet();
  const isDefault = wallet !== null && !!defaultWallet && isSameStarknetAddress(wallet, defaultWallet.address);
  const changed = () => {
    setStep({ kind: "linked" });
    onChanged();
  };
  const recover = () => setStep({ kind: "recover" });
  // A recovery changes no payout wallet: it ends back on the wallet, which reads the escape it started from the chain.
  const backToWallet = () => setStep(wallet === null ? { kind: "choose" } : { kind: "linked" });
  const body = () => {
    if (step.kind === "recover" && defaultWallet)
      return (
        <RecoverStart
          replacing={defaultWallet.credentialId}
          onPasskey={(passkey) => setStep({ kind: "code", change: { kind: "recover", passkey } })}
          onCancel={backToWallet}
        />
      );
    if (step.kind === "code" && step.change.kind === "recover")
      return <CodeStep change={step.change} email={email} onDone={backToWallet} />;
    if (step.kind === "linked" && wallet !== null)
      return (
        <Linked
          address={wallet}
          isDefault={isDefault}
          onReplace={() => setStep({ kind: "choose" })}
          onUnlink={() => setStep({ kind: "code", change: { kind: "unlink" } })}
          onRecover={recover}
        />
      );
    return <Linking step={step} email={email} onStep={setStep} onChanged={changed} />;
  };
  return (
    <div className="flex flex-col gap-4">
      {step.kind === "code" && step.change.kind === "unlink" && (
        <p className="text-app-heading text-app-ink">{WALLET_WORDS.unlinkTitle}</p>
      )}
      {walletUnread && <WalletUnread onRetry={readWalletAgain} />}
      {body()}
      {defaultWallet && !isDefault && (step.kind === "linked" || step.kind === "choose") && (
        <RealmsWallet address={defaultWallet.address} onRecover={recover} />
      )}
    </div>
  );
};

/** The Realms wallet while payouts go elsewhere: it keeps what it holds, its Send and its recovery. */
const RealmsWallet = ({ address, onRecover }: { address: string; onRecover: () => void }) => (
  <>
    <WalletCard address={address} name={WALLET_WORDS.realmsWallet} chip={null} />
    <RealmsWalletFunds address={address} />
    <RealmsWalletRecovery address={address} onRecover={onRecover} />
  </>
);

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
        </>
      );
    default:
      return <Choose onStep={onStep} onChanged={onChanged} />;
  }
};

/** No wallet yet: make the default wallet with a passkey, or link one the player has. */
const Choose = ({ onStep, onChanged }: { onStep: (step: Step) => void; onChanged: () => void }) => (
  <>
    <PrizesGoHere />
    <CreateWallet
      onCreated={onChanged}
      onCodeNeeded={(passkey) => onStep({ kind: "code", change: { kind: "default", passkey } })}
    />
    <AppChoice
      icon="backpack"
      title={WALLET_WORDS.haveOne}
      detail={WALLET_WORDS.haveOneLine}
      onClick={() => onStep({ kind: "pick" })}
    />
  </>
);

/**
 * Create my wallet: a passkey made on this device (or the one the account made before), then the wallet written as the
 * payout wallet. A sign-in more than minutes old is asked for an emailed code first (`onCodeNeeded`), as any wallet
 * change is.
 */
const CreateWallet = ({
  onCreated,
  onCodeNeeded,
}: {
  onCreated: () => void;
  onCodeNeeded: (passkey: NewPasskey | undefined) => void;
}) => {
  const session = useIdentitySessionStore((state) => state.session);
  const { wallet: existing } = useDefaultWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session) return null;
  // Until the account's wallet is known, no passkey is made: one that already has a wallet would get a useless one.
  const unknown = existing === undefined;
  const { realmsId, email } = session.user;
  const create = async () => {
    setBusy(true);
    setError(null);
    let passkey: NewPasskey | undefined;
    try {
      passkey = existing
        ? undefined
        : await createPasskey({ realmsId, email, name: identityUsername(session) ?? email });
      noteDefaultWallet(realmsId, await identityClient.createDefaultWallet({ passkey }));
      onCreated();
    } catch (cause) {
      if (cause instanceof IdentityRequestError && cause.code === "CODE_REQUIRED") onCodeNeeded(passkey);
      else setError(failureSentence("wallet", cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2.5">
      <AppButton
        kind="primary"
        icon="lock"
        disabled={unknown}
        busy={busy ? WALLET_WORDS.confirmPasskey : undefined}
        onClick={create}
      >
        {WALLET_WORDS.createWallet}
      </AppButton>
      <p className="text-app-body text-app-muted">{WALLET_WORDS.createLine}</p>
      {error && <p className="text-app-body text-app-bad">{error}</p>}
    </div>
  );
};

/** The recovery started with this code, held until its escape is on chain, so the wallet shows it under way at once. */
const startRecovery = async (code: string, passkey: NewPasskey) => {
  const started = await identityClient.startWalletRecovery({ passkey, code });
  await l2Provider().waitForTransaction(started, { retryInterval: 1_000 });
};

/** The account's default wallet written as its payout wallet with this code; every surface shows it at once. */
const writeDefaultWallet = async (code: string, passkey: NewPasskey | undefined) => {
  const wallet = await identityClient.createDefaultWallet({ passkey, code });
  const realmsId = useIdentitySessionStore.getState().session?.user.realmsId;
  if (realmsId) noteDefaultWallet(realmsId, wallet);
};

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
      else if (change.kind === "unlink") await identityClient.unlinkWallet(entered);
      else if (change.kind === "recover") await startRecovery(entered, change.passkey);
      else await writeDefaultWallet(entered, change.passkey);
      onDone();
    } catch (cause) {
      setError(failureSentence(change.kind === "default" ? "wallet" : change.kind, cause));
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

/** A linked wallet; Replace and Unlink each take a new code, and the wallet that follows waits out the hold. */
const Linked = ({
  address,
  isDefault,
  onReplace,
  onUnlink,
  onRecover,
}: {
  address: string;
  /** The account's own default wallet, which the player knows by name rather than by address. */
  isDefault: boolean;
  onReplace: () => void;
  onUnlink: () => void;
  onRecover: () => void;
}) => {
  const [sending, setSending] = useState(false);
  return (
    <>
      {!isDefault && <Track at={STEPS.length} />}
      <WalletCard
        address={address}
        name={isDefault ? WALLET_WORDS.realmsWallet : undefined}
        chip={{ icon: "check", word: WALLET_WORDS.canReceive }}
      />
      {isDefault && <RealmsWalletFunds address={address} onSending={setSending} />}
      {!sending && (
        <>
          {isDefault && <RealmsWalletRecovery address={address} onRecover={onRecover} />}
          <PrizesGoHere />
          <div className="grid grid-cols-2 gap-3">
            <AppButton kind="secondary" icon="refresh" onClick={onReplace}>
              {WALLET_WORDS.replace}
            </AppButton>
            <AppButton kind="secondary" tone="bad" icon="lock" onClick={onUnlink}>
              {WALLET_WORDS.unlink}
            </AppButton>
          </div>
          <p className="flex items-center gap-2.5 text-app-body text-app-muted">
            <SemanticIcon name="clock" size={22} />
            {WALLET_WORDS.newWalletWaits(PAYOUT_WALLET_CHANGE_SECONDS / 3600)}
          </p>
        </>
      )}
    </>
  );
};

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

const WalletCard = ({
  address,
  name,
  chip,
}: {
  address: string;
  name?: string;
  chip: { icon: IconMeaning; word: string } | null;
}) => (
  <div className="flex min-h-[64px] items-center gap-3 rounded-xl border border-app-line-strong bg-app-well px-3.5">
    <SemanticIcon name="backpack" size={38} />
    <span className="flex flex-col">
      {name && <span className="text-app-strong text-app-ink">{name}</span>}
      <span
        className={cn("whitespace-nowrap", name ? "text-app-label text-app-muted" : "text-app-strong text-app-ink")}
      >
        {shortAddress(address)}
      </span>
    </span>
    {chip && (
      <span className="ml-auto">
        <AppChip tone="good" icon={chip.icon}>
          {chip.word}
        </AppChip>
      </span>
    )}
  </div>
);

const PrizesGoHere = () => (
  <p className="flex items-center gap-2 text-app-body text-app-muted">
    <SemanticIcon name="lords" size={26} />
    <SemanticIcon name="reward-chest" size={26} />
    <SemanticIcon name="victory" size={26} />
    <span className="ml-1">{WALLET_WORDS.prizesGoHere}</span>
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
