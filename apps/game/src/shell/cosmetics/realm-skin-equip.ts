import { waitForConfirmedActionReceipt } from "@bibliothecadao/eternum/game-client";
import { DeviceLimitError, DeviceRemovedError } from "@bibliothecadao/eternum";
import type { HeraldPlayerStructure } from "@bibliothecadao/eternum/game-sync";
import { useEffect, useLayoutEffect, useRef } from "react";
import { create } from "zustand";

import { resolveEntryContextFromLandingSelection } from "@/game-entry/context";
import { joinGameplayAccount, markGameplayAccountUnavailable } from "@/hooks/context/gameplay-account-sync";
import { useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { requireOpenShard } from "@/runtime/world/shards";

import { type DirectoryGame, useDirectory } from "../herald";

type EquipRequest = { id: symbol; family: number; sessionId: string } & (
  | { phase: "preparing" | "sending" | "failed" }
  | { phase: "applied"; block?: number; receiptWait?: AbortController }
);

const useEquipRequests = create<Record<string, EquipRequest>>(() => ({}));

function updateEquipRequest(scope: string, id: symbol, request?: EquipRequest) {
  useEquipRequests.setState((state) => {
    if (state[scope]?.id !== id) return state;
    const next = { ...state };
    if (request) next[scope] = request;
    else delete next[scope];
    return next;
  }, true);
}

const signerFor = async (chainId: string, realmsId: string, retrying: boolean) => {
  const { account, owner } = useAccountStore.getState();
  if (!retrying && account && owner === realmsId && BigInt(await account.getChainId()) === BigInt(chainId))
    return account;
  return joinGameplayAccount(await requireOpenShard(chainId), realmsId);
};

export const useRealmSkinEquip = (game: DirectoryGame | null, realm: HeraldPlayerStructure | null) => {
  const { session } = useIdentitySession();
  const directory = useDirectory();
  const active = useRef<{ id: symbol; controller: AbortController } | null>(null);
  const sessionId = session?.session.id;
  const realmsId = session?.user.realmsId;
  const scope = game && realm ? JSON.stringify([game.chainId, game.game_id, realm.entity_id]) : null;
  const pending = useEquipRequests((requests) => (scope ? requests[scope] : undefined));

  useLayoutEffect(() => {
    return () => {
      const previous = active.current;
      active.current = null;
      previous?.controller.abort();
      if (scope) {
        const request = useEquipRequests.getState()[scope];
        if (request?.phase === "preparing" && request.id === previous?.id) updateEquipRequest(scope, request.id);
        if (request?.phase === "failed" && request.sessionId === sessionId) updateEquipRequest(scope, request.id);
      }
    };
  }, [scope, sessionId]);

  const confirmedBlock = directory.data?.confirmedBlock;
  const equipped = realm?.realm_skin;
  useEffect(() => {
    if (!scope || pending?.phase !== "applied") return;
    if (
      equipped === pending.family ||
      (pending.block !== undefined && confirmedBlock !== undefined && confirmedBlock >= pending.block)
    ) {
      pending.receiptWait?.abort();
      updateEquipRequest(scope, pending.id);
    }
  }, [scope, pending, confirmedBlock, equipped]);

  const equip =
    game?.status === "Live" && game.realm_skin_enabled === true && realm && scope && sessionId && realmsId
      ? async (family: number) => {
          const previous = useEquipRequests.getState()[scope];
          if (previous && previous.phase !== "failed") return;
          const id = Symbol();
          const request = { id, family, sessionId, phase: "preparing" } as const;
          const controller = new AbortController();
          active.current = { id, controller };
          const isCurrent = () =>
            active.current?.id === id && useIdentitySessionStore.getState().session?.session.id === sessionId;
          useEquipRequests.setState({ [scope]: request });
          try {
            const [{ submitGameCommand }, signer] = await Promise.all([
              import("@/services/game-command"),
              signerFor(game.chainId, realmsId, previous?.sessionId === sessionId),
            ]);
            if (!isCurrent()) {
              updateEquipRequest(scope, id);
              return;
            }
            const context = resolveEntryContextFromLandingSelection({
              selection: { chainId: game.chainId, gameId: game.game_id },
              intent: "play",
            });
            const { outcome, world, startedAt } = await submitGameCommand(
              context,
              (client) => {
                if (!isCurrent()) throw new Error("The Cosmetics page changed before the skin was equipped");
                useAccountStore.getState().setGameplayAccount(signer, realmsId);
                updateEquipRequest(scope, id, { ...request, phase: "sending" });
                return client.setup.systemCalls.set_realm_skin({ signer, entity_id: realm.entity_id, family });
              },
              { isCurrent, signal: controller.signal },
            );
            const receiptWait = outcome.block === null ? new AbortController() : undefined;
            updateEquipRequest(scope, id, {
              ...request,
              phase: "applied",
              block: outcome.block ?? undefined,
              receiptWait,
            });
            void directory.refetch();
            if (!receiptWait) return;
            const confirmed = await waitForConfirmedActionReceipt(
              signer,
              world,
              outcome.hash,
              receiptWait.signal,
              startedAt,
            ).catch(() => undefined);
            if (confirmed?.status === "SUCCEEDED" && confirmed.block !== null) {
              updateEquipRequest(scope, id, { ...request, phase: "applied", block: confirmed.block });
            } else if (confirmed) {
              updateEquipRequest(scope, id, { ...request, phase: "failed" });
            } else {
              updateEquipRequest(scope, id);
            }
          } catch (error) {
            if (isCurrent() && (error instanceof DeviceRemovedError || error instanceof DeviceLimitError))
              markGameplayAccountUnavailable(error);
            updateEquipRequest(scope, id, { ...request, phase: "failed" });
          }
        }
      : null;
  const sending = pending && pending.phase !== "failed" ? pending.family : null;
  const failed = pending?.phase === "failed" && pending.sessionId === sessionId ? pending.family : null;
  return { equip, sending, failed };
};
