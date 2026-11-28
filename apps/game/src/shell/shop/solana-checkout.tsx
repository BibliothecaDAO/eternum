import { useEffect, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { AppButton, AppFigure, AppNotice, AppPanel } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { FRAGMENTS_PAGE_WORDS } from "@/ui/design-system/kit/words";

import type { SentPayment, ShopGameRef } from "./fragment-payment";
import {
  deriveAssociatedTokenAddress,
  discoverSolanaWallets,
  sendSolanaUsdcTransfer,
  type SolanaStandardWallet,
} from "./solana-usdc";

interface SolanaCheckoutProps {
  readonly game: ShopGameRef;
  readonly fragments: number;
  readonly onPaid: (payment: SentPayment) => void;
  readonly onCancel: () => void;
}

const SolanaCheckout = ({ game, fragments, onPaid, onCancel }: SolanaCheckoutProps) => {
  const [wallets, setWallets] = useState<SolanaStandardWallet[] | null>(null);
  const [chosenName, setChosenName] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "sending" | "verifying">("idle");
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    void discoverSolanaWallets().then((found) => {
      if (!active) return;
      setWallets(found);
      if (found[0]) setChosenName(found[0].name);
    });
    return () => {
      active = false;
    };
  }, []);

  const selected = wallets?.find(({ name }) => name === chosenName) ?? wallets?.[0] ?? null;

  const pay = async () => {
    if (!selected || stage !== "idle") return;
    setError(null);
    setStage("sending");
    try {
      const connected = await selected.features["standard:connect"]!.connect();
      const account = connected.accounts[0] ?? selected.accounts[0];
      if (!account) throw new Error("No Solana account connected");
      const { quote } = await identityClient.quoteExternalPayment({
        chainId: game.chainId,
        gameId: game.gameId,
        fragments,
        rail: "solana",
      });
      if (!quote.memo || !quote.recentBlockhash) {
        throw new Error("Solana quote missing memo or recentBlockhash");
      }
      const sourceAta = deriveAssociatedTokenAddress(account.address, quote.token);
      const destinationAta = deriveAssociatedTokenAddress(quote.treasury, quote.token);
      const signature = await sendSolanaUsdcTransfer(selected, account, {
        sourceAta,
        mint: quote.token,
        destinationAta,
        amount: BigInt(quote.usdcUnits),
        quoteId: quote.memo,
        recentBlockhash: quote.recentBlockhash,
      });
      setStage("verifying");
      const result = await identityClient.payExternalPayment(quote.id, signature);
      onPaid({
        quoteId: quote.id,
        hash: signature,
        fragments: result.fragments ?? fragments,
        rail: "solana",
      });
    } catch (caught) {
      setError(caught);
      setStage("idle");
    }
  };

  return (
    <AppPanel icon="brand-usdc" title={FRAGMENTS_PAGE_WORDS.solanaHeading}>
      <div className="flex flex-col gap-3" data-solana-checkout>
        <AppFigure
          tone="gold"
          value={FRAGMENTS_PAGE_WORDS.price(fragments)}
          label={FRAGMENTS_PAGE_WORDS.pack(fragments)}
        />
        {wallets !== null && wallets.length === 0 && (
          <AppNotice tone="warn" line={FRAGMENTS_PAGE_WORDS.solanaNoWallet} />
        )}
        {wallets !== null && wallets.length > 0 && (
          <div className="flex flex-col gap-2" data-solana-wallets>
            <span className="text-app-label text-app-muted">{FRAGMENTS_PAGE_WORDS.solanaChooseWallet}</span>
            <div className="grid grid-cols-2 gap-2">
              {wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  type="button"
                  className="app-choice shop-rail-wallet"
                  aria-pressed={selected?.name === wallet.name}
                  onClick={() => setChosenName(wallet.name)}
                >
                  {wallet.icon && <img src={wallet.icon} alt="" width={20} height={20} />}
                  <span>{wallet.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {error !== null && <ServiceFailure service="season" error={error} retry={() => void pay()} />}
        <div className="flex flex-wrap gap-2">
          <AppButton
            kind="primary"
            size="lg"
            icon="brand-usdc"
            disabled={!selected || stage !== "idle"}
            busy={
              stage === "sending"
                ? FRAGMENTS_PAGE_WORDS.solanaSending
                : stage === "verifying"
                  ? FRAGMENTS_PAGE_WORDS.externalVerifying
                  : undefined
            }
            onClick={() => void pay()}
          >
            {FRAGMENTS_PAGE_WORDS.usdcPay(fragments)}
          </AppButton>
          <AppButton kind="quiet" disabled={stage !== "idle"} onClick={onCancel}>
            {FRAGMENTS_PAGE_WORDS.cancelCheckout}
          </AppButton>
        </div>
      </div>
    </AppPanel>
  );
};

export default SolanaCheckout;
