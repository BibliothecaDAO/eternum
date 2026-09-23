import { useState } from "react";

import {
  IDENTITY_POPOVER_ID,
  identityClient,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { NotificationSettings } from "@/ui/modules/settings/notification-settings";
import type { Session } from "@realms-world/identity";

import { DevicesPanel } from "./devices";
import { shortAddress } from "./format";
import { AccountStatePrompt } from "./account-state";
import { displayName, PORTRAITS, portraitUrl } from "./identity-chip";
import { GhostButton, GoldButton, Loading, Panel, PanelTitle } from "./kit";

const NAME_RULES = "3–20 characters · unique across the realms · shown everywhere";

const NameClaim = ({ currentName, onDone }: { currentName: string | null; onDone: () => void }) => {
  const [name, setName] = useState(currentName ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const claim = async () => {
    setPending(true);
    setError(null);
    try {
      await identityClient.updateUser({ name: name.trim() });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The name was not saved.");
    } finally {
      setPending(false);
    }
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void claim();
      }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Choose your name"
          maxLength={20}
          className="w-56 rounded-lg border border-gold/30 bg-black/40 px-3 py-2.5 text-[14px] text-gold outline-none placeholder:text-gold/40 focus:border-gold"
        />
        <GoldButton type="submit" disabled={pending || name.trim().length < 3}>
          {pending ? "Saving…" : currentName ? "Change name" : "Claim name"}
        </GoldButton>
      </div>
      <div className="mt-1.5 text-[11.5px] text-gold/50">{NAME_RULES}</div>
      {error ? <div className="mt-2 text-[12.5px] text-danger">{error}</div> : null}
    </form>
  );
};

const PortraitPicker = ({ current, onDone }: { current: string | null; onDone: () => void }) => {
  const [error, setError] = useState<string | null>(null);
  const choose = async (portrait: string) => {
    setError(null);
    try {
      await identityClient.updateUser({ image: portrait });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The portrait was not saved.");
    }
  };
  return (
    <div>
      <div className="grid grid-cols-6 gap-2">
        {PORTRAITS.map((portrait) => (
          <button
            key={portrait}
            type="button"
            onClick={() => void choose(portrait)}
            aria-pressed={current === portrait}
            className={`rounded border p-0 hover:border-gold ${current === portrait ? "border-gold" : "border-gold/20"}`}
          >
            <img src={portraitUrl(portrait)} alt={`Portrait ${portrait}`} className="block w-full rounded" />
          </button>
        ))}
      </div>
      {error ? <div className="mt-2 text-[12.5px] text-danger">{error}</div> : null}
    </div>
  );
};

const SignedInAccount = ({ session, refresh }: { session: Session; refresh: () => void }) => {
  const [editingPortrait, setEditingPortrait] = useState(false);
  const hasName = displayName(session) !== shortAddress(session.user.id);
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel>
        <PanelTitle>Identity</PanelTitle>
        <div className="mb-3 flex items-start gap-4">
          <img
            src={portraitUrl(session.user.image ?? null)}
            alt=""
            className="h-[72px] w-[72px] rounded-lg border border-gold/40 object-cover"
          />
          <div>
            <div className="font-cinzel text-[22px] font-bold tracking-wide text-gold">
              {hasName ? displayName(session) : "Unnamed lord"}
            </div>
            <button
              type="button"
              onClick={() => setEditingPortrait((value) => !value)}
              className="mt-2 font-mono text-[10.5px] uppercase tracking-wider text-gold underline"
            >
              {editingPortrait ? "Close portraits" : "Change portrait"}
            </button>
          </div>
        </div>
        {editingPortrait ? (
          <div className="mb-3">
            <PortraitPicker
              current={session.user.image ?? null}
              onDone={() => {
                setEditingPortrait(false);
                refresh();
              }}
            />
          </div>
        ) : null}
        {!hasName ? (
          <div className="mb-3 rounded-lg border border-dashed border-gold/50 p-3">
            <p className="mb-2 font-serif text-[15px] italic text-gold/70">Every lord bears a name. Claim yours.</p>
            <NameClaim currentName={null} onDone={refresh} />
          </div>
        ) : null}
        <div className="space-y-2">
          <AccountStatePrompt />
          <div className="flex items-center justify-between gap-2.5 rounded-lg border border-gold/20 bg-black/40 px-3 py-2.5 text-[13px]">
            <span className="text-gold/60">Wallet</span>
            {session.user.address ? (
              <b className="font-mono text-[12px]">{shortAddress(session.user.address)}</b>
            ) : (
              <GhostButton onClick={() => usePopoverStore.getState().open(IDENTITY_POPOVER_ID)}>
                Link a wallet
              </GhostButton>
            )}
          </div>
          {hasName ? (
            <details className="rounded-lg border border-gold/20 bg-black/40 px-3 py-2.5">
              <summary className="cursor-pointer text-[13px] text-gold/60">Change name</summary>
              <div className="pt-2.5">
                <NameClaim currentName={displayName(session)} onDone={refresh} />
              </div>
            </details>
          ) : null}
          <div className="pt-1">
            <GhostButton onClick={() => usePopoverStore.getState().open(IDENTITY_POPOVER_ID)}>Sign out</GhostButton>
          </div>
        </div>
      </Panel>
      <Panel>
        <DevicesPanel realmsId={session.user.realmsId} />
      </Panel>
      <Panel>
        <NotificationSettings />
      </Panel>
    </div>
  );
};

export const AccountPage = () => {
  const { session, status } = useIdentitySession();
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const requestSignIn = useIdentitySessionStore((state) => state.requestSignIn);
  if (status === "loading") return <Loading />;
  if (!session) {
    return (
      <Panel className="max-w-lg">
        <PanelTitle>Your account</PanelTitle>
        <p className="mb-3 text-[13.5px] text-gold/70">
          Create a Realms account with a passkey, or sign in with a Starknet wallet. No password, no email. Then claim
          your name.
        </p>
        <GoldButton onClick={() => requestSignIn({ redirectTo: "/account" })}>Sign in</GoldButton>
      </Panel>
    );
  }
  return <SignedInAccount session={session} refresh={() => void refresh()} />;
};
