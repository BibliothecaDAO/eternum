import { CLOSE, KEEP, PROFILE_WORDS, SIGN_IN_WORDS, WALLET_WORDS } from "@/ui/design-system/kit/words";
import type { IconMeaning } from "@/ui/design-system/icon";
import { nameRuleViolation, type Session } from "@realms-world/identity";
import { type ReactNode, useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  identityClient,
  identityUsername,
  signOutIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { AppButton, AppDialog, AppPanel, AppSetting } from "@/ui/design-system/kit/app-elements";
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
 * Account (spec 11), Settings' first group: the name, the portrait, how the player signs in and the payout wallet, each
 * a row that opens its step in a panel under the rows. Sent to Settings from a page that needs a wallet (`?next=`), it
 * opens on the payout wallet and returns there once one is linked.
 */
export const AccountCard = ({ session }: { session: Session }) => {
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const account = useAccountStore((state) => state.account?.address);
  const payout = payoutAddressOf(session.user);
  const returnTo = walletReturnOf(useLocation().search);
  useReturnOnceLinked(returnTo, payout);
  const [open, setOpen] = useState<Open>(returnTo && !payout ? "payout" : null);
  const close = () => setOpen(null);
  // A row opens its setting, and the same row closes it again.
  const toggle = (row: Exclude<Open, null>) => setOpen(open === row ? null : row);
  const done = () => {
    close();
    void refresh();
  };
  return (
    <div className="flex flex-col gap-4">
      <AppPanel title={PROFILE_WORDS.account} icon="person" flush>
        <AppSetting
          icon="person"
          name={PROFILE_WORDS.name}
          value={account ? <PlayerName account={account} /> : (identityUsername(session) ?? "—")}
          onClick={() => toggle("name")}
        />
        <AppSetting icon="edit" name={PROFILE_WORDS.portrait} onClick={() => toggle("portrait")} />
        <AppSetting icon="lock" name={PROFILE_WORDS.signInMethods} value={<SignInMethods session={session} />} />
        <AppSetting
          icon="backpack"
          name={WALLET_WORDS.payoutWallet}
          value={payout ? shortAddress(payout) : PROFILE_WORDS.linkWallet}
          onClick={() => toggle("payout")}
        />
      </AppPanel>
      {open === "payout" && (
        <Opened label={WALLET_WORDS.payoutWallet} icon="backpack" onClose={close}>
          <PayoutWalletPanel wallet={payout} email={session.user.email} onChanged={() => void refresh()} />
        </Opened>
      )}
      {open === "name" && (
        <Opened label={PROFILE_WORDS.name} icon="person" onClose={close}>
          <NameSheet current={identityUsername(session) ?? session.user.suggestedName ?? ""} onDone={done} />
        </Opened>
      )}
      {open === "portrait" && (
        <Opened label={PROFILE_WORDS.portrait} icon="edit" onClose={close}>
          <PortraitSheet current={session.user.image ?? null} onDone={done} />
        </Opened>
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

/**
 * What a row opens: a panel under the rows, in the column it opened from, so nothing covers the rows or the page;
 * brought into view as it opens, with Close at its head.
 */
const Opened = ({
  label,
  icon,
  onClose,
  children,
}: {
  label: string;
  icon: IconMeaning;
  onClose: () => void;
  children: ReactNode;
}) => {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView({ block: "nearest" });
  }, []);
  return (
    <div ref={panel} role="region" aria-label={label}>
      <AppPanel
        title={label}
        icon={icon}
        cue={
          <AppButton kind="quiet" icon="close" onClick={onClose}>
            {CLOSE}
          </AppButton>
        }
      >
        {children}
      </AppPanel>
    </div>
  );
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
  return (
    <form onSubmit={(event) => void claim(event)} className="flex flex-col gap-3 py-2">
      <NameField
        name={name}
        onName={(value) => {
          setError(null);
          setName(value);
        }}
      />
      <FailureLine line={error} />
      <AppButton
        kind="primary"
        type="submit"
        icon="check"
        disabled={!valid || !changed}
        busy={saving ? SIGN_IN_WORDS.saving : undefined}
      >
        {SIGN_IN_WORDS.claimName}
      </AppButton>
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
