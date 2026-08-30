import { useState } from "react";
import { Effect } from "effect";

import { HeraldClient } from "@/services/herald";
import { IdentityApi } from "@/services/identity";
import { MmrClient, mmrTier, mmrToInteger } from "@/services/mmr";
import { portraitUrl, shortAddress } from "@/ui/format";
import { useMutation, useQuery } from "@/ui/hooks";
import { describeError, ErrorPanel, Flavor, GhostButton, GoldButton, Loading, Panel, PanelTitle } from "@/ui/kit";
import { matchHistory } from "@/ui/match-history";
import { MatchList } from "@/ui/match-list";
import { useSession } from "@/ui/session";

const PORTRAITS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

function NameClaim({ currentName, onDone }: { currentName: string | null; onDone: () => void }) {
  const [name, setName] = useState(currentName ?? "");
  const claim = useMutation((value: string) => Effect.flatMap(IdentityApi, (identity) => identity.claimName(value)));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Choose your name"
          maxLength={20}
          className="cut-sm w-56 border border-line bg-inset px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-amber-deep"
        />
        <GoldButton
          disabled={claim.state.kind === "pending" || name.trim().length < 3}
          onClick={() => void claim.run(name.trim()).then(() => onDone())}
        >
          {claim.state.kind === "pending" ? "Claiming…" : currentName ? "Change name" : "Claim name"}
        </GoldButton>
      </div>
      <div className="mt-1.5 text-[11.5px] text-faint">
        3–20 characters · unique across the realms · shown everywhere
      </div>
      {claim.state.kind === "error" && (
        <div className="mt-2 text-[12.5px] text-coral">{describeError(claim.state.error)}</div>
      )}
    </div>
  );
}

function PortraitPicker({ current, onDone }: { current: string | null; onDone: () => void }) {
  const set = useMutation((portrait: string) =>
    Effect.flatMap(IdentityApi, (identity) => identity.setPortrait(portrait)),
  );
  return (
    <div>
      <div className="grid grid-cols-6 gap-2">
        {PORTRAITS.map((portrait) => (
          <button
            key={portrait}
            type="button"
            onClick={() => void set.run(portrait).then(() => onDone())}
            className={`cut-sm border object-cover p-0 hover:border-amber-hot ${current === portrait ? "border-amber-hot" : "border-line"}`}
          >
            <img src={portraitUrl(portrait)} alt={`Portrait ${portrait}`} className="block w-full" />
          </button>
        ))}
      </div>
      {set.state.kind === "error" && (
        <div className="mt-2 text-[12.5px] text-coral">{describeError(set.state.error)}</div>
      )}
    </div>
  );
}

function BindingStatus() {
  const binding = useQuery(() => Effect.flatMap(IdentityApi, (identity) => identity.gameplayBinding), []);
  const label =
    binding.kind === "loading"
      ? "…"
      : binding.kind === "error"
        ? "unreachable"
        : binding.value
          ? "● Bound"
          : "○ Not bound yet";
  const tone = binding.kind === "ok" && binding.value ? "text-sage" : "text-muted";
  return (
    <div className="flex items-center justify-between gap-2.5 border border-line-soft bg-inset px-3 py-2.5 text-[13px]">
      <span className="text-muted">Game account</span>
      <b className={tone} title={binding.kind === "ok" && binding.value ? binding.value : undefined}>
        {label}
      </b>
    </div>
  );
}

function SignedInProfile({ address }: { address: string }) {
  const { session, refresh } = useSession();
  const [editingPortrait, setEditingPortrait] = useState(false);
  const signOut = useMutation(() => Effect.flatMap(IdentityApi, (identity) => identity.signOut));

  const rating = useQuery(() => Effect.flatMap(MmrClient, (mmr) => mmr.rating(address)), [address]);
  const directory = useQuery(() => Effect.flatMap(HeraldClient, (herald) => herald.directory), []);
  const history = useQuery(
    () => (directory.kind === "ok" ? matchHistory(address, directory.value.games, 12) : Effect.succeed([])),
    [address, directory.kind],
  );

  if (!session) return null;
  const mmr = rating.kind === "ok" ? mmrToInteger(rating.value) : null;
  const tier = mmr !== null ? mmrTier(mmr) : null;

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <Panel>
        <PanelTitle>Identity</PanelTitle>
        <div className="mb-3 flex items-start gap-4">
          <img
            src={portraitUrl(session.portrait)}
            alt=""
            className="cut h-[72px] w-[72px] border border-amber-deep object-cover"
          />
          <div>
            <div className="font-display text-[24px] tracking-[0.05em]">
              {session.hasChosenName ? session.name : "Unnamed lord"}
            </div>
            {tier && mmr !== null && (
              <div className={`mt-1 font-heading text-[12px] font-semibold uppercase tracking-[0.1em] ${tier.color}`}>
                {tier.name} · <span className="font-mono tabular-nums">{mmr.toLocaleString("en-US")}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setEditingPortrait((value) => !value)}
              className="mt-2 font-mono text-[10.5px] uppercase tracking-wider text-amber-hot underline"
            >
              {editingPortrait ? "Close portraits" : "Change portrait"}
            </button>
          </div>
        </div>
        {editingPortrait && (
          <div className="mb-3">
            <PortraitPicker
              current={session.portrait}
              onDone={() => {
                setEditingPortrait(false);
                refresh();
              }}
            />
          </div>
        )}
        {!session.hasChosenName && (
          <div className="mb-3 border border-dashed border-amber-deep bg-amber/5 p-3">
            <div className="mb-2">
              <Flavor>Every lord bears a name. Claim yours.</Flavor>
            </div>
            <NameClaim currentName={null} onDone={refresh} />
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2.5 border border-line-soft bg-inset px-3 py-2.5 text-[13px]">
            <span className="text-muted">Wallet</span>
            <b className="font-mono text-[12px]">{shortAddress(address)}</b>
          </div>
          <div className="flex items-center justify-between gap-2.5 border border-line-soft bg-inset px-3 py-2.5 text-[13px]">
            <span className="text-muted">Session</span>
            <b className="text-sage">● Signed in</b>
          </div>
          <BindingStatus />
          {session.hasChosenName && (
            <details className="border border-line-soft bg-inset px-3 py-2.5">
              <summary className="cursor-pointer text-[13px] text-muted">Change name</summary>
              <div className="pt-2.5">
                <NameClaim currentName={session.name} onDone={refresh} />
              </div>
            </details>
          )}
          <div className="pt-1">
            <GhostButton onClick={() => void signOut.run().then(() => refresh())}>Sign out</GhostButton>
          </div>
        </div>
      </Panel>
      <Panel>
        <PanelTitle>Match history</PanelTitle>
        {(directory.kind === "loading" || history.kind === "loading") && <Loading />}
        {directory.kind === "error" && <ErrorPanel error={directory.error} retry={directory.refresh} />}
        {history.kind === "error" && <ErrorPanel error={history.error} retry={history.refresh} />}
        {history.kind === "ok" && directory.kind === "ok" && (
          <MatchList rows={history.value} empty="No finished games yet." />
        )}
      </Panel>
    </div>
  );
}

export function ProfileScreen() {
  const { session } = useSession();
  if (session === undefined) return <Loading />;
  if (!session) {
    return (
      <Panel className="max-w-lg">
        <PanelTitle>Your account</PanelTitle>
        <p className="text-[13.5px] text-muted">
          Connect a Starknet wallet with <b className="text-parchment">Enter the Realms</b> in the top bar. One
          signature signs you in — no password, no email. Then claim your name.
        </p>
      </Panel>
    );
  }
  return <SignedInProfile address={session.address} />;
}
