import { nameRuleViolation, type Session } from "@realms-world/identity";
import { type ReactNode, useEffect, useState, type FormEvent } from "react";

import {
  identityClient,
  identityUsername,
  signOutIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { Button } from "@/ui/design-system/kit/button";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { failureSentence, nameRefusal } from "@/ui/modules/identity/identity-failures";
import { shortAddress } from "@/ui/design-system/kit/address";
import { formatMoment } from "@/ui/design-system/kit/time";

import { useLayout } from "../frame/layout";
import { FailureLine } from "../sign-in/failure-line";
import { NameField, PortraitGrid } from "../sign-in/fields";
import { PROFILE_WORDS, SIGN_IN_WORDS, WALLET_WORDS } from "../words";
import { Confirm } from "./confirm";
import type { PayoutWallet } from "@realms-world/identity";
import { payoutWalletOf } from "@/hooks/context/payout-wallet";
import { PayoutWalletPanel } from "./payout-wallet-panel";
import { SettingRow, SettingRows } from "./setting-row";

type Open = "name" | "portrait" | "payout" | "sign-out" | null;

/**
 * Account (spec 11): the name, the portrait, how the player signs in and the payout wallet, each a row that opens its
 * sheet; Sign out last, outline, asking first. The payout wallet opens beside the rows on desktop.
 */
export const AccountCard = ({ session }: { session: Session }) => {
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const account = useAccountStore((state) => state.account?.address);
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  // A row opens its setting, and the same row closes it again.
  const toggle = (row: Exclude<Open, null>) => setOpen(open === row ? null : row);
  const done = () => {
    close();
    void refresh();
  };
  const payout = payoutWalletOf(session.user);
  // Every wallet change needs the emailed code the payout panel asks for; a session that cannot say which wallet
  // pays is an identity fault, shown as one, never an older uncoded path.
  const payoutMissing = payout === null;
  useEffect(() => {
    if (payoutMissing) console.error("identity_payout_wallet_missing", { user: session.user.id });
  }, [payoutMissing, session.user.id]);
  return (
    <div className="flex flex-col gap-4">
      <SettingRows>
        <SettingRow
          icon="Pf"
          name={PROFILE_WORDS.name}
          value={account ? <PlayerName account={account} /> : (identityUsername(session) ?? "—")}
          onOpen={() => toggle("name")}
        />
        <SettingRow icon="Ed" name={PROFILE_WORDS.portrait} onOpen={() => toggle("portrait")} />
        <SettingRow icon="Dc" name={PROFILE_WORDS.signInMethods} value={<SignInMethods session={session} />} />
        <SettingRow
          icon="Wt"
          name={WALLET_WORDS.payoutWallet}
          value={payout ? payoutValue(payout) : WALLET_WORDS.unavailable}
          onOpen={() => toggle("payout")}
        />
      </SettingRows>
      {open === "payout" && (
        <Opened label={WALLET_WORDS.payoutWallet} onClose={close}>
          {payout ? (
            <PayoutWalletPanel wallet={payout} email={session.user.email} onChanged={() => void refresh()} />
          ) : (
            <FailureLine line={WALLET_WORDS.unavailableLine} />
          )}
        </Opened>
      )}
      {open === "name" && (
        <Opened label={PROFILE_WORDS.name} onClose={close}>
          <NameSheet current={identityUsername(session) ?? session.user.suggestedName ?? ""} onDone={done} />
        </Opened>
      )}
      {open === "portrait" && (
        <Opened label={PROFILE_WORDS.portrait} onClose={close}>
          <PortraitSheet current={session.user.image ?? null} onDone={done} />
        </Opened>
      )}
      <Button role="outline" word={PROFILE_WORDS.signOut} icon="Xo" onClick={() => setOpen("sign-out")} />
      {open === "sign-out" && (
        <Confirm
          question={PROFILE_WORDS.signOutAsk}
          cost={PROFILE_WORDS.signOutCost}
          verb={PROFILE_WORDS.signOut}
          onKeep={close}
          onConfirm={() => void signOutIdentitySession().catch(reportSignOutFailure)}
        />
      )}
    </div>
  );
};

/**
 * What a row opens: a sheet on a phone; on a desktop a plate under the rows, in the Account column it opened from, so
 * nothing covers the rows or the page.
 */
const Opened = ({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) =>
  useLayout() === "phone" ? (
    <Sheet label={label} onClose={onClose}>
      {children}
    </Sheet>
  ) : (
    <section aria-label={label} className="plate p-5">
      {children}
    </section>
  );

/** The payout wallet's row: link one, the time a held wallet receives from, or its address. */
const payoutValue = (payout: PayoutWallet) => {
  if (payout.status === "no_wallet") return PROFILE_WORDS.linkWallet;
  if (payout.status === "on_hold") return `${WALLET_WORDS.receivesFrom} ${formatMoment(payout.until / 1000)}`;
  return shortAddress(payout.address);
};

/** How the player signs in: Discord, an email code, or both, as the identity service lists them. */
const SignInMethods = ({ session }: { session: Session }) => {
  const [providers, setProviders] = useState<string[] | null>(null);
  useEffect(() => {
    let active = true;
    identityClient.listSignInProviders().then(
      (listed) => active && setProviders(listed),
      (cause: unknown) => {
        console.error("identity_sign_in_methods_failed", cause);
        if (active) setProviders([]);
      },
    );
    return () => {
      active = false;
    };
  }, [session.user.id]);
  if (providers === null) return "—";
  const methods = [
    ...(providers.includes("discord") ? [PROFILE_WORDS.discord] : []),
    ...(session.user.emailVerified ? [PROFILE_WORDS.email] : []),
  ];
  return methods.join(" · ") || "—";
};

const NameSheet = ({ current, onDone }: { current: string; onDone: () => void }) => {
  const [name, setName] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = nameRuleViolation(name.trim()) === null;
  const claim = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await identityClient.updateUser({ name: name.trim() });
      onDone();
    } catch (cause) {
      setError(nameRefusal(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={(event) => void claim(event)} className="flex flex-col gap-3 py-2">
      <NameField
        name={name}
        valid={valid}
        onName={(value) => {
          setError(null);
          setName(value);
        }}
      />
      <FailureLine line={error} />
      <Button
        role="primary"
        type="submit"
        word={SIGN_IN_WORDS.claimName}
        icon="Ok"
        disabled={!valid}
        loading={saving ? SIGN_IN_WORDS.saving : undefined}
      />
    </form>
  );
};

const PortraitSheet = ({ current, onDone }: { current: string | null; onDone: () => void }) => {
  const [error, setError] = useState<string | null>(null);
  const choose = async (portrait: string) => {
    setError(null);
    try {
      await identityClient.updateUser({ image: portrait });
      onDone();
    } catch (cause) {
      setError(failureSentence("portrait", cause));
    }
  };
  return (
    <div className="flex flex-col gap-3 py-2">
      <PortraitGrid chosen={current ?? ""} onChoose={(portrait) => void choose(portrait)} />
      <FailureLine line={error} />
    </div>
  );
};

const reportSignOutFailure = (cause: unknown) =>
  console.error("identity_sign_out_failed", { error: cause instanceof Error ? cause.message : cause });
