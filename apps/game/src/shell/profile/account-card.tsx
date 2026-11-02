import { KEEP, PROFILE_WORDS, SIGN_IN_WORDS, WALLET_WORDS } from "@/ui/design-system/kit/words";
import { nameRuleViolation, type Session } from "@realms-world/identity";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  identityClient,
  identityUsername,
  signOutIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { AppButton, AppDialog, AppPanel, AppSetting } from "@/ui/design-system/kit/app-elements";
import { Icon } from "@/ui/design-system/icon";
import { useLayout } from "../frame/layout";
import { ShellWindow } from "../frame/shell-window";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { failureSentence, nameRefusal } from "@/ui/modules/identity/identity-failures";
import { shortAddress } from "@/ui/design-system/kit/address";

import { FailureLine } from "../sign-in/failure-line";
import { NameField, PortraitGrid } from "../sign-in/fields";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { walletReturnOf } from "./settings-route";
import { PayoutWalletPanel } from "./payout-wallet-panel";

type Open = "name" | "portrait" | "payout" | null;

/**
 * Account (spec 11), Settings' first group: the name, the portrait, how the player signs in and the payout wallet. The
 * name is edited in its own row; the portrait and the payout wallet open in the app's one sheet (ShellWindow), so the
 * page never moves and has no Back (the owner's pick A, 2 November 2026). Sent to Settings from a page that needs a
 * wallet (`?next=`), it opens on the payout wallet and returns there once one is linked.
 */
export const AccountCard = ({ session }: { session: Session }) => {
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const account = useAccountStore((state) => state.account?.address);
  const payout = payoutAddressOf(session.user);
  const returnTo = walletReturnOf(useLocation().search);
  useReturnOnceLinked(returnTo, payout);
  const [open, setOpen] = useState<Open>(returnTo && !payout ? "payout" : null);
  const close = () => setOpen(null);
  const done = () => {
    close();
    void refresh();
  };
  return (
    <div className="flex flex-col gap-4">
      <AppPanel title={PROFILE_WORDS.account} icon="person" flush>
        {open === "name" ? (
          <NameRow
            current={identityUsername(session) ?? session.user.suggestedName ?? ""}
            onDone={done}
            onCancel={close}
          />
        ) : (
          <AppSetting
            icon="person"
            name={PROFILE_WORDS.name}
            value={account ? <PlayerName account={account} /> : (identityUsername(session) ?? "—")}
            onClick={() => setOpen("name")}
          />
        )}
        <AppSetting icon="edit" name={PROFILE_WORDS.portrait} onClick={() => setOpen("portrait")} />
        <AppSetting icon="lock" name={PROFILE_WORDS.signInMethods} value={<SignInMethods session={session} />} />
        <AppSetting
          icon="backpack"
          name={WALLET_WORDS.payoutWallet}
          value={payout ? shortAddress(payout) : PROFILE_WORDS.linkWallet}
          onClick={() => setOpen("payout")}
        />
      </AppPanel>
      {open === "payout" && (
        <ShellWindow title={WALLET_WORDS.payoutWallet} onClose={close}>
          <PayoutWalletPanel wallet={payout} email={session.user.email} onChanged={() => void refresh()} />
        </ShellWindow>
      )}
      {open === "portrait" && (
        <ShellWindow title={PROFILE_WORDS.portrait} onClose={close}>
          <PortraitSheet current={session.user.image ?? null} onDone={done} />
        </ShellWindow>
      )}
    </div>
  );
};

/** Sign out, Settings' last step: a loss, so in the bad tone, asking first. */
export const SignOut = () => {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <AppButton kind="secondary" tone="bad" icon="exit" onClick={() => setAsking(true)}>
        {PROFILE_WORDS.signOut}
      </AppButton>
      {asking && (
        <AppDialog
          title={PROFILE_WORDS.signOutAsk}
          onClose={() => setAsking(false)}
          actions={
            <>
              <AppButton kind="quiet" onClick={() => setAsking(false)}>
                {KEEP}
              </AppButton>
              <AppButton
                kind="secondary"
                tone="bad"
                onClick={() => void signOutIdentitySession().catch(reportSignOutFailure)}
              >
                {PROFILE_WORDS.signOut}
              </AppButton>
            </>
          }
        >
          {PROFILE_WORDS.signOutCost}
        </AppDialog>
      )}
    </>
  );
};

/** Back to the page that sent the player here once a wallet is linked; a wallet already linked on arrival stays put. */
const useReturnOnceLinked = (returnTo: string | null, payout: string | null) => {
  const navigate = useNavigate();
  const [linkedOnArrival] = useState(payout !== null);
  useEffect(() => {
    if (returnTo && payout && !linkedOnArrival) navigate(returnTo, { replace: true });
  }, [linkedOnArrival, navigate, payout, returnTo]);
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

/**
 * The name edited in its own row: the field in the name's place, Claim name at its end; Enter claims, Escape puts the
 * row back as it was.
 */
const NameRow = ({ current, onDone, onCancel }: { current: string; onDone: () => void; onCancel: () => void }) => {
  const phone = useLayout() === "phone";
  const [name, setName] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = nameRuleViolation(name.trim()) === null;
  // Nothing to claim until the name changes: the one held is already the player's (qa-app-1 P3-6).
  const changed = name.trim() !== current;
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
  const claimButton = (
    <AppButton
      kind="primary"
      type="submit"
      icon="check"
      disabled={!valid || !changed}
      busy={saving ? SIGN_IN_WORDS.saving : undefined}
    >
      {SIGN_IN_WORDS.claimName}
    </AppButton>
  );
  // A phone's row is too narrow for the field and the verb side by side: the verb stands under the field.
  return (
    <form
      onSubmit={(event) => void claim(event)}
      onKeyDown={(event) => event.key === "Escape" && onCancel()}
      className="app-row items-start"
      data-own
    >
      <span className="app-row__lead pt-7">
        <Icon name="person" size={26} />
      </span>
      <span className="app-row__words gap-2">
        <NameField
          name={name}
          onName={(value) => {
            setError(null);
            setName(value);
          }}
        />
        <FailureLine line={error} />
        {phone && claimButton}
      </span>
      {!phone && <span className="app-row__trail pt-6">{claimButton}</span>}
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
