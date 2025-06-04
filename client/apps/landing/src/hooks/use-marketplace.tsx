import { lordsAddress, marketplaceAddress } from "@/config";
import { LordsAbi } from "@bibliothecadao/eternum";
import {
  AcceptMarketplaceOrdersProps,
  CancelMarketplaceOrderProps,
  CreateMarketplaceOrderProps,
  EditMarketplaceOrderProps,
} from "@bibliothecadao/types";
import { useAccount, useContract } from "@starknet-react/core";
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

  const { contract: lordsContract } = useContract({
    abi: LordsAbi,
    address: lordsAddress as `0x${string}`,
  });

  const listItem = async (params: ListItemParams): Promise<{ execution_status: string } | undefined> => {
    if (!account) throw new Error("Account not connected");
    setIsCreatingOrder(true);
    try {
      return (await create_marketplace_order({
        price: params.price.toString(),
        expiration: params.expiration,
        token_id: params.token_id,
        collection_id: params.collection_id,
        signer: account as AccountInterface,
        marketplace_address: marketplaceAddress,
        cancel_order_id: params.cancel_order_id,
      })) as { execution_status: string };
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
      return (await edit_marketplace_order({
        order_id: params.order_id.toString(),
        new_price: params.new_price.toString(),
        signer: account as AccountInterface,
        marketplace_address: marketplaceAddress,
      })) as { execution_status: string };
    } catch (error) {
      console.error("Failed to edit order:", error);
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
    isLoading: isCreatingOrder || isAcceptingOrder || isCancellingOrder || isEditingOrder,
    isCreatingOrder,
    isAcceptingOrder,
    isCancellingOrder,
    isEditingOrder,
  };
};
