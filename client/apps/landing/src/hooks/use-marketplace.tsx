import { lordsAddress, marketplaceAddress, seasonPassAddress } from "@/config";
import { LordsAbi, SeasonPassAbi } from "@bibliothecadao/eternum";
import {
  CancelMarketplaceOrderProps,
  CreateMarketplaceOrderProps,
  EditMarketplaceOrderProps,
} from "@bibliothecadao/types";
import { useAccount, useContract, useReadContract, useSendTransaction } from "@starknet-react/core";
import { useState } from "react";
import { toast } from "sonner";
import { AccountInterface } from "starknet";
import { useDojo } from "./context/dojo-context";

// Define the parameters needed for each function, excluding the signer which is handled internally.
type ListItemParams = Omit<CreateMarketplaceOrderProps, "signer" | "marketplace_address">;
type AcceptOrdersParams = Omit<AcceptMarketplaceOrdersProps, "signer" | "marketplace_address">;
type CancelOrderParams = Omit<CancelMarketplaceOrderProps, "signer" | "marketplace_address">;
type EditOrderParams = Omit<EditMarketplaceOrderProps, "signer" | "marketplace_address">;

export const useMarketplace = () => {
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isAcceptingOrder, setIsAcceptingOrder] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isApprovingMarketplace, setIsApprovingMarketplace] = useState(false);

  const {
    setup: {
      systemCalls: {
        create_marketplace_order,
        accept_marketplace_orders,
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
    setIsApprovingMarketplace(true);
    try {
      await send();
      toast.success("Marketplace approved successfully!");
    } catch (error) {
      console.error("Failed to approve marketplace:", error);
      toast.error("Failed to approve marketplace. Please try again.");
      throw error;
    } finally {
      setIsApprovingMarketplace(false);
    }
  };

  const listItem = async (params: ListItemParams) => {
    if (!account) throw new Error("Account not connected");
    setIsCreatingOrder(true);
    try {
      await create_marketplace_order({
        price: params.price.toString(),
        expiration: params.expiration,
        token_id: params.token_id,
        collection_id: params.collection_id,
        signer: account as AccountInterface,
        marketplace_address: marketplaceAddress,
      });
      toast.success("Transaction confirmed! Syncing listing status...");
      // Add success handling if needed
    } catch (error) {
      console.error("Failed to list item:", error);
      toast.error("Failed to list item. Please try again.");
      // Add error handling if needed
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const acceptOrders = async (params: AcceptOrdersParams & { totalPrice: bigint }) => {
    if (!account) throw new Error("Account not connected");
    setIsAcceptingOrder(true);

    const lordsApproved = lordsContract?.populate("approve", [marketplaceAddress, params.totalPrice]);

    try {
      // accept order
      await accept_marketplace_orders(
        {
          order_ids: params.order_ids,
          signer: account as AccountInterface,
          marketplace_address: marketplaceAddress,
        },
        lordsApproved,
      );
      // Add success handling if needed
      toast.success("Order accepted successfully!");
    } catch (error) {
      console.error("Failed to accept order:", error);
      // Add error handling if needed
      toast.error("Failed to accept order. Please try again.");
    } finally {
      setIsAcceptingOrder(false);
    }
  };

  const cancelOrder = async (params: CancelOrderParams) => {
    if (!account) throw new Error("Account not connected");
    setIsCancellingOrder(true);
    try {
      await cancel_marketplace_order({
        order_id: params.order_id.toString(),
        signer: account as AccountInterface,
        marketplace_address: marketplaceAddress,
      });
      // Add success handling if needed
      toast.success("Order cancelled successfully!");
    } catch (error) {
      console.error("Failed to cancel order:", error);
      // Add error handling if needed
      toast.error("Failed to cancel order. Please try again.");
    } finally {
      setIsCancellingOrder(false);
    }
  };

  const editOrder = async (params: EditOrderParams) => {
    if (!account) throw new Error("Account not connected");
    setIsEditingOrder(true);
    try {
      await edit_marketplace_order({
        order_id: params.order_id.toString(),
        new_price: params.new_price.toString(),
        signer: account as AccountInterface,
        marketplace_address: marketplaceAddress,
      });
      // Add success handling if needed
      toast.success("Order edited successfully!");
    } catch (error) {
      console.error("Failed to edit order:", error);
      // Add error handling if needed
      toast.error("Failed to edit order. Please try again.");
    } finally {
      setIsEditingOrder(false);
    }
  };

  return {
    listItem,
    acceptOrders,
    cancelOrder,
    editOrder,
    approveMarketplace,
    seasonPassApproved: seasonPassApproved.data,
    isLoading: isCreatingOrder || isAcceptingOrder || isCancellingOrder || isEditingOrder,
    isCreatingOrder,
    isAcceptingOrder,
    isCancellingOrder,
    isEditingOrder,
    isApprovingMarketplace,
  };
};
