import type * as SystemProps from "@bibliothecadao/eternum";
import { toast } from "sonner";
import { type SetupNetworkResult } from "./setupNetwork";

class PromiseQueue {
  private readonly queue: Array<() => Promise<any>> = [];
  private processing = false;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error("Error processing task:", error);
        }
      }
    }

    this.processing = false;
  }
}

//type SystemCallFunctions = ReturnType<typeof createSystemCalls>;
//type SystemCallFunction = (...args: any[]) => any;
//type WrappedSystemCalls = Record<string, SystemCallFunction>;

/*const withErrorHandling =
  (fn: any) =>
  async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error: any) {
      toast(error.message);
    }
  };*/

export function createSystemCalls({ provider }: SetupNetworkResult) {
  const promiseQueue = new PromiseQueue();

  const withQueueing = <T extends (...args: any[]) => Promise<any>>(fn: T) => {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      return await promiseQueue.enqueue(async () => await fn(...args));
    };
  };

  const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(fn: T) => {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      try {
        const resp = await fn(...args);
        return resp;
      } catch (error: any) {
        let errorMessage = error.message;

        if (error.message.includes("Failure reason:")) {
          const match = error.message.match(/Failure reason: \\"(.*?)"/);
          if (match?.[1]) {
            errorMessage = match[1].slice(0, -1);
          } else {
            const matchOther = error.message.match(/Failure reason: "(.*?)"/);
            if (matchOther?.[1]) {
              errorMessage = matchOther[1].slice(0, -1);
            } else {
              const matchHex = error.message.match(/Failure reason: (0x[0-9a-f]+) \('(.*)'\)/);
              if (matchHex?.[2]) {
                errorMessage = matchHex[2];
              }
            }
          }
        }
        toast(errorMessage);
        throw error;
      }
    };
  };

  const uuid = async () => {
    return await provider.uuid();
  };

  const create_order = async (props: SystemProps.CreateOrderProps) => {
    await provider.create_order(props);
  };

  const accept_order = async (props: SystemProps.AcceptOrderProps) => {
    await provider.accept_order(props);
  };

  const accept_partial_order = async (props: SystemProps.AcceptPartialOrderProps) => {
    await provider.accept_partial_order(props);
  };

  const cancel_order = async (props: SystemProps.CancelOrderProps) => {
    await provider.cancel_order(props);
  };
  const mint_test_realm = async (props: SystemProps.MintTestRealmProps) => {
    await provider.mint_test_realm(props);
  };

  const mint_season_passes = async (props: SystemProps.MintSeasonPassesProps) => {
    await provider.mint_season_passes(props);
  };

  const attach_lords = async (props: SystemProps.AttachLordsProps) => {
    await provider.attach_lords(props);
  };

  const detach_lords = async (props: SystemProps.DetachLordsProps) => {
    await provider.detach_lords(props);
  };

  const mint_test_lords = async (props: SystemProps.MintTestLordsProps) => {
    await provider.mint_test_lords(props);
  };

  const bridge_resources_into_realm = async (props: SystemProps.BridgeResourcesIntoRealmProps) => {
    return await provider.bridge_resources_into_realm(props);
  };

  const bridge_start_withdraw_from_realm = async (props: SystemProps.BridgeStartWithdrawFromRealmProps) => {
    return await provider.bridge_start_withdraw_from_realm(props);
  };

  const bridge_finish_withdraw_from_realm = async (props: SystemProps.BridgeFinishWithdrawFromRealmProps) => {
    return await provider.bridge_finish_withdraw_from_realm(props);
  };

  const isLive = async () => {
    try {
      await provider.uuid();
      return true;
    } catch {
      return false;
    }
  };

  const systemCalls = {
    isLive: withQueueing(withErrorHandling(isLive)),
    create_order: withQueueing(withErrorHandling(create_order)),
    accept_order: withQueueing(withErrorHandling(accept_order)),
    cancel_order: withQueueing(withErrorHandling(cancel_order)),
    accept_partial_order: withQueueing(withErrorHandling(accept_partial_order)),

    uuid: withQueueing(withErrorHandling(uuid)),

    mint_test_realm: withQueueing(withErrorHandling(mint_test_realm)),
    mint_season_passes: withQueueing(withErrorHandling(mint_season_passes)),
    attach_lords: withQueueing(withErrorHandling(attach_lords)),
    detach_lords: withQueueing(withErrorHandling(detach_lords)),
    mint_test_lords: withQueueing(withErrorHandling(mint_test_lords)),
    bridge_resources_into_realm: withQueueing(withErrorHandling(bridge_resources_into_realm)),
    bridge_start_withdraw_from_realm: withQueueing(withErrorHandling(bridge_start_withdraw_from_realm)),
    bridge_finish_withdraw_from_realm: withQueueing(withErrorHandling(bridge_finish_withdraw_from_realm)),
  };

  // TODO: Fix Type
  /*const wrappedSystemCalls = Object.fromEntries(
    Object.entries(systemCalls).map(([key, fn]) => [key, withErrorHandling(fn)]),
  );*/

  return systemCalls;
}
