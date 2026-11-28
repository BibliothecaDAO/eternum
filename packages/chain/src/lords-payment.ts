const TRANSFER_SELECTOR =
  "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9";
const SETTLED = ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"];

export interface PaymentReceipt {
  execution_status?: string;
  finality_status?: string;
  events?: readonly PaymentEvent[];
}

interface PaymentEvent {
  from_address: string;
  keys: readonly string[];
  data: readonly string[];
}

interface Transfer {
  from: bigint;
  to: bigint;
  wei: bigint;
}

export const isSettledPayment = (receipt: PaymentReceipt) =>
  receipt.execution_status === "SUCCEEDED" &&
  SETTLED.includes(receipt.finality_status ?? "");

export const isRevertedPayment = (receipt: PaymentReceipt) =>
  receipt.execution_status === "REVERTED";

const VELORDS_SPLIT_BPS = 500n;
const SPLIT_BPS_DENOMINATOR = 10_000n;

export const splitLordsPayment = (
  lordsWei: bigint,
): { treasuryWei: bigint; veLordsWei: bigint } => {
  if (lordsWei < 0n) throw new Error("LORDS amount must be non-negative");
  const veLordsWei = (lordsWei * VELORDS_SPLIT_BPS) / SPLIT_BPS_DENOMINATOR;
  return { treasuryWei: lordsWei - veLordsWei, veLordsWei };
};

export const lordsPaidBy = (
  receipt: PaymentReceipt,
  payment: { token: string; treasury: string; payers: readonly string[] },
): bigint => {
  const payers = payment.payers.map(BigInt);
  return (receipt.events ?? [])
    .filter((event) => BigInt(event.from_address) === BigInt(payment.token))
    .map(transferOf)
    .filter(
      (transfer): transfer is Transfer =>
        transfer !== null &&
        transfer.to === BigInt(payment.treasury) &&
        payers.includes(transfer.from),
    )
    .reduce((paid, transfer) => paid + transfer.wei, 0n);
};

export const lordsSplitPaidBy = (
  receipt: PaymentReceipt,
  payment: {
    token: string;
    treasury: string;
    veLords: string;
    payers: readonly string[];
  },
): { treasuryWei: bigint; veLordsWei: bigint; totalWei: bigint } => {
  const treasuryWei = lordsPaidBy(receipt, {
    token: payment.token,
    treasury: payment.treasury,
    payers: payment.payers,
  });
  const veLordsWei =
    BigInt(payment.veLords) === BigInt(payment.treasury)
      ? 0n
      : lordsPaidBy(receipt, {
          token: payment.token,
          treasury: payment.veLords,
          payers: payment.payers,
        });
  return { treasuryWei, veLordsWei, totalWei: treasuryWei + veLordsWei };
};

const transferOf = ({ keys, data }: PaymentEvent): Transfer | null => {
  if (keys.length === 0 || BigInt(keys[0]!) !== BigInt(TRANSFER_SELECTOR))
    return null;
  const [from, to, low, high] =
    keys.length === 3 ? [keys[1], keys[2], data[0], data[1]] : data;
  if (!from || !to || !low || !high) return null;
  return {
    from: BigInt(from),
    to: BigInt(to),
    wei: BigInt(low) + (BigInt(high) << 128n),
  };
};
