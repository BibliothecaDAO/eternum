import { useState, type FormEvent, type ReactNode } from "react";
import type { Account } from "starknet";
import { configManager, readSeasonPass } from "@bibliothecadao/eternum";
import { nativeFragmentConstants } from "@bibliothecadao/eternum/game-client";
import { FRAGMENT_CENTS, formatCharge, formatShort, MIN_FRAGMENTS } from "@bibliothecadao/types";
import { useGame } from "@/hooks/context/game-context";
import { notificationOwnerOf, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useRedeemSealCode } from "@/shell/play/seal-code";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudField, HudNotice, HudRow, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { failureLine } from "@/ui/design-system/kit/failure-lines";
import { SEAL_CODE_WORDS, SHOP_WORDS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";

import { fragmentsToFill } from "../army/refill";
import { useFragmentsHeld } from "../value/fragments";

const SHOP_MODELS = ["Seal", "QuestRules", "SliceRules"] as const;
const PASS_PRICE = nativeFragmentConstants.SEAL_FRAGMENTS;
const POINTS = nativeFragmentConstants.STAMINA_PER_FRAGMENT;
const PASS_KEY = 0;

export type PassState = { held: true } | { held: false; buying: boolean; onBuy: () => void };

export interface ShopViewProps {
  fragments: number;
  pass: PassState | null;
  questBonus: number | null;
  bar: number | null;
  code: ReactNode;
  onClose: () => void;
}

export const ShopSheet = ({ onClose }: { onClose: () => void }) => {
  const reading = useShopReading();
  return reading && <ShopView {...reading} code={<ShopCodeField />} onClose={onClose} />;
};

export const ShopView = ({ fragments, pass, questBonus, bar, code, onClose }: ShopViewProps) => (
  <HudSheet label={SHOP_WORDS.title} beside={<FragmentsHeld fragments={fragments} />} onClose={onClose}>
    <section data-shop="pass" className="flex flex-col gap-2">
      <HudRow lead={<Icon name="final-seal" size={48} />} title={SHOP_WORDS.pass} detail={SHOP_WORDS.passFor} />
      {questBonus !== null && <span className="text-hud-body text-hud-ink">{SHOP_WORDS.questBonus(questBonus)}</span>}
      {pass && <PassFoot pass={pass} fragments={fragments} />}
      {pass && !pass.held && code}
    </section>
    <HudRow
      lead={<Icon name="fragment" size={32} />}
      title={SHOP_WORDS.fragments(fragments)}
      detail={SHOP_WORDS.fragmentsLine(FRAGMENT_CENTS)}
    />
    {bar !== null && (
      <HudRow
        lead={<Icon name="stamina" size={32} />}
        title={SHOP_WORDS.stamina}
        detail={SHOP_WORDS.staminaLine(POINTS, bar, fragmentsForBar(bar), fragmentsForBar(bar) * FRAGMENT_CENTS)}
      />
    )}
  </HudSheet>
);

const PassFoot = ({ pass, fragments }: { pass: PassState; fragments: number }) => {
  if (pass.held) return <HudNotice tone="good" line={SHOP_WORDS.held} />;
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

function useShopReading(): Omit<ShopViewProps, "code" | "onClose"> | null {
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
    questBonus: quest ? quest.bonus_percent - 100 : null,
    bar: slice ? slice.troop_stamina_config.stamina_knight_max : null,
  };
}

const fragmentsForBar = (bar: number): number => fragmentsToFill({ current: 0, max: bar });

const purchasable = (fragments: number): number => Math.max(fragments, MIN_FRAGMENTS);
