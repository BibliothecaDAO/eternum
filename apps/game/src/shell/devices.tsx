import { useCallback, useEffect, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { listOpenShards, openKnownShards } from "@/runtime/world/shards";
import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";
import { connectRealmsAccount, getOrCreateDeviceKey, listDevices, revokeDevice } from "@bibliothecadao/eternum";
import { realmsAccountAddress } from "@realms-world/identity/account";
import type { Shard } from "@bibliothecadao/eternum/shard";

import { shortAddress } from "./format";
import { GhostButton, PanelTitle } from "./kit";

/** One device key and the shards where it signs for the player's account. */
interface Device {
  key: string;
  shards: Shard[];
}

/** The account's devices across every shard this client knows, read from each shard's device events. */
async function readDevices(realmsId: string): Promise<Device[]> {
  await openKnownShards();
  const devices = new Map<string, Device>();
  for (const shard of listOpenShards()) {
    const address = realmsAccountAddress(realmsId, shard.accountClassHash, shard.guardianPublicKey);
    for (const key of await listDevices(getCachedRpcProvider(shard.rpcUrl), address)) {
      const device = devices.get(key) ?? { key, shards: [] };
      device.shards.push(shard);
      devices.set(key, device);
    }
  }
  return [...devices.values()];
}

/** Revokes a device on every shard where it signs, each with that shard's own guardian approval and counter. */
async function revokeEverywhere(realmsId: string, device: Device): Promise<void> {
  const signer = getOrCreateDeviceKey(localStorage);
  for (const shard of device.shards) {
    await revokeDevice({
      account: connectRealmsAccount(getCachedRpcProvider(shard.rpcUrl), shard, realmsId, signer),
      shard,
      deviceKey: device.key,
      approve: identityClient.approveDeviceChange,
    });
  }
}

export const DevicesPanel = ({ realmsId }: { realmsId: string }) => {
  const thisDevice = getOrCreateDeviceKey(localStorage).publicKey;
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    readDevices(realmsId).then(setDevices, (cause: unknown) =>
      setError(cause instanceof Error ? cause.message : "Devices could not be read."),
    );
  }, [realmsId]);
  useEffect(load, [load]);

  const revoke = async (device: Device) => {
    setPending(device.key);
    setError(null);
    try {
      await revokeEverywhere(realmsId, device);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The device was not removed.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div>
      <PanelTitle>Devices</PanelTitle>
      {devices === null && !error ? <div className="text-[13px] text-gold/60">Reading devices…</div> : null}
      <div className="space-y-2">
        {devices?.map((device) => (
          <div
            key={device.key}
            className="flex items-center justify-between gap-2.5 rounded-lg border border-gold/20 bg-black/40 px-3 py-2.5 text-[13px]"
          >
            <span className="font-mono text-[12px]">
              {shortAddress(device.key)}
              {BigInt(device.key) === BigInt(thisDevice) ? (
                <span className="ml-2 text-gold/60">this device</span>
              ) : null}
            </span>
            {BigInt(device.key) === BigInt(thisDevice) ? null : (
              <GhostButton disabled={pending !== null} onClick={() => void revoke(device)}>
                {pending === device.key ? "Removing…" : "Remove"}
              </GhostButton>
            )}
          </div>
        ))}
      </div>
      {error ? <div className="mt-2 text-[12.5px] text-danger">{error}</div> : null}
    </div>
  );
};
