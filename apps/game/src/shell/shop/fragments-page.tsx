import "./fragments-page.css";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { IdentityRequestError, type FragmentPrice } from "@realms-world/identity";
import { STORE_PRODUCTS } from "@bibliothecadao/types";
import { nativeFragmentConstants } from "@bibliothecadao/eternum/game-client";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { useDefaultWallet } from "@/hooks/context/default-wallet";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { Icon } from "@/ui/design-system/icon";
import { AppButton, AppFigure, AppNotice, AppPanel } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { FRAGMENTS_PAGE_WORDS } from "@/ui/design-system/kit/words";

import { PageFrame } from "../frame/page-frame";
import { Loading } from "../loading";
import { SignedInOnly } from "../profile/profile-pages";
import { linkWalletHref } from "../profile/settings-route";
import { nextOf } from "../return-path";
import { lordsOf } from "../value/ledger";
import { WalletUnread } from "../value/wallet-unread";
import { followPayment, forgetPayment, rememberPayment, sentPaymentOf, type SentPayment } from "./fragment-payment";
import { PayWith } from "./pay-with";

const PACKS = Object.values(STORE_PRODUCTS).map(({ fragments }) => fragments);
const SEAL = nativeFragmentConstants.SEAL_FRAGMENTS;
const POLL_MS = 3_000;

type ShopGame = { chainId: string; gameId: number };
type Quote = NonNullable<FragmentPrice["quote"]>;
type Refusal = keyof typeof FRAGMENTS_PAGE_WORDS.refused;
type Paying = { fragments: number; cents: number; quote: Quote };

export const FragmentsPage = () => {
  const { search } = useLocation();
  const game = shopGameOf(search);
  return (
    <PageFrame title={FRAGMENTS_PAGE_WORDS.title}>
      <SignedInOnly fallback={(card) => card}>
        {(account) => game && <Purchase account={account} game={game} next={nextOf(search)} />}
      </SignedInOnly>
    </PageFrame>
  );
};

const Purchase = ({ account, game, next }: { account: string; game: ShopGame; next: string }) => {
  const { pathname, search } = useLocation();
  const { payer, passkey, failed, retry } = usePayer();
  const [paying, setPaying] = useState<Paying | null>(null);
  const [sent, setSent] = useState<SentPayment | null>(() => sentPaymentOf(account));
  if (sent) {
    const again = () => {
      forgetPayment(account);
      setSent(null);
      setPaying(null);
    };
    return <Delivery sent={sent} next={next} onSettled={() => forgetPayment(account)} onAgain={again} />;
  }
  if (payer === undefined) return failed ? <WalletUnread onRetry={retry} /> : <Loading />;
  if (payer === null)
    return (
      <AppButton kind="primary" to={linkWalletHref(`${pathname}${search}`)}>
        {FRAGMENTS_PAGE_WORDS.linkWallet}
      </AppButton>
    );
  if (!paying) return <Choose game={game} onPriced={setPaying} />;
  const onSent = (hash: string) => {
    const payment = { quoteId: paying.quote.id, hash, fragments: paying.fragments };
    rememberPayment(account, payment);
    setSent(payment);
  };
  return <Pay payer={payer} passkey={passkey} paying={paying} onSent={onSent} />;
};

const Choose = ({ game, onPriced }: { game: ShopGame; onPriced: (paying: Paying) => void }) => {
  const [fragments, setFragments] = useState<number>(SEAL);
  const price = useMutation({ mutationFn: (wanted: number) => identityClient.priceFragments(game, wanted) });
  const pay = () =>
    price.mutate(fragments, {
      onSuccess: ({ fragments: priced, cents, quote }) => quote && onPriced({ fragments: priced, cents, quote }),
    });
  return (
    <div className="shop-stage">
      <div className="shop-packs" data-fragment-packs>
        {PACKS.map((pack) => {
          const isSeal = pack === SEAL;
          return (
            <button
              key={pack}
              type="button"
              className="app-choice shop-pack"
              aria-pressed={pack === fragments}
              onClick={() => setFragments(pack)}
            >
              <span className="shop-pack__art" aria-hidden="true">
                <Icon name={isSeal ? "final-seal" : "fragment"} size={148} />
              </span>
              <span className="shop-pack__info">
                <span className="shop-pack__title">{FRAGMENTS_PAGE_WORDS.pack(pack)}</span>
                {isSeal && <span className="shop-pack__detail">{FRAGMENTS_PAGE_WORDS.sealPack}</span>}
              </span>
              <span className="shop-pack__price">{FRAGMENTS_PAGE_WORDS.price(pack)}</span>
            </button>
          );
        })}
      </div>
      {price.data && !price.data.quote && <AppNotice tone="warn" line={FRAGMENTS_PAGE_WORDS.noPrice} />}
      {isDailyCap(price.error) && <AppNotice tone="warn" line={FRAGMENTS_PAGE_WORDS.dailyCap} />}
      {price.isError && !isDailyCap(price.error) && <ServiceFailure service="season" error={price.error} retry={pay} />}
      <div className="shop-foot">
        <div className="shop-methods">
          <span className="shop-methods__icons" aria-hidden="true">
            <Icon name="lords" size={20} />
            <Icon name="trade" size={18} />
          </span>
          <span>LORDS · USDC · ETH · Gas sponsored</span>
        </div>
        <AppButton
          kind="primary"
          size="lg"
          icon={fragments === SEAL ? "final-seal" : "fragment"}
          className="w-full lg:w-auto"
          busy={price.isPending ? FRAGMENTS_PAGE_WORDS.pricing : undefined}
          onClick={pay}
        >
          {FRAGMENTS_PAGE_WORDS.pay(fragments)}
        </AppButton>
      </div>
    </div>
  );
};

const Pay = ({
  payer,
  passkey,
  paying,
  onSent,
}: {
  payer: string;
  passkey: boolean;
  paying: Paying;
  onSent: (hash: string) => void;
}) => (
  <AppPanel
    icon={paying.fragments === SEAL ? "final-seal" : "fragment"}
    title={FRAGMENTS_PAGE_WORDS.pack(paying.fragments)}
  >
    <div className="flex flex-col gap-3" data-fragment-quote={paying.quote.id}>
      <AppFigure
        tone="gold"
        value={FRAGMENTS_PAGE_WORDS.price(paying.fragments)}
        label={FRAGMENTS_PAGE_WORDS.treasuryReceives(lordsOf(BigInt(paying.quote.lordsWei)))}
      />
      <PayWith payer={payer} passkey={passkey} quote={paying.quote} cents={paying.cents} onSent={onSent} />
    </div>
  </AppPanel>
);

const Delivery = ({
  sent,
  next,
  onSettled,
  onAgain,
}: {
  sent: SentPayment;
  next: string;
  onSettled: () => void;
  onAgain: () => void;
}) => {
  const navigate = useNavigate();
  const payment = useQuery({
    queryKey: ["fragmentPayment", sent.hash],
    queryFn: () => followPayment(sent),
    refetchInterval: (query) => (query.state.data?.state === "delivering" ? POLL_MS : false),
    retry: false,
  });
  const refusal = refusalOf(payment.error);
  const delivered = payment.data?.state === "delivered";
  useEffect(() => {
    if (delivered || refusal) onSettled();
  }, [delivered, refusal, onSettled]);
  if (refusal)
    return (
      <div className="flex flex-col gap-3">
        <AppNotice tone="bad" line={FRAGMENTS_PAGE_WORDS.refused[refusal]} />
        <AppButton kind="secondary" onClick={onAgain}>
          {FRAGMENTS_PAGE_WORDS.title}
        </AppButton>
      </div>
    );
  if (payment.isError)
    return <ServiceFailure service="season" error={payment.error} retry={() => void payment.refetch()} />;
  if (!delivered) return <AppNotice line={FRAGMENTS_PAGE_WORDS.delivering} />;
  return (
    <div className="flex flex-col gap-3" data-fragments-delivered={sent.fragments}>
      <AppNotice tone="good" icon="fragment" line={FRAGMENTS_PAGE_WORDS.delivered(sent.fragments)} />
      <AppButton kind="primary" size="lg" icon="fragment" onClick={() => navigate(next)}>
        {FRAGMENTS_PAGE_WORDS.backToShop}
      </AppButton>
    </div>
  );
};

const usePayer = () => {
  const { session } = useIdentitySession();
  const { wallet, failed, retry } = useDefaultWallet();
  const payer =
    wallet === undefined ? undefined : (wallet?.address ?? (session ? payoutAddressOf(session.user) : null));
  return { payer, passkey: Boolean(wallet), failed, retry };
};

const shopGameOf = (search: string): ShopGame | null => {
  const params = new URLSearchParams(search);
  const chainId = params.get("chain");
  const gameId = Number(params.get("game"));
  return chainId && Number.isSafeInteger(gameId) && gameId > 0 ? { chainId, gameId } : null;
};

const isRefusal = (code: string | undefined): code is Refusal =>
  code !== undefined && code in FRAGMENTS_PAGE_WORDS.refused;

const refusalOf = (error: unknown): Refusal | null =>
  error instanceof IdentityRequestError && isRefusal(error.code) ? error.code : null;

const isDailyCap = (error: unknown) => error instanceof IdentityRequestError && error.code === "daily_cap";
