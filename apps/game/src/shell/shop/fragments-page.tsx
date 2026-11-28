import "./fragments-page.css";

import { lazy, Suspense, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { IdentityRequestError, type ShopPaymentMethods } from "@realms-world/identity";
import { FRAGMENT_CENTS, MIN_FRAGMENTS, STORE_PRODUCTS, formatCharge } from "@bibliothecadao/types";
import { nativeFragmentConstants } from "@bibliothecadao/eternum/game-client";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { allowsWebCheckout } from "@/runtime/distribution-channel";
import { L2_LORDS } from "@/runtime/l2-rpc";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import {
  AppButton,
  AppChip,
  AppField,
  AppFigure,
  AppNotice,
  AppPanel,
  AppTabs,
} from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { FRAGMENTS_PAGE_WORDS, SHOP_WORDS, WORDS } from "@/ui/design-system/kit/words";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { gameRefOf, useDirectory } from "../herald";
import { Loading } from "../loading";
import { SealCodeCard } from "../play/seal-code-card";
import { SignedInOnly } from "../profile/profile-pages";
import { linkWalletHref } from "../profile/settings-route";
import { nextOf } from "../return-path";
import { SEASON_SPENDS_FRAGMENTS, questBonusPercentOf } from "../season";
import { chooseSeason } from "../season-pick";
import { lordsOf } from "../value/ledger";
import { invalidateLordsBalance } from "../value/use-lords-balance";
import { usePayer } from "../value/use-payer";
import { WalletUnread } from "../value/wallet-unread";
import {
  availableRails,
  followPayment,
  forgetPayment,
  rememberPayment,
  sentPaymentOf,
  type PaymentRailKey,
  type SentPayment,
  type ShopGameRef,
} from "./fragment-payment";
import { PAY_TOKEN_ICONS, payTokensForToken, quoteSplitOf, type FragmentQuote, type PayToken } from "./pay-tokens";
import { PayWith } from "./pay-with";
import { SEASON_ONE_REALM_SKINS, SeasonOneSkins } from "./season-one-skins";

const StripeCheckout = lazy(() => import("./stripe-checkout"));
const EvmCheckout = lazy(() => import("./evm-checkout"));
const SolanaCheckout = lazy(() => import("./solana-checkout"));

const PACKS = Object.values(STORE_PRODUCTS).map(({ fragments }) => fragments);
const SEAL = nativeFragmentConstants.SEAL_FRAGMENTS;
const POLL_MS = 3_000;

const RAIL_ICONS = {
  stripe: "fragment",
  starknet: "lords",
  evm: "brand-eth",
  solana: "brand-usdc",
} as const satisfies Record<PaymentRailKey, IconMeaning>;

type Refusal = keyof typeof FRAGMENTS_PAGE_WORDS.refused;
type Paying =
  | { readonly rail: "starknet"; readonly fragments: number; readonly cents: number; readonly quote: FragmentQuote }
  | { readonly rail: "stripe" | "evm" | "solana"; readonly fragments: number };
type ShopZone = "spend" | "buy";
type DirectoryFailure = { error: unknown; retry: () => void };
type WalletState = {
  payer: string | null | undefined;
  failed: boolean;
  retry: () => void;
  linkWalletTo: string;
};

export const FragmentsPage = ({ spends = SEASON_SPENDS_FRAGMENTS }: { spends?: boolean } = {}) => {
  const { session } = useIdentitySession();
  if (!spends) {
    return (
      <PageFrame title={WORDS.shop}>
        <SignedInOnly fallback={(card) => card}>
          {() => <ShopClosed owner={session?.user.realmsId ?? null} />}
        </SignedInOnly>
      </PageFrame>
    );
  }
  return <OpenFragmentsPage />;
};

const ShopClosed = ({ owner }: { owner: string | null }) => (
  <div className="shop-closed" data-shop-page data-shop-closed>
    <AppPanel title={FRAGMENTS_PAGE_WORDS.closedTitle} icon="fragment">
      <div className="flex flex-col gap-4">
        <AppNotice line={FRAGMENTS_PAGE_WORDS.closedLine} />
        <SealCodeCard owner={owner} />
      </div>
    </AppPanel>
  </div>
);

const OpenFragmentsPage = () => {
  const { search } = useLocation();
  const directory = useDirectory();
  const explicitGame = shopGameOf(search);
  const activeSeason = chooseSeason(directory.data?.games ?? [], true);
  const game = explicitGame ?? (activeSeason ? gameRefOf(activeSeason) : null);
  const waitingDirectory = explicitGame === null && directory.isPending;
  const directoryFailure: DirectoryFailure | null =
    explicitGame === null && directory.isError
      ? { error: directory.error, retry: () => void directory.refetch() }
      : null;
  const questBonusPercent = questBonusPercentOf(activeSeason);
  return (
    <PageFrame title={WORDS.shop}>
      <SignedInOnly fallback={(card) => card}>
        {(account) =>
          waitingDirectory ? (
            <Loading />
          ) : (
            <ShopWorkspace
              account={account}
              game={game}
              hasExplicitGame={explicitGame !== null}
              questBonusPercent={questBonusPercent}
              directoryFailure={directoryFailure}
              next={nextOf(search)}
            />
          )
        }
      </SignedInOnly>
    </PageFrame>
  );
};

const ShopWorkspace = ({
  account,
  game,
  hasExplicitGame,
  questBonusPercent,
  directoryFailure,
  next,
}: {
  account: string;
  game: ShopGameRef | null;
  hasExplicitGame: boolean;
  questBonusPercent: number | null;
  directoryFailure: DirectoryFailure | null;
  next: string | null;
}) => {
  const queryClient = useQueryClient();
  const { session } = useIdentitySession();
  const { pathname, search } = useLocation();
  const phone = useLayout() === "phone";
  const webCheckout = allowsWebCheckout();
  const [zone, setZone] = useState<ShopZone>(webCheckout && hasExplicitGame ? "buy" : "spend");
  const { payer, passkey, failed, retry } = usePayer();
  const [paying, setPaying] = useState<Paying | null>(null);
  const [sent, setSent] = useState<SentPayment | null>(() => sentPaymentOf(account));
  const methodsQuery = useQuery({
    queryKey: ["shopPaymentMethods"],
    queryFn: () => identityClient.shopPaymentMethods(),
    enabled: webCheckout,
    retry: false,
  });
  const methods = methodsQuery.data;
  const spendSection = <SpendZone owner={session?.user.realmsId ?? null} questBonusPercent={questBonusPercent} />;

  if (!webCheckout) {
    return (
      <div className="shop-closed" data-shop-page data-store-shell>
        {spendSection}
        <AppNotice line={FRAGMENTS_PAGE_WORDS.webCheckoutOnly} />
      </div>
    );
  }

  if (sent) {
    const again = () => {
      forgetPayment(account);
      setSent(null);
      setPaying(null);
    };
    const onSettled = () => {
      forgetPayment(account);
      void invalidateLordsBalance(queryClient);
    };
    return <Delivery sent={sent} next={next} onSettled={onSettled} onAgain={again} />;
  }

  if (paying) {
    const recordPayment = (payment: SentPayment) => {
      rememberPayment(account, payment);
      void invalidateLordsBalance(queryClient);
      setSent(payment);
    };
    if (paying.rail === "starknet" && payer) {
      return (
        <Pay
          payer={payer}
          passkey={passkey}
          paying={paying}
          onSent={(hash) =>
            recordPayment({ quoteId: paying.quote.id, hash, fragments: paying.fragments, rail: "starknet" })
          }
        />
      );
    }
    if (game && paying.rail === "stripe" && methods?.stripe) {
      return (
        <Suspense fallback={<Loading />}>
          <StripeCheckout
            game={game}
            fragments={paying.fragments}
            publishableKey={methods.stripe.publishableKey}
            onPaid={recordPayment}
            onCancel={() => setPaying(null)}
          />
        </Suspense>
      );
    }
    if (game && paying.rail === "evm" && methods?.evm) {
      return (
        <Suspense fallback={<Loading />}>
          <EvmCheckout
            game={game}
            fragments={paying.fragments}
            onPaid={recordPayment}
            onCancel={() => setPaying(null)}
          />
        </Suspense>
      );
    }
    if (game && paying.rail === "solana" && methods?.solana) {
      return (
        <Suspense fallback={<Loading />}>
          <SolanaCheckout
            game={game}
            fragments={paying.fragments}
            onPaid={recordPayment}
            onCancel={() => setPaying(null)}
          />
        </Suspense>
      );
    }
  }

  const wallet: WalletState = { payer, failed, retry, linkWalletTo: linkWalletHref(`${pathname}${search}`) };
  const buySection = (
    <AppPanel
      title={FRAGMENTS_PAGE_WORDS.buyTab}
      icon="fragment"
      cue={<AppChip>{FRAGMENTS_PAGE_WORDS.unitPrice(FRAGMENT_CENTS)}</AppChip>}
    >
      {directoryFailure ? (
        <ServiceFailure service="season" error={directoryFailure.error} retry={directoryFailure.retry} />
      ) : game === null ? (
        <p className="text-app-body text-app-muted">{FRAGMENTS_PAGE_WORDS.noLiveSeason}</p>
      ) : (
        <Choose game={game} wallet={wallet} methods={methods} onPriced={setPaying} />
      )}
    </AppPanel>
  );
  if (phone) {
    return (
      <div className="shop-phone" data-shop-page>
        <AppTabs
          label={WORDS.shop}
          value={zone}
          onChange={setZone}
          tabs={[
            { key: "spend", label: FRAGMENTS_PAGE_WORDS.passTab },
            { key: "buy", label: FRAGMENTS_PAGE_WORDS.buyTab },
          ]}
        >
          <div className="pt-4">{zone === "buy" ? buySection : spendSection}</div>
        </AppTabs>
      </div>
    );
  }
  return (
    <div className="shop-hub" data-shop-page>
      <div className="flex min-w-0 flex-col gap-5">{spendSection}</div>
      <div className="flex min-w-0 flex-col gap-5">{buySection}</div>
    </div>
  );
};

const SpendZone = ({ owner, questBonusPercent }: { owner: string | null; questBonusPercent: number | null }) => (
  <AppPanel
    title={FRAGMENTS_PAGE_WORDS.passTab}
    icon="final-seal"
    cue={<AppChip tone="gold">{FRAGMENTS_PAGE_WORDS.passBadge}</AppChip>}
  >
    <div className="shop-spend" data-shop-spend>
      <SealShowcase questBonusPercent={questBonusPercent} />
      <SealCodeCard owner={owner} embedded />
      <FragmentUses />
    </div>
  </AppPanel>
);

const SealShowcase = ({ questBonusPercent }: { questBonusPercent: number | null }) => (
  <div className="shop-seal-hero">
    <div className="shop-seal-hero__top">
      <span className="shop-seal-hero__icon" aria-hidden="true">
        <Icon name="final-seal" size={68} />
      </span>
      <div className="shop-seal-hero__meta">
        <div className="shop-seal-hero__head">
          <div className="shop-seal-hero__title-row">
            <h3 className="shop-seal-hero__title">{FRAGMENTS_PAGE_WORDS.sealCardTitle}</h3>
            <AppChip tone="gold">{SHOP_WORDS.founderBadge}</AppChip>
          </div>
          <span className="shop-seal-hero__cost">
            <Icon name="fragment" size={16} />
            {formatCharge(SEAL)}
          </span>
        </div>
        <span className="text-app-label text-app-muted">{SHOP_WORDS.passFor}</span>
      </div>
    </div>
    <ul className="shop-seal-perks">
      {questBonusPercent !== null && questBonusPercent > 0 && (
        <li className="shop-seal-perks__item shop-seal-perks__item--bonus">
          {SHOP_WORDS.questBonus(questBonusPercent)}
        </li>
      )}
      <li className="shop-seal-perks__item">{SHOP_WORDS.skinsIncluded(SEASON_ONE_REALM_SKINS.length)}</li>
    </ul>
    <SeasonOneSkins surface="app" />
    <p className="text-app-label text-app-muted">{FRAGMENTS_PAGE_WORDS.sealInGameNote}</p>
  </div>
);

const FragmentUses = () => (
  <div className="shop-uses">
    <h3 className="shop-uses__title">{FRAGMENTS_PAGE_WORDS.inGameUsesTitle}</h3>
    <ul className="shop-uses__list">
      <li className="shop-uses__item">
        <Icon name="stamina" size={20} />
        <span>{FRAGMENTS_PAGE_WORDS.inGameStamina(nativeFragmentConstants.STAMINA_PER_FRAGMENT)}</span>
      </li>
      <li className="shop-uses__item">
        <Icon name="refresh" size={20} />
        <span>{FRAGMENTS_PAGE_WORDS.inGameOath(nativeFragmentConstants.OATH_REROLL_FRAGMENTS)}</span>
      </li>
    </ul>
  </div>
);

const Choose = ({
  game,
  wallet,
  methods,
  onPriced,
}: {
  game: ShopGameRef;
  wallet: WalletState;
  methods: ShopPaymentMethods | undefined;
  onPriced: (paying: Paying) => void;
}) => {
  const navigate = useNavigate();
  const [fragments, setFragments] = useState<number>(SEAL);
  const [customText, setCustomText] = useState("");
  const [waitingWallet, setWaitingWallet] = useState(false);
  const [chosenRail, setChosenRail] = useState<PaymentRailKey | null>(null);
  const rails = availableRails(methods);
  const activeRail: PaymentRailKey = chosenRail && rails.includes(chosenRail) ? chosenRail : (rails[0] ?? "starknet");
  const tokens = payTokensForToken(L2_LORDS);
  const price = useMutation({ mutationFn: (wanted: number) => identityClient.priceFragments(game, wanted) });
  const { mutate: requestPrice } = price;
  const parsedCustom = customText.trim() === "" ? null : Number(customText.trim());
  const customValid = parsedCustom !== null && Number.isSafeInteger(parsedCustom) && parsedCustom >= MIN_FRAGMENTS;
  const customError =
    customText.trim() !== "" && !customValid ? FRAGMENTS_PAGE_WORDS.customHint(MIN_FRAGMENTS) : undefined;
  const selectedAmount = parsedCustom !== null ? (customValid ? parsedCustom : 0) : fragments;
  const canPay = selectedAmount >= MIN_FRAGMENTS && customError === undefined;
  const displayAmount = canPay ? selectedAmount : fragments;

  useEffect(() => {
    if (!waitingWallet || activeRail !== "starknet") return;
    if (wallet.failed) {
      setWaitingWallet(false);
      return;
    }
    if (wallet.payer === null) {
      setWaitingWallet(false);
      navigate(wallet.linkWalletTo);
      return;
    }
    if (wallet.payer) {
      setWaitingWallet(false);
      if (canPay) {
        requestPrice(selectedAmount, {
          onSuccess: ({ fragments: priced, cents, quote }) =>
            quote && onPriced({ rail: "starknet", fragments: priced, cents, quote }),
        });
      }
    }
  }, [
    waitingWallet,
    activeRail,
    wallet.failed,
    wallet.payer,
    wallet.linkWalletTo,
    canPay,
    selectedAmount,
    navigate,
    requestPrice,
    onPriced,
  ]);

  const pay = () => {
    if (!canPay) return;
    if (activeRail !== "starknet") {
      onPriced({ rail: activeRail, fragments: selectedAmount });
      return;
    }
    if (wallet.payer === null) {
      navigate(wallet.linkWalletTo);
      return;
    }
    if (wallet.payer === undefined) {
      setWaitingWallet(true);
      return;
    }
    requestPrice(selectedAmount, {
      onSuccess: ({ fragments: priced, cents, quote }) =>
        quote && onPriced({ rail: "starknet", fragments: priced, cents, quote }),
    });
  };

  return (
    <div className="shop-stage">
      <div className="shop-packs" data-fragment-packs>
        {PACKS.map((pack) => {
          const isSeal = pack === SEAL;
          const active = customText.trim() === "" && pack === fragments;
          return (
            <button
              key={pack}
              type="button"
              className="app-choice shop-pack"
              aria-pressed={active}
              onClick={() => {
                setCustomText("");
                setFragments(pack);
              }}
            >
              <span className="shop-pack__art" aria-hidden="true">
                <Icon name={isSeal ? "final-seal" : "fragment"} size={84} />
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
      <div className="shop-custom" data-fragment-custom>
        <AppField
          label={FRAGMENTS_PAGE_WORDS.customLabel}
          type="number"
          inputMode="numeric"
          min={MIN_FRAGMENTS}
          step={10}
          placeholder={String(MIN_FRAGMENTS)}
          hint={FRAGMENTS_PAGE_WORDS.customHint(MIN_FRAGMENTS)}
          error={customError}
          icon="fragment"
          value={customText}
          onChange={(event) => setCustomText(event.target.value)}
        />
      </div>
      {rails.length > 1 && <RailSelector rails={rails} active={activeRail} onSelect={setChosenRail} />}
      {price.data && !price.data.quote && <AppNotice tone="warn" line={FRAGMENTS_PAGE_WORDS.noPrice} />}
      {isDailyCap(price.error) && <AppNotice tone="warn" line={FRAGMENTS_PAGE_WORDS.dailyCap} />}
      {price.isError && !isDailyCap(price.error) && <ServiceFailure service="season" error={price.error} retry={pay} />}
      <CheckoutFoot
        displayAmount={displayAmount}
        canPay={canPay}
        activeRail={activeRail}
        tokens={tokens}
        wallet={wallet}
        busy={
          waitingWallet
            ? FRAGMENTS_PAGE_WORDS.walletPending
            : price.isPending
              ? FRAGMENTS_PAGE_WORDS.pricing
              : undefined
        }
        onPay={pay}
      />
    </div>
  );
};

const RailSelector = ({
  rails,
  active,
  onSelect,
}: {
  rails: readonly PaymentRailKey[];
  active: PaymentRailKey;
  onSelect: (rail: PaymentRailKey) => void;
}) => (
  <div className="shop-rails" data-payment-rails>
    <span className="text-app-label text-app-muted">{FRAGMENTS_PAGE_WORDS.paymentMethodLabel}</span>
    <div className="shop-rails__grid">
      {rails.map((rail) => (
        <button
          key={rail}
          type="button"
          className="app-choice shop-rail"
          data-rail={rail}
          aria-pressed={active === rail}
          onClick={() => onSelect(rail)}
        >
          <Icon name={RAIL_ICONS[rail]} size={18} />
          <span>{FRAGMENTS_PAGE_WORDS.rails[rail]}</span>
        </button>
      ))}
    </div>
  </div>
);

const CheckoutFoot = ({
  displayAmount,
  canPay,
  activeRail,
  tokens,
  wallet,
  busy,
  onPay,
}: {
  displayAmount: number;
  canPay: boolean;
  activeRail: PaymentRailKey;
  tokens: readonly PayToken[];
  wallet: WalletState;
  busy?: string;
  onPay: () => void;
}) => {
  const starknet = activeRail === "starknet";
  return (
    <div className="shop-checkout">
      <div className="shop-checkout__summary">
        <span className="text-app-label text-app-muted">{FRAGMENTS_PAGE_WORDS.selectedLabel}</span>
        <span className="shop-checkout__total">
          <span>{FRAGMENTS_PAGE_WORDS.pack(displayAmount)}</span>
          <span className="shop-checkout__dollars">{FRAGMENTS_PAGE_WORDS.price(displayAmount)}</span>
        </span>
      </div>
      {starknet && (
        <div className="shop-methods">
          <span className="shop-methods__icons" aria-hidden="true">
            {tokens.map(({ key }) => (
              <Icon key={key} name={PAY_TOKEN_ICONS[key]} size={18} />
            ))}
          </span>
          <span>{FRAGMENTS_PAGE_WORDS.payWithTokens(tokens.map(({ symbol }) => symbol))}</span>
        </div>
      )}
      {starknet && wallet.payer === undefined && wallet.failed ? (
        <WalletUnread onRetry={wallet.retry} />
      ) : (
        <>
          <AppButton
            kind="primary"
            size="lg"
            icon={displayAmount === SEAL ? "final-seal" : "fragment"}
            className="w-full"
            disabled={!canPay}
            busy={busy}
            onClick={onPay}
          >
            {FRAGMENTS_PAGE_WORDS.pay(displayAmount)}
          </AppButton>
          {starknet && wallet.payer === null && (
            <p className="shop-wallet-note" data-wallet-deferred>
              {FRAGMENTS_PAGE_WORDS.noWalletNote}
            </p>
          )}
        </>
      )}
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
  paying: Extract<Paying, { rail: "starknet" }>;
  onSent: (hash: string) => void;
}) => {
  const split = quoteSplitOf(paying.quote);
  const label =
    split.veLordsWei > 0n
      ? FRAGMENTS_PAGE_WORDS.veLordsSplit(lordsOf(split.treasuryWei), lordsOf(split.veLordsWei))
      : FRAGMENTS_PAGE_WORDS.treasuryReceives(lordsOf(split.treasuryWei));
  return (
    <AppPanel
      icon={paying.fragments === SEAL ? "final-seal" : "fragment"}
      title={FRAGMENTS_PAGE_WORDS.pack(paying.fragments)}
    >
      <div className="flex flex-col gap-3" data-fragment-quote={paying.quote.id}>
        <AppFigure tone="gold" value={FRAGMENTS_PAGE_WORDS.price(paying.fragments)} label={label} />
        <PayWith payer={payer} passkey={passkey} quote={paying.quote} cents={paying.cents} onSent={onSent} />
      </div>
    </AppPanel>
  );
};

const Delivery = ({
  sent,
  next,
  onSettled,
  onAgain,
}: {
  sent: SentPayment;
  next: string | null;
  onSettled: () => void;
  onAgain: () => void;
}) => {
  const navigate = useNavigate();
  const payment = useQuery({
    queryKey: ["fragmentPayment", sent.rail ?? "starknet", sent.hash],
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
      <AppButton kind="primary" size="lg" icon="fragment" onClick={() => (next ? navigate(next) : onAgain())}>
        {FRAGMENTS_PAGE_WORDS.backToShop}
      </AppButton>
    </div>
  );
};

const shopGameOf = (search: string): ShopGameRef | null => {
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
