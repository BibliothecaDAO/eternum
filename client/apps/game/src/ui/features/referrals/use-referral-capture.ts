import { useAccount } from "@starknet-react/core";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { type ReferralCreatePayload, submitReferral } from "./referral-api";
import {
  clearStoredReferralAddress,
  getStoredReferralAddress,
  normalizeReferralAddress,
  parseReferralAddressFromUrl,
  saveReferralAddress,
} from "./referral-storage";

export const useReferralCapture = () => {
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const accountName = useAccountStore((state) => state.accountName);
  const inFlightRef = useRef<string | null>(null);

  useEffect(() => {
    const captured = parseReferralAddressFromUrl();
    if (!captured) {
      return;
    }

    const normalizedWallet = address ? normalizeReferralAddress(address) : null;
    if (normalizedWallet && captured === normalizedWallet) {
      return;
    }

    saveReferralAddress(captured);
  }, [address, location.pathname, location.search]);

  useEffect(() => {
    if (!isConnected || !address) {
      return;
    }

    const refereeAddress = normalizeReferralAddress(address);
    const referrerAddress = getStoredReferralAddress();

    if (!referrerAddress || referrerAddress === refereeAddress) {
      if (referrerAddress === refereeAddress) {
        clearStoredReferralAddress();
      }
      return;
    }

    const requestKey = `${refereeAddress}:${referrerAddress}`;
    if (inFlightRef.current === requestKey) {
      return;
    }
    inFlightRef.current = requestKey;

    const payload: ReferralCreatePayload = {
      refereeAddress,
      referrerAddress,
      refereeUsername: accountName ?? undefined,
      source: "dashboard",
    };

    void submitReferral(payload, {
      playerId: refereeAddress,
      walletAddress: refereeAddress,
      displayName: accountName,
    })
      .then(() => {
        clearStoredReferralAddress();
      })
      .catch((error) => {
        console.warn("Failed to submit referral", error);
      })
      .finally(() => {
        inFlightRef.current = null;
      });
  }, [address, isConnected, accountName]);
};
