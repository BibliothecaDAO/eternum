import { DojoProvider } from "@dojoengine/core";
import EventEmitter from "eventemitter3";
import { Account, AccountInterface, AllowArray, Call, num } from "starknet";

interface SystemSigner {
  signer: AccountInterface | Account;
}

interface SetResourceBridgeWhitelistConfigProps extends SystemSigner {
  resource_whitelist_configs: ResourceWhitelistConfig[];
}

export interface ResourceWhitelistConfig {
  token: num.BigNumberish;
  resource_type: num.BigNumberish;
}

export const NAMESPACE = "eternum";

export const getContractByName = (manifest: any, name: string) => {
  const contract = manifest.contracts.find((contract: any) => contract.tag === name);
  if (!contract) {
    throw new Error(`Contract ${name} not found in manifest`);
  }
  return contract.address;
};

function ApplyEventEmitter<T extends new (...args: any[]) => {}>(Base: T) {
  return class extends Base {
    eventEmitter = new EventEmitter();

    emit(event: string, ...args: any[]) {
      this.eventEmitter.emit(event, ...args);
    }

    on(event: string, listener: (...args: any[]) => void) {
      this.eventEmitter.on(event, listener);
    }

    off(event: string, listener: (...args: any[]) => void) {
      this.eventEmitter.off(event, listener);
    }
  };
}
const EnhancedDojoProvider = ApplyEventEmitter(DojoProvider);

export class EternumProvider extends EnhancedDojoProvider {
  constructor(katana: any, url?: string) {
    super(katana, url);
    this.manifest = katana;

    this.getWorldAddress = function () {
      const worldAddress = this.manifest.world.address;
      return worldAddress;
    };
  }

  private async executeAndCheckTransaction(signer: Account | AccountInterface, transactionDetails: AllowArray<Call>) {
    if (typeof window !== "undefined") {
      console.log({ signer, transactionDetails });
    }
    const tx = await this.execute(signer, transactionDetails, NAMESPACE);
    const transactionResult = await this.waitForTransactionWithCheck(tx.transaction_hash);

    this.emit("transactionComplete", transactionResult);

    return transactionResult;
  }

  // Wrapper function to check for transaction errors
  async waitForTransactionWithCheck(transactionHash: string) {
    let receipt;
    try {
      receipt = await this.provider.waitForTransaction(transactionHash, {
        retryInterval: 500,
      });
    } catch (error) {
      console.error(`Error waiting for transaction ${transactionHash}`);
      throw error;
    }

    // Check if the transaction was reverted and throw an error if it was
    if (receipt.isReverted()) {
      this.emit("transactionFailed", `Transaction failed with reason: ${receipt.revert_reason}`);
      throw new Error(`Transaction failed with reason: ${receipt.revert_reason}`);
    }

    return receipt;
  }


  public async set_resource_bridge_whitlelist_config(props: SetResourceBridgeWhitelistConfigProps) {
    const { resource_whitelist_configs, signer } = props;

    const calldata = resource_whitelist_configs.map(({ token, resource_type }) => ({
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_resource_bridge_whitelist_config",
      calldata: [token, resource_type],
    }));

    return await this.executeAndCheckTransaction(signer, calldata);


    
    


  }

}
