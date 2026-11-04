import { WALLET_WORDS, CANCEL } from "@/ui/design-system/kit/words";
import { formatExact } from "@bibliothecadao/types";
import { isSameStarknetAddress } from "@realms-world/identity";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { shortAddress } from "@/ui/design-system/kit/address";
import { AppButton, AppField, AppNotice } from "@/ui/design-system/kit/app-elements";
import { Icon } from "@/ui/design-system/icon";

import { Loading } from "../loading";
import { environmentLedger, lordsOf, lordsTextOf, lordsWeiOf, transferLordsCall } from "../value/ledger";

const WalletSign = lazy(() =>
  import("@/shell/value/wallet-actions").then((module) => ({ default: module.WalletSign })),
);

/** The Realms wallet's LORDS as last read, with the ledger's token they are counted in. */
type Funds = { token: string; balance: bigint };

type Stage = { kind: "view" } | { kind: "form" } | { kind: "confirm"; to: string; amount: bigint } | { kind: "sent" };

/**
 * The Realms wallet's LORDS and its one action, Send: to an exchange's deposit address or the player's own wallet,
 * confirmed with the passkey and paid for by the sponsor (WalletSign).
 */
export const RealmsWalletFunds = ({
  address,
  onSending,
}: {
  address: string;
  /** A send is being written or confirmed: the panel around it steps aside until it ends. */
  onSending?: (sending: boolean) => void;
}) => {
  const funds = useFunds(address);
  const [stage, setStage] = useState<Stage>({ kind: "view" });
  const sending = stage.kind === "form" || stage.kind === "confirm";
  useEffect(() => {
    onSending?.(sending);
  }, [onSending, sending]);
  if (!funds.value) return null;
  const { token, balance } = funds.value;
  const lords = formatExact(lordsOf(balance));
  switch (stage.kind) {
    case "form":
      return (
        <SendForm
          self={address}
          balance={balance}
          onReview={(to, amount) => setStage({ kind: "confirm", to, amount })}
          onCancel={() => setStage({ kind: "view" })}
        />
      );
    case "confirm":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-app-body text-app-ink">
            {WALLET_WORDS.sendLine(lordsTextOf(stage.amount), shortAddress(stage.to))}
          </p>
          <Suspense fallback={<Loading />}>
            <WalletSign
              owner={address}
              calls={[transferLordsCall(token, stage.to, stage.amount)]}
              onLanded={() => {
                setStage({ kind: "sent" });
                funds.read();
              }}
            />
          </Suspense>
          <AppButton kind="quiet" onClick={() => setStage({ kind: "view" })}>
            {CANCEL}
          </AppButton>
        </div>
      );
    default:
      return (
        <div className="flex flex-col gap-3">
          {stage.kind === "sent" && <AppNotice tone="good" line={WALLET_WORDS.sent} />}
          <div className="flex items-center gap-3">
            <Icon name="lords" size={30} />
            <span className="text-app-heading text-app-ink">{lords} LORDS</span>
            <span className="ml-auto">
              <AppButton
                kind="secondary"
                icon="arrow-right"
                disabled={balance === 0n}
                onClick={() => setStage({ kind: "form" })}
              >
                {WALLET_WORDS.send}
              </AppButton>
            </span>
          </div>
        </div>
      );
  }
};

/** Where and how much: the whole balance offered, and Review only for a Starknet address and an amount it holds. */
const SendForm = ({
  self,
  balance,
  onReview,
  onCancel,
}: {
  self: string;
  balance: bigint;
  onReview: (to: string, amount: bigint) => void;
  onCancel: () => void;
}) => {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState(lordsTextOf(balance));
  const wei = lordsWeiOf(amount);
  const amountOk = wei !== null && wei > 0n && wei <= balance;
  const toOk = isStarknetAddress(to) && !isSameStarknetAddress(to, self);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (toOk && amountOk) onReview(to.trim(), wei!);
      }}
    >
      <AppField
        label={WALLET_WORDS.sendTo}
        icon="backpack"
        placeholder="0x…"
        autoComplete="off"
        spellCheck={false}
        value={to}
        hint={WALLET_WORDS.sendToHint}
        error={to && !toOk ? WALLET_WORDS.notAnAddress : undefined}
        onChange={(event) => setTo(event.target.value)}
      />
      <AppField
        label={WALLET_WORDS.sendAmount}
        icon="lords"
        inputMode="decimal"
        value={amount}
        hint={WALLET_WORDS.inWallet(lordsTextOf(balance))}
        error={amount && !amountOk ? WALLET_WORDS.notAnAmount : undefined}
        onChange={(event) => setAmount(event.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <AppButton kind="quiet" onClick={onCancel}>
          {CANCEL}
        </AppButton>
        <AppButton kind="primary" type="submit" disabled={!toOk || !amountOk}>
          {WALLET_WORDS.review}
        </AppButton>
      </div>
    </form>
  );
};

const isStarknetAddress = (text: string) => {
  const value = text.trim();
  return /^0x[0-9a-fA-F]{1,64}$/.test(value) && BigInt(value) > 0n && BigInt(value) < 2n ** 251n;
};

/** The wallet's LORDS on the environment's ledger token, read on open and again after a send lands. */
const useFunds = (address: string) => {
  const [value, setValue] = useState<Funds | null>(null);
  const read = useCallback(() => {
    const ledger = environmentLedger();
    if (!ledger) return;
    void (async () => {
      const token = await ledger.lordsToken();
      setValue({ token, balance: await ledger.balanceOf(token, address) });
    })().catch((error) => console.error("realms_wallet_funds_failed", error));
  }, [address]);
  useEffect(() => {
    read();
  }, [read]);
  return { value, read };
};
