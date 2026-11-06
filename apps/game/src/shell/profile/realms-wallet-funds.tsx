import { WALLET_WORDS, CANCEL } from "@/ui/design-system/kit/words";
import { formatExact } from "@bibliothecadao/types";
import { isSameStarknetAddress } from "@realms-world/identity";
import { WALLET_GAS_TOKEN } from "@realms-world/identity/wallet";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { shortAddress } from "@/ui/design-system/kit/address";
import { AppButton, AppField, AppNotice } from "@/ui/design-system/kit/app-elements";
import { Icon } from "@/ui/design-system/icon";

import { failureSentence } from "@/ui/modules/identity/identity-failures";
import { l2Provider } from "@/runtime/l2-rpc";
import type { WalletFee } from "@/ui/modules/identity/wallet-send";

import { Loading } from "../loading";
import {
  environmentLedger,
  lordsCentsTextOf,
  lordsOf,
  lordsTextOf,
  lordsWeiOf,
  transferLordsCall,
} from "../value/ledger";

const WalletSign = lazy(() =>
  import("@/shell/value/wallet-actions").then((module) => ({ default: module.WalletSign })),
);
const FeeLine = lazy(() => import("@/shell/value/wallet-actions").then((module) => ({ default: module.FeeLine })));

/**
 * The Realms wallet's LORDS as last read, with the ledger's token they are counted in, and the LORDS it pays network
 * fees with (WALLET_GAS_TOKEN): the same balance in production; on dev, whose ledger token is a test LORDS, real LORDS.
 */
type Funds = { token: string; balance: bigint; feeBalance: bigint };

type Stage = { kind: "view" } | { kind: "form" } | { kind: "confirm"; to: string; amount: bigint } | { kind: "sent" };

/**
 * The Realms wallet's LORDS and its one action, Send: to an exchange's deposit address or the player's own wallet,
 * confirmed with the passkey (WalletSign), its network fee paid in LORDS from the wallet.
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
          funds={funds.value}
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
              // Another amount is another send, prepared and priced afresh.
              key={String(stage.amount)}
              owner={address}
              calls={[transferLordsCall(token, stage.to, stage.amount)]}
              onLanded={() => {
                setStage({ kind: "sent" });
                funds.read();
              }}
              onFeeShort={(amount) => setStage({ ...stage, amount })}
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

/**
 * Where and how much: Max offers the balance less the most the network fee may take, priced when the form opens, and
 * Review only for a Starknet address and an amount the wallet holds with its fee. A balance short of the fee says how
 * much the fee needs.
 */
const SendForm = ({
  self,
  funds,
  onReview,
  onCancel,
}: {
  self: string;
  funds: Funds;
  onReview: (to: string, amount: bigint) => void;
  onCancel: () => void;
}) => {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const fee = useSendFee(self, funds);
  const room = sendRoomOf(funds, fee);
  const wei = lordsWeiOf(amount);
  const amountOk = room.kind === "room" && wei !== null && wei > 0n && wei <= room.spendable;
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
        hint={WALLET_WORDS.inWallet(lordsTextOf(funds.balance))}
        error={amount && room.kind === "room" && !amountOk ? WALLET_WORDS.notAnAmount : undefined}
        onChange={(event) => setAmount(event.target.value)}
      />
      <div className="flex items-center gap-3">
        <FeeRoom fee={fee} room={room} />
        {room.kind === "room" && (
          <span className="ml-auto">
            <AppButton kind="quiet" onClick={() => setAmount(lordsTextOf(room.spendable))}>
              {WALLET_WORDS.sendMax}
            </AppButton>
          </span>
        )}
      </div>
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

/** The send's fee as priced when the form opened: still pricing, priced, or not priceable and why. */
type FeeQuote = { kind: "pricing" } | { kind: "priced"; fee: WalletFee } | { kind: "unpriced"; line: string };

/** What the wallet can send once its fee is paid: the room left, or the fee it cannot cover (or price, holding none). */
type SendRoom =
  | { kind: "pricing" }
  | { kind: "room"; spendable: bigint }
  | { kind: "short"; line: string }
  | { kind: "unpriced"; line: string };

const sendRoomOf = (funds: Funds, quote: FeeQuote): SendRoom => {
  if (funds.feeBalance === 0n) return { kind: "short", line: WALLET_WORDS.noFeeLords };
  if (quote.kind !== "priced") return quote;
  const { max } = quote.fee;
  if (funds.feeBalance < max)
    return {
      kind: "short",
      line: WALLET_WORDS.feeShort(lordsCentsTextOf(max, "up"), lordsCentsTextOf(funds.feeBalance, "down")),
    };
  const paysFeeFromBalance = BigInt(funds.token) === BigInt(WALLET_GAS_TOKEN);
  const spendable = paysFeeFromBalance ? funds.balance - max : funds.balance;
  if (spendable <= 0n)
    return {
      kind: "short",
      line: WALLET_WORDS.feeShort(lordsCentsTextOf(max, "up"), lordsCentsTextOf(funds.feeBalance, "down")),
    };
  return { kind: "room", spendable };
};

/** Under the amount: the fee priced, its pricing, or why nothing can be sent. */
const FeeRoom = ({ fee, room }: { fee: FeeQuote; room: SendRoom }) => {
  if (room.kind === "pricing") return <span className="text-app-label text-app-muted">{WALLET_WORDS.pricing}</span>;
  if (room.kind !== "room") return <span className="text-app-label text-app-bad">{room.line}</span>;
  if (fee.kind !== "priced") return null;
  return (
    <Suspense fallback={null}>
      <FeeLine fee={fee.fee} />
    </Suspense>
  );
};

/**
 * A send's fee, priced once as the form opens: the paymaster builds a send of one wei to another address, as a real
 * send writes two balances, and answers its fee. Nothing is signed or spent; the review prices the real send again.
 */
const useSendFee = (self: string, funds: Funds): FeeQuote => {
  const [quote, setQuote] = useState<FeeQuote>({ kind: "pricing" });
  const { token, feeBalance } = funds;
  useEffect(() => {
    if (feeBalance === 0n) return;
    let current = true;
    void import("@/ui/modules/identity/wallet-send").then(({ prepareDefaultWalletSend, FeeRoomShortError }) =>
      prepareDefaultWalletSend(self, [transferLordsCall(token, QUOTE_RECIPIENT, 1n)], l2Provider()).then(
        ({ fee }) =>
          current && setQuote(fee ? { kind: "priced", fee } : { kind: "unpriced", line: WALLET_WORDS.noFeeLords }),
        // A wallet short of its fee is still priced: the room below says how much the fee needs.
        (cause: unknown) =>
          current &&
          setQuote(
            cause instanceof FeeRoomShortError
              ? { kind: "priced", fee: cause.fee }
              : { kind: "unpriced", line: failureSentence("send", cause) },
          ),
      ),
    );
    return () => {
      current = false;
    };
  }, [self, token, feeBalance]);
  return quote;
};

/** Where a priced send goes: any address but the wallet's own, so its build writes a second balance. */
const QUOTE_RECIPIENT = "0x1";

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
      const balance = await ledger.balanceOf(token, address);
      const paysFeeFromBalance = BigInt(token) === BigInt(WALLET_GAS_TOKEN);
      const feeBalance = paysFeeFromBalance ? balance : await ledger.balanceOf(WALLET_GAS_TOKEN, address);
      setValue({ token, balance, feeBalance });
    })().catch((error) => console.error("realms_wallet_funds_failed", error));
  }, [address]);
  useEffect(() => {
    read();
  }, [read]);
  return { value, read };
};
