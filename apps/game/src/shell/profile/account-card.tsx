import { nameRuleViolation, type Session } from "@realms-world/identity";
import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";

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

import { Loading } from "../loading";
import { FailureLine } from "../sign-in/failure-line";
import { NameField, PortraitGrid } from "../sign-in/fields";
import { PROFILE_WORDS, SIGN_IN_WORDS } from "../words";
import { Confirm } from "./confirm";
import { SettingRow, SettingRows } from "./setting-row";

const WalletLink = lazy(() =>
  import("@/ui/modules/identity/wallet-actions").then((module) => ({ default: module.WalletLink })),
);

type Open = "name" | "portrait" | "wallet" | "unlink" | "sign-out" | null;

/**
 * Account (spec 11): the name, the portrait, how the player signs in and the linked wallet, each a row that opens its
 * sheet; Sign out last, outline, asking first.
 */
export const AccountCard = ({ session }: { session: Session }) => {
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const account = useAccountStore((state) => state.account?.address);
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const done = () => {
    close();
    void refresh();
  };
  const wallet = session.user.address ?? null;
  return (
    <div className="flex flex-col gap-4">
      <SettingRows>
        <SettingRow
          icon="Pf"
          name={PROFILE_WORDS.name}
          value={account ? <PlayerName account={account} /> : (identityUsername(session) ?? "—")}
          onOpen={() => setOpen("name")}
        />
        <SettingRow icon="Ed" name={PROFILE_WORDS.portrait} onOpen={() => setOpen("portrait")} />
        <SettingRow icon="Dc" name={PROFILE_WORDS.signInMethods} value={<SignInMethods session={session} />} />
        <SettingRow
          icon="Wt"
          name={PROFILE_WORDS.wallet}
          value={wallet ? shortAddress(wallet) : PROFILE_WORDS.linkWallet}
          onOpen={() => setOpen(wallet ? "unlink" : "wallet")}
        />
      </SettingRows>
      <Button role="outline" word={PROFILE_WORDS.signOut} icon="Xo" onClick={() => setOpen("sign-out")} />
      {open === "name" && (
        <Sheet label={PROFILE_WORDS.name} onClose={close}>
          <NameSheet current={identityUsername(session) ?? session.user.suggestedName ?? ""} onDone={done} />
        </Sheet>
      )}
      {open === "portrait" && (
        <Sheet label={PROFILE_WORDS.portrait} onClose={close}>
          <PortraitSheet current={session.user.image ?? null} onDone={done} />
        </Sheet>
      )}
      {open === "wallet" && (
        <Sheet label={PROFILE_WORDS.linkWallet} onClose={close}>
          <Suspense fallback={<Loading />}>
            <WalletLink />
          </Suspense>
        </Sheet>
      )}
      {open === "unlink" && <UnlinkConfirm onDone={done} onKeep={close} />}
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

/** Unlinking asks first; a refusal is the identity failure's one line. */
const UnlinkConfirm = ({ onDone, onKeep }: { onDone: () => void; onKeep: () => void }) => {
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlink = async () => {
    setUnlinking(true);
    setError(null);
    try {
      await identityClient.unlinkWallet();
      onDone();
    } catch (cause) {
      setError(failureSentence("unlink", cause));
    } finally {
      setUnlinking(false);
    }
  };
  return (
    <Confirm
      question={PROFILE_WORDS.unlinkAsk}
      cost={error ?? PROFILE_WORDS.unlinkCost}
      verb={PROFILE_WORDS.unlink}
      doing={unlinking ? PROFILE_WORDS.unlinking : undefined}
      onKeep={onKeep}
      onConfirm={() => void unlink()}
    />
  );
};

const reportSignOutFailure = (cause: unknown) =>
  console.error("identity_sign_out_failed", { error: cause instanceof Error ? cause.message : cause });
