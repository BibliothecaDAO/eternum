import "./shop-sheet.css";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Account } from "starknet";
import { configManager, readLaborBonus, readSeasonPass } from "@bibliothecadao/eternum";
import { nativeFragmentConstants, questBonusPercent, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { FRAGMENT_CENTS, formatCharge, formatShort, MIN_FRAGMENTS } from "@bibliothecadao/types";
import { useGame } from "@/hooks/context/game-context";
import { notificationOwnerOf, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { allowsWebCheckout } from "@/runtime/distribution-channel";
import { useRedeemSealCode } from "@/shell/play/seal-code";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudField, HudNotice, HudRow, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { failureLine } from "@/ui/design-system/kit/failure-lines";
import { FRAGMENTS_PAGE_WORDS, REALM, SEAL_CODE_WORDS, SHOP_WORDS } from "@/ui/design-system/kit/words";
import { parsePlayRoute } from "@/play/navigation/play-route";
import { returnPathOf } from "@/shell/return-path";
import { fragmentsHref } from "@/shell/shop/fragments-route";
import { SEASON_ONE_REALM_SKINS, SeasonOneSkins } from "@/shell/shop/season-one-skins";
import { toast } from "@/ui/features/event-feed/notify";

import { fragmentsToFill } from "../army/refill";
import { useFragmentsHeld, useFragmentsSold } from "../value/fragments";

const SHOP_MODELS = ["Seal", "QuestRules", "SliceRules", "SettledRealm"] as const;
const PASS_PRICE = nativeFragmentConstants.SEAL_FRAGMENTS;
const POINTS = nativeFragmentConstants.STAMINA_PER_FRAGMENT;
const OATH_REROLL = nativeFragmentConstants.OATH_REROLL_FRAGMENTS;
const PASS_KEY = 0;

export type PassState = { held: true } | { held: false; buying: boolean; onBuy: () => void };

export interface ShopViewProps {
  fragments: number;
  pass: PassState | null;
  questBonus: number | null;
  bonusHeld: string | null;
  bar: number | null;
  code: ReactNode;
  onGetFragments: () => void;
  onClose: () => void;
}

const SHOP_RETURN = "#shop";

export const ShopSheet = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const sold = useFragmentsSold();
  const reading = useShopReading(realm);
  const getFragments = useGetFragments();
  if (!sold) return <ShopClosedView code={<ShopCodeField />} onClose={onClose} />;
  return reading && <ShopView {...reading} code={<ShopCodeField />} onGetFragments={getFragments} onClose={onClose} />;
};

const ShopClosedView = ({ code, onClose }: { code: ReactNode; onClose: () => void }) => (
  <HudSheet label={SHOP_WORDS.title} onClose={onClose}>
    <section data-shop="closed" className="flex flex-col gap-2">
      <HudRow
        lead={<Icon name="fragment" size={32} />}
        title={FRAGMENTS_PAGE_WORDS.closedTitle}
        detail={FRAGMENTS_PAGE_WORDS.closedLine}
      />
      {code}
    </section>
  </HudSheet>
);

export const ShopView = ({
  fragments,
  pass,
  questBonus,
  bonusHeld,
  bar,
  code,
  onGetFragments,
  onClose,
}: ShopViewProps) => {
  const webCheckout = allowsWebCheckout();
  return (
    <HudSheet label={SHOP_WORDS.title} beside={<FragmentsHeld fragments={fragments} />} onClose={onClose}>
      <PassSection pass={pass} fragments={fragments} questBonus={questBonus} bonusHeld={bonusHeld} />
      <HudRow
        lead={<Icon name="fragment" size={32} />}
        title={SHOP_WORDS.fragments(fragments)}
        detail={SHOP_WORDS.fragmentsLine(FRAGMENT_CENTS)}
        controls={
          webCheckout ? (
            <HudButton kind="secondary" icon="fragment" onClick={onGetFragments}>
              {FRAGMENTS_PAGE_WORDS.title}
            </HudButton>
          ) : undefined
        }
      />
      {bar !== null && (
        <HudRow
          lead={<Icon name="stamina" size={32} />}
          title={SHOP_WORDS.stamina}
          detail={
            <span className="flex flex-col gap-0.5">
              <span>
                {SHOP_WORDS.staminaLine(POINTS, bar, fragmentsForBar(bar), fragmentsForBar(bar) * FRAGMENT_CENTS)}
              </span>
              <span>{SHOP_WORDS.oathSwapLine(OATH_REROLL)}</span>
            </span>
          }
        />
      )}
      {pass && !pass.held && code}
    </HudSheet>
  );
};

const PassSection = ({
  pass,
  fragments,
  questBonus,
  bonusHeld,
}: {
  pass: PassState | null;
  fragments: number;
  questBonus: number | null;
  bonusHeld: string | null;
}) => {
  if (pass?.held) {
    return (
      <section data-shop="pass" data-held="" className="shop-sheet-seal">
        <div className="flex items-center justify-between gap-2">
          <HudNotice tone="good" line={SHOP_WORDS.held} />
          <HudChip tone="gold">{SHOP_WORDS.founderBadge}</HudChip>
        </div>
        <div className="shop-sheet-perks">
          {questBonus !== null && (
            <span className="text-hud-label text-hud-good">{SHOP_WORDS.questBonus(questBonus)}</span>
          )}
          <span className="text-hud-label text-hud-muted">
            {SHOP_WORDS.skinsIncluded(SEASON_ONE_REALM_SKINS.length)}
          </span>
        </div>
        <SeasonOneSkins surface="hud" />
      </section>
    );
  }
  return (
    <section data-shop="pass" className="shop-sheet-seal">
      <HudRow
        lead={<Icon name="final-seal" size={44} />}
        title={SHOP_WORDS.pass}
        detail={SHOP_WORDS.passFor}
        trail={<HudChip tone="gold">{SHOP_WORDS.founderBadge}</HudChip>}
      />
      <div className="shop-sheet-perks">
        {questBonus !== null && (
          <span className="text-hud-body text-hud-good">{SHOP_WORDS.questBonus(questBonus)}</span>
        )}
        <span className="text-hud-label text-hud-muted">{SHOP_WORDS.skinsIncluded(SEASON_ONE_REALM_SKINS.length)}</span>
      </div>
      <SeasonOneSkins surface="hud" />
      {bonusHeld !== null && <HudNotice tone="good" line={SHOP_WORDS.bonusHeld(bonusHeld)} />}
      {pass && <PassFoot pass={pass} fragments={fragments} />}
    </section>
  );
};

const PassFoot = ({ pass, fragments }: { pass: Extract<PassState, { held: false }>; fragments: number }) => {
  const more = Math.max(0, PASS_PRICE - fragments);
  return (
    <div className="flex flex-col gap-1">
      <HudButton
        kind="primary"
        icon="fragment"
        disabled={more > 0}
        busy={pass.buying ? SHOP_WORDS.getting : undefined}
        onClick={pass.onBuy}
      >
        {formatCharge(PASS_PRICE)} · {SHOP_WORDS.getPass}
      </HudButton>
      {more > 0 && (
        <span data-shop-short className="text-hud-label text-hud-muted">
          {SHOP_WORDS.short(fragments, purchasable(more), purchasable(more) * FRAGMENT_CENTS)}
        </span>
      )}
    </div>
  );
};

const FragmentsHeld = ({ fragments }: { fragments: number }) => (
  <HudChip icons={["fragment"]} label={SHOP_WORDS.fragments(fragments)}>
    {formatShort(fragments)}
  </HudChip>
);

export const ShopCodeField = () => {
  const owner = useIdentitySessionStore((state) => notificationOwnerOf(state.session));
  const { redeem, refusal } = useRedeemSealCode(owner);
  const [code, setCode] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    redeem.mutate(code);
  };
  return (
    <form data-shop="code" className="flex flex-col gap-1" onSubmit={submit}>
      <span className="text-hud-label text-hud-muted">{SHOP_WORDS.haveCode}</span>
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <HudField
            aria-label={SEAL_CODE_WORDS.label}
            placeholder={SEAL_CODE_WORDS.placeholder}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={code}
            onChange={(typed) => {
              setCode(typed);
              redeem.reset();
            }}
          />
        </span>
        <HudButton
          kind="secondary"
          type="submit"
          disabled={code.trim() === ""}
          busy={redeem.isPending ? SEAL_CODE_WORDS.redeeming : undefined}
        >
          {SEAL_CODE_WORDS.redeem}
        </HudButton>
      </span>
      {refusal && <HudNotice tone="warn" line={SEAL_CODE_WORDS.refused[refusal]} />}
      {redeem.isError && !refusal && (
        <HudNotice tone="bad" line={failureLine("season")} retry={() => redeem.mutate(code)} />
      )}
    </form>
  );
};

export const useReturnToShop = (openShop: () => void) => {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (hash !== SHOP_RETURN) return;
    openShop();
    navigate({ pathname, search }, { replace: true });
  }, [hash, navigate, openShop, pathname, search]);
};

const useGetFragments = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return () => {
    const game = parsePlayRoute(location);
    if (game) navigate(fragmentsHref(game, `${returnPathOf(location)}${SHOP_RETURN}`));
  };
};

function useShopReading(
  realm: NativeRows["Structure"],
): Omit<ShopViewProps, "code" | "onGetFragments" | "onClose"> | null {
  const { setup, account } = useGame();
  useNativeRevision(SHOP_MODELS);
  const fragments = useFragmentsHeld();
  const sending = useInFlight("seal", PASS_KEY) !== undefined;
  const gameId = configManager.getActiveGameId();
  const owner = BigInt(account.account.address);
  const seal = readSeasonPass(setup.store, gameId, owner);
  const quest = setup.store.get("QuestRules", { game_id: gameId });
  const slice = setup.store.get("SliceRules", { game_id: gameId });
  const buy = () =>
    sendOnce("seal", PASS_KEY, true, () =>
      setup.systemCalls.buy_seal({ signer: account.account as unknown as Account }),
    ).catch((error: unknown) => toast.failed(error, SHOP_WORDS.passFailed));
  if (fragments === null) return null;
  return {
    fragments,
    pass: seal.known ? (seal.known.present ? { held: true } : { held: false, buying: sending, onBuy: buy }) : null,
    questBonus: quest ? questBonusPercent(quest) : null,
    bonusHeld: freeBonusHolder(setup.store, realm, owner),
    bar: slice ? slice.troop_stamina_config.stamina_knight_max : null,
  };
}

function freeBonusHolder(
  store: ReturnType<typeof useGame>["setup"]["store"],
  realm: NativeRows["Structure"],
  owner: bigint,
): string | null {
  const source = readLaborBonus(store, realm.game_id, Number(realm.entity_id), owner).known?.source;
  return source === "realm" ? REALM : null;
}

const fragmentsForBar = (bar: number): number => fragmentsToFill({ current: 0, max: bar });

const purchasable = (fragments: number): number => Math.max(fragments, MIN_FRAGMENTS);
