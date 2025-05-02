import { lordsAddress, marketplaceAddress, seasonPassAddress } from "@/config";
import { LordsAbi, SeasonPassAbi } from "@bibliothecadao/eternum";
import {
  AcceptMarketplaceOrderProps,
  CancelMarketplaceOrderProps,
  CreateMarketplaceOrderProps,
  EditMarketplaceOrderProps,
} from "@bibliothecadao/types";
import { useAccount, useContract, useReadContract, useSendTransaction } from "@starknet-react/core";
import { useState } from "react";
import { AccountInterface } from "starknet";
import { useDojo } from "./context/dojo-context";

// Define the parameters needed for each function, excluding the signer which is handled internally.
type ListItemParams = Omit<CreateMarketplaceOrderProps, "signer" | "marketplace_address">;
type AcceptOrderParams = Omit<AcceptMarketplaceOrderProps, "signer" | "marketplace_address">;
type CancelOrderParams = Omit<CancelMarketplaceOrderProps, "signer" | "marketplace_address">;
type EditOrderParams = Omit<EditMarketplaceOrderProps, "signer" | "marketplace_address">;

export const useMarketplace = () => {
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isAcceptingOrder, setIsAcceptingOrder] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState(false);

  const {
    setup: {
      systemCalls: {
        create_marketplace_order,
        accept_marketplace_order,
        cancel_marketplace_order,
        edit_marketplace_order,
      },
    },
  } = useDojo();

  const { account } = useAccount();

  const { contract } = useContract({
    abi: SeasonPassAbi,
    address: seasonPassAddress as `0x${string}`,
  });

  const { contract: lordsContract } = useContract({
    abi: LordsAbi,
    address: lordsAddress as `0x${string}`,
  });

  // improve
  const seasonPassApproved = useReadContract({
    abi: SeasonPassAbi,
    address: seasonPassAddress as `0x${string}`,
    functionName: "is_approved_for_all",
    args: [account?.address as `0x${string}`, marketplaceAddress],
    watch: true,
  });

  const { send, error } = useSendTransaction({
    calls: contract && account ? [contract.populate("set_approval_for_all", [marketplaceAddress, 1n])] : undefined,
  });

  const approveMarketplace = async () => {
    if (!account) throw new Error("Account not connected");
    await send();
  };

  const listItem = async (params: ListItemParams) => {
    if (!account) throw new Error("Account not connected");
    setIsCreatingOrder(true);
    try {
      await create_marketplace_order({
        ...params,
        signer: account as AccountInterface,
        marketplace_address: marketplaceAddress,
      });
      // Add success handling if needed
    } catch (error) {
      console.error("Failed to list item:", error);
      // Add error handling if needed
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const acceptOrder = async (params: AcceptOrderParams & { price: bigint }) => {
    if (!account) throw new Error("Account not connected");
    setIsAcceptingOrder(true);

    const lordsApproved = lordsContract?.populate("approve", [marketplaceAddress, params.price]);

    try {
      // accept order
      await accept_marketplace_order(
        {
          ...params,
          signer: account as AccountInterface,
          marketplace_address: marketplaceAddress,
        },
        lordsApproved,
      );
      // Add success handling if needed
    } catch (error) {
      console.error("Failed to accept order:", error);
      // Add error handling if needed
    } finally {
      setIsAcceptingOrder(false);
    }
  };

  const cancelOrder = async (params: CancelOrderParams) => {
    if (!account) throw new Error("Account not connected");
    setIsCancellingOrder(true);
    try {
      await cancel_marketplace_order({
        ...params,
        signer: account as AccountInterface,
        marketplace_address: marketplaceAddress,
      });
      // Add success handling if needed
    } catch (error) {
      console.error("Failed to cancel order:", error);
      // Add error handling if needed
    } finally {
      setIsCancellingOrder(false);
    }
  };

  const editOrder = async (params: EditOrderParams) => {
    if (!account) throw new Error("Account not connected");
    setIsEditingOrder(true);
    try {
      await edit_marketplace_order({
        ...params,
        signer: account as AccountInterface,
        marketplace_address: marketplaceAddress,
      });
      // Add success handling if needed
    } catch (error) {
      console.error("Failed to edit order:", error);
      // Add error handling if needed
    } finally {
      setIsEditingOrder(false);
    }
  };

  return {
    listItem,
    acceptOrder,
    cancelOrder,
    editOrder,
    approveMarketplace,
    seasonPassApproved: seasonPassApproved.data,
    isLoading: isCreatingOrder || isAcceptingOrder || isCancellingOrder || isEditingOrder,
    isCreatingOrder,
    isAcceptingOrder,
    isCancellingOrder,
    isEditingOrder,
  };
};
