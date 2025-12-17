import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import Button from "@/ui/design-system/atoms/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface DevOptionsProps {
  onDevModeRegister: () => Promise<void>;
  onDevModeSettle: () => Promise<void>;
  onDevModeObtainEntryToken?: () => Promise<void>;
  devMode: boolean;
  className?: string;
}

export const DevOptions = ({
  onDevModeRegister,
  onDevModeSettle,
  onDevModeObtainEntryToken,
  devMode,
  className = "",
}: DevOptionsProps) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [isObtainingToken, setIsObtainingToken] = useState(false);

  if (!devMode) return null;

  const handleDevModeRegister = async () => {
    setIsRegistering(true);
    try {
      await onDevModeRegister();
    } catch (error) {
      console.error("Registration failed:", error);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDevModeSettle = async () => {
    setIsSettling(true);
    try {
      await onDevModeSettle();
    } catch (error) {
      console.error("Settlement failed:", error);
    } finally {
      setIsSettling(false);
    }
  };

  const handleDevModeObtainEntryToken = async () => {
    if (!onDevModeObtainEntryToken) return;

    setIsObtainingToken(true);
    try {
      await onDevModeObtainEntryToken();
    } catch (error) {
      console.error("Obtain entry token failed:", error);
    } finally {
      setIsObtainingToken(false);
    }
  };

  return (
    <div className={`space-y-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg ${className}`}>
      <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Dev Mode</p>

      {onDevModeObtainEntryToken && (
        <Button
          onClick={handleDevModeObtainEntryToken}
          disabled={isObtainingToken}
          className="w-full h-10 px-3 !text-brown !bg-gold rounded-md"
          forceUppercase={false}
        >
          {isObtainingToken ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Obtaining Token...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm">
              <TreasureChest className="w-4 h-4 fill-brown" />
              <span>Dev: Obtain Entry Token</span>
            </div>
          )}
        </Button>
      )}

      <Button
        onClick={handleDevModeRegister}
        disabled={isRegistering}
        forceUppercase={false}
        className="w-full h-10 px-3 !text-brown !bg-gold rounded-md text-sm"
      >
        {isRegistering ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Registering...</span>
          </div>
        ) : (
          <span>Dev: Register for Blitz</span>
        )}
      </Button>

      <Button
        onClick={handleDevModeSettle}
        disabled={isSettling}
        forceUppercase={false}
        className="w-full h-10 px-3 !text-brown !bg-gold rounded-md text-sm"
      >
        {isSettling ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Settling...</span>
          </div>
        ) : (
          <span>Dev: Settle Realm</span>
        )}
      </Button>
    </div>
  );
};
