import { useEffect, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { AppButton, AppFigure, AppNotice, AppPanel } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { FRAGMENTS_PAGE_WORDS } from "@/ui/design-system/kit/words";

import {
  discoverEip6963Providers,
  EvmChainRefusedError,
  sendEvmUsdcTransfer,
  type Eip6963ProviderDetail,
} from "./evm-usdc";
import type { SentPayment, ShopGameRef } from "./fragment-payment";

interface EvmCheckoutProps {
  readonly game: ShopGameRef;
  readonly fragments: number;
  readonly onPaid: (payment: SentPayment) => void;
  readonly onCancel: () => void;
}

const EvmCheckout = ({ game, fragments, onPaid, onCancel }: EvmCheckoutProps) => {
  const [providers, setProviders] = useState<Eip6963ProviderDetail[] | null>(null);
  const [chosenUuid, setChosenUuid] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "sending" | "verifying">("idle");
  const [chainRefused, setChainRefused] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    void discoverEip6963Providers().then((found) => {
      if (!active) return;
      setProviders(found);
      if (found[0]) setChosenUuid(found[0].info.uuid);
    });
    return () => {
      active = false;
    };
  }, []);

  const selected = providers?.find(({ info }) => info.uuid === chosenUuid) ?? providers?.[0] ?? null;

  const pay = async () => {
    if (!selected || stage !== "idle") return;
    setError(null);
    setChainRefused(false);
    setStage("sending");
    try {
      const { quote } = await identityClient.quoteExternalPayment({
        chainId: game.chainId,
        gameId: game.gameId,
        fragments,
        rail: "evm",
        networkChainId: 1,
      });
      if (quote.chainId !== 1) throw new Error("EVM payment quote is not on Ethereum mainnet");
      const hash = await sendEvmUsdcTransfer(selected.provider, {
        usdc: quote.token,
        treasury: quote.treasury,
        usdcAmount: quote.usdcUnits,
        memo: quote.memo,
      });
      setStage("verifying");
      const result = await identityClient.payExternalPayment(quote.id, hash);
      onPaid({ quoteId: quote.id, hash, fragments: result.fragments ?? fragments, rail: "evm" });
    } catch (caught) {
      if (caught instanceof EvmChainRefusedError) {
        setChainRefused(true);
      } else {
        setError(caught);
      }
      setStage("idle");
    }
  };

  return (
    <AppPanel icon="brand-usdc" title={FRAGMENTS_PAGE_WORDS.evmHeading}>
      <div className="flex flex-col gap-3" data-evm-checkout>
        <AppFigure
          tone="gold"
          value={FRAGMENTS_PAGE_WORDS.price(fragments)}
          label={FRAGMENTS_PAGE_WORDS.pack(fragments)}
        />
        {providers !== null && providers.length === 0 && (
          <AppNotice tone="warn" line={FRAGMENTS_PAGE_WORDS.evmNoWallet} />
        )}
        {providers !== null && providers.length > 0 && (
          <div className="flex flex-col gap-2" data-evm-wallets>
            <span className="text-app-label text-app-muted">{FRAGMENTS_PAGE_WORDS.evmChooseWallet}</span>
            <div className="grid grid-cols-2 gap-2">
              {providers.map(({ info }) => (
                <button
                  key={info.uuid}
                  type="button"
                  className="app-choice shop-rail-wallet"
                  aria-pressed={selected?.info.uuid === info.uuid}
                  onClick={() => setChosenUuid(info.uuid)}
                >
                  {info.icon && <img src={info.icon} alt="" width={20} height={20} />}
                  <span>{info.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {chainRefused && <AppNotice tone="warn" line={FRAGMENTS_PAGE_WORDS.evmWrongChain} />}
        {error !== null && <ServiceFailure service="season" error={error} retry={() => void pay()} />}
        <div className="flex flex-wrap gap-2">
          <AppButton
            kind="primary"
            size="lg"
            icon="brand-usdc"
            disabled={!selected || stage !== "idle"}
            busy={
              stage === "sending"
                ? FRAGMENTS_PAGE_WORDS.evmSending
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

export default EvmCheckout;
