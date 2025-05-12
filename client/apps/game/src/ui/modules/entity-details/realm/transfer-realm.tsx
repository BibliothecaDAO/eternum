import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import TextInput from "@/ui/elements/text-input";
import { displayAddress } from "@/ui/utils/utils";
import { useCartridgeAddress, useDebounce, useDojo } from "@bibliothecadao/react";
import { useEffect, useState } from "react";

export const TransferRealm = ({ structure }: { structure: any }) => {
  const {
    setup: {
      systemCalls: { transfer_structure_ownership },
      account: { account },
    },
  } = useDojo();

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const { address: cartridgeAddress, fetchAddress, loading: cartridgeLoading, name } = useCartridgeAddress();
  const [input, setInput] = useState<string>("");
  const [transferTo, setTransferTo] = useState<string | null>(null);
  const debouncedInput = useDebounce(input, 500); // 500ms delay

  useEffect(() => {
    const validateAndSetTransferAddress = async () => {
      if (!debouncedInput) {
        setTransferTo(null);
        return;
      }

      // Reset transferTo initially
      setTransferTo(null);

      await fetchAddress(debouncedInput);

      if (cartridgeAddress) {
        setTransferTo(cartridgeAddress);
      } else {
        // Check if the input looks like a Starknet address (hex)
        if (debouncedInput.startsWith("0x") && debouncedInput.length === 66) {
          setTransferTo(debouncedInput);
        } else {
          // Check if the input can be converted to a BigInt (decimal or other valid format)
          try {
            BigInt(debouncedInput);
            // If conversion succeeds, set it as the transfer target
            setTransferTo(debouncedInput);
          } catch (e) {
            // If conversion fails, transferTo remains null
          }
        }
      }
    };

    validateAndSetTransferAddress();
  }, [debouncedInput, cartridgeAddress, fetchAddress]);

  return (
    <div>
      <div className="flex gap-2 text-xl mb-4">
        <TextInput
          placeholder="Enter Controller ID or address for transfer"
          value={input}
          className="text-gold text-xl"
          onChange={(e) => setInput(e)}
        />
      </div>

      {cartridgeLoading && (
        <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 p-2 text-base text-gray-800">
          <span>Loading address...</span>
        </div>
      )}

      {!cartridgeLoading && cartridgeAddress && debouncedInput && (
        <div className="border p-2 rounded-md border-green-300 bg-green/20 text-base text-green/90 flex items-center justify-between gap-2">
          <span>Controller address found! {displayAddress(cartridgeAddress)}</span>

          <span>Name: {name}</span>
        </div>
      )}

      {cartridgeAddress && debouncedInput && (
        <Button
          className="mt-4"
          variant="gold"
          onClick={() => {
            console.log("transfer_structure_ownership", structureEntityId, transferTo);
            transfer_structure_ownership({
              signer: account,
              structure_id: structureEntityId,
              new_owner: BigInt(transferTo || ""),
            });
          }}
        >
          Transfer Ownership
        </Button>
      )}
    </div>
  );
};
